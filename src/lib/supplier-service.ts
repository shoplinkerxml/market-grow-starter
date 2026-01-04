import { requireValidSession, invokeEdgeWithAuth } from "./session-validation";
import { CACHE_TTL, UnifiedCacheManager } from "./cache-utils";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

export interface Supplier {
  id: number;
  user_id: string;
  supplier_name: string;
  website_url: string | null;
  xml_feed_url: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  address?: string | null;
  is_active?: boolean | null;
}

export interface CreateSupplierData {
  supplier_name: string;
  website_url?: string;
  xml_feed_url?: string | null;
  phone?: string;
}

export interface UpdateSupplierData {
  supplier_name?: string;
  website_url?: string;
  xml_feed_url?: string | null;
  phone?: string;
}

export interface SupplierLimitInfo {
  current: number;
  max: number;
  canCreate: boolean;
}

export class SupplierService {
  private static deduplicator = RequestDeduplicatorFactory.create<Supplier[]>("supplier-service:suppliers", {
    ttl: 30_000,
    maxSize: 50,
    enableMetrics: true,
    errorStrategy: "remove",
  });
  private static readonly SOFT_REFRESH_THRESHOLD_MS = 120_000;

  private static cache = UnifiedCacheManager.create("rq:suppliers", {
    mode: "auto",
    defaultTtlMs: CACHE_TTL.suppliersList,
  });

  private static getSuppliersCacheKey(userId: string): string {
    return `list:${userId}`;
  }

  private static setSuppliersCache(userId: string, rows: Supplier[]): void {
    SupplierService.cache.set(SupplierService.getSuppliersCacheKey(userId), rows);
  }

  private static getCachedSuppliers(userId: string): { rows: Supplier[]; expiresAt: number } | null {
    const cached = SupplierService.cache.getEnvelope<Supplier[]>(SupplierService.getSuppliersCacheKey(userId));
    if (!cached || !Array.isArray(cached.data)) return null;
    const expiresAt = typeof cached.expiresAt === "number" ? cached.expiresAt : 0;
    return { rows: cached.data, expiresAt };
  }

  private static async fetchSuppliersFromApi(): Promise<Supplier[]> {
    try {
      const payload = await invokeEdgeWithAuth<{ suppliers?: Supplier[] }>("suppliers-list", {});
      return Array.isArray(payload?.suppliers) ? payload.suppliers! : [];
    } catch {
      return [];
    }
  }

  static clearSuppliersCache(): void {
    SupplierService.deduplicator.clear();
    SupplierService.cache.clearAll();
  }

  /** Получение только максимального лимита поставщиков (без подсчета текущих) */
  static async getSupplierLimitOnly(): Promise<number> {
    const payload = await invokeEdgeWithAuth<{ value?: number }>("suppliers-limit", {});
    return Number(payload?.value || 0);
  }

  /** Получение лимита поставщиков для текущего пользователя */
  static async getSupplierLimit(): Promise<SupplierLimitInfo> {
    const maxSuppliers = await this.getSupplierLimitOnly();
    const currentCount = await this.getSuppliersCount();

    return {
      current: currentCount,
      max: maxSuppliers,
      canCreate: currentCount < maxSuppliers
    };
  }

  /** Получение количества поставщиков текущего пользователя */
  static async getSuppliersCount(): Promise<number> {
    const list = await SupplierService.getSuppliers();
    return Array.isArray(list) ? list.length : 0;
  }

  static async getSuppliersCountCached(): Promise<number> {
    return await this.getSuppliersCount();
  }

  /** Отримання списку постачальників поточного користувача */
  static async getSuppliers(): Promise<Supplier[]> {
    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";
    const cached = userId ? SupplierService.getCachedSuppliers(userId) : null;
    if (cached) {
      const timeLeft = cached.expiresAt - Date.now();
      if (timeLeft > 0 && userId) {
        if (timeLeft < SupplierService.SOFT_REFRESH_THRESHOLD_MS) {
          void (async () => {
            try {
              const rows = await SupplierService.fetchSuppliersFromApi();
              SupplierService.setSuppliersCache(userId, rows);
            } catch {
              void 0;
            }
          })();
        }
        return cached.rows;
      }
    }
    const inflightKey = userId || "current";
    return await SupplierService.deduplicator.dedupe(inflightKey, async () => {
      const rows = await SupplierService.fetchSuppliersFromApi();
      if (userId) {
        SupplierService.setSuppliersCache(userId, rows);
      }
      return rows;
    });
  }

  /** Отримання одного постачальника за ID */
  static async getSupplier(id: number): Promise<Supplier> {
    if (!id) throw new Error("Supplier ID is required");

    await requireValidSession({ requireAccessToken: false });

    const list = await SupplierService.getSuppliers();
    const found = list.find((s) => Number(s.id) === Number(id));
    if (!found) throw new Error("Supplier not found");
    return found;
  }

  /** Створення нового постачальника */
  static async createSupplier(supplierData: CreateSupplierData): Promise<Supplier> {
    if (!supplierData.supplier_name?.trim()) {
      throw new Error("Назва постачальника обов'язкова");
    }

    // xml_feed_url є НЕобов'язковим

    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";

    const xmlUrl = supplierData.xml_feed_url ? supplierData.xml_feed_url.trim() : '';

    const payload = await invokeEdgeWithAuth<{ supplier?: Supplier }>('suppliers-create', {
      supplier_name: supplierData.supplier_name.trim(),
      website_url: supplierData.website_url?.trim() || null,
      xml_feed_url: xmlUrl ? xmlUrl : null,
      phone: supplierData.phone?.trim() || null,
    });
    const row = payload?.supplier as Supplier | undefined;
    if (!row) throw new Error('Create failed');
    if (userId) {
      const cached = SupplierService.getCachedSuppliers(userId);
      const next = [row, ...(cached?.rows || [])].filter((v) => v && typeof v === "object");
      SupplierService.setSuppliersCache(userId, next);
    }
    return row;
  }

  /** Оновлення постачальника */
  static async updateSupplier(id: number, supplierData: UpdateSupplierData): Promise<Supplier> {
    if (!id) throw new Error("Supplier ID is required");

    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";

    const cleanData: Partial<Pick<Supplier, 'supplier_name' | 'website_url' | 'xml_feed_url' | 'phone'>> & { updated_at?: string } = {};
    if (supplierData.supplier_name !== undefined) {
      if (!supplierData.supplier_name.trim()) {
        throw new Error("Назва постачальника обов'язкова");
      }
      cleanData.supplier_name = supplierData.supplier_name.trim();
    }
    if (supplierData.xml_feed_url !== undefined) {
      const trimmed = (supplierData.xml_feed_url ?? '').toString().trim();
      // Порожній рядок означає очистити значення до null
      cleanData.xml_feed_url = trimmed ? trimmed : null;
    }
    if (supplierData.website_url !== undefined) {
      cleanData.website_url = supplierData.website_url?.trim() || null;
    }
    if (supplierData.phone !== undefined) {
      cleanData.phone = supplierData.phone?.trim() || null;
    }

    if (Object.keys(cleanData).length === 0) {
      throw new Error("No fields to update");
    }

    cleanData.updated_at = new Date().toISOString();

    const payload = await invokeEdgeWithAuth<{ supplier?: Supplier }>('suppliers-update', { id, ...cleanData });
    const row = payload?.supplier as Supplier | undefined;
    if (!row) throw new Error('Update failed');
    if (userId) {
      const cached = SupplierService.getCachedSuppliers(userId);
      const prev = cached?.rows || [];
      const next = prev.map((s) => (Number(s.id) === Number(row.id) ? row : s));
      const exists = next.some((s) => Number(s.id) === Number(row.id));
      SupplierService.setSuppliersCache(userId, exists ? next : [row, ...next]);
    }
    return row;
  }

  /** Видалення постачальника */
  static async deleteSupplier(id: number): Promise<void> {
    if (!id) throw new Error("Supplier ID is required");

    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";
    await invokeEdgeWithAuth<{ ok?: boolean }>('suppliers-delete', { id });
    if (userId) {
      const cached = SupplierService.getCachedSuppliers(userId);
      const prev = cached?.rows || [];
      const next = prev.filter((s) => Number(s.id) !== Number(id));
      SupplierService.setSuppliersCache(userId, next);
    }
  }
}
