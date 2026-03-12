import { requireValidSession } from "./session-validation";
import { CACHE_TTL, UnifiedCacheManager } from "./cache-utils";
import { GlobalRequestDeduplicator } from "./request-deduplicator";
import { PersistentCacheService } from "./persistent-cache-service";
import { EdgeClient } from "./request-handler";

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
  is_active?: boolean;
}

export interface SupplierLimitInfo {
  current: number;
  max: number;
  canCreate: boolean;
}

export class SupplierService {
  private static readonly SOFT_REFRESH_THRESHOLD_MS = 300_000; // 5 min soft refresh
  private static softRefreshInFlightByUser = new Set<string>();

  private static cache = UnifiedCacheManager.create("rq:suppliers", {
    mode: "auto",
    defaultTtlMs: 600_000, // 10 min cache for suppliers (rarely changes)
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

  private static async fetchSuppliersFromApi(opts?: { signal?: AbortSignal }): Promise<Supplier[]> {
    try {
      const payload = await EdgeClient.invokeWithRetry<{ suppliers?: Supplier[] }>(
        "suppliers-list",
        {},
        { signal: opts?.signal, timeoutMs: 25_000 },
      );
      return Array.isArray(payload?.suppliers) ? payload.suppliers! : [];
    } catch (error) {
      if (opts?.signal && (error as { name?: string } | null)?.name === "AbortError") {
        throw error;
      }
      return [];
    }
  }

  static clearSuppliersCache(): void {
    GlobalRequestDeduplicator.cancelPrefix("SupplierService:");
    SupplierService.cache.clearAll();
    try {
      PersistentCacheService.invalidateSuppliers();
    } catch {
      void 0;
    }
  }

  /** Получение только максимального лимита поставщиков (без подсчета текущих) */
  static async getSupplierLimitOnly(): Promise<number> {
    const payload = await EdgeClient.invokeWithRetry<{ value?: number }>("suppliers-limit", {});
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
  static async getSuppliers(opts?: { signal?: AbortSignal }): Promise<Supplier[]> {
    return await PersistentCacheService.getSuppliers(async () => await SupplierService.getSuppliersDirect(opts));
  }

  private static async getSuppliersDirect(opts?: { signal?: AbortSignal }): Promise<Supplier[]> {
    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";
    const cached = userId ? SupplierService.getCachedSuppliers(userId) : null;
    if (cached) {
      const timeLeft = cached.expiresAt - Date.now();
      if (timeLeft > 0 && userId) {
        if (timeLeft < SupplierService.SOFT_REFRESH_THRESHOLD_MS) {
          if (!SupplierService.softRefreshInFlightByUser.has(userId)) {
            SupplierService.softRefreshInFlightByUser.add(userId);
            void SupplierService.fetchSuppliersFromApi()
              .then((rows) => {
                SupplierService.setSuppliersCache(userId, rows);
              })
              .catch(() => void 0)
              .finally(() => {
                SupplierService.softRefreshInFlightByUser.delete(userId);
              });
          }
        }
        return cached.rows;
      }
    }
    const inflightKey = userId || "current";
    return await GlobalRequestDeduplicator.dedupeExpensive(
      { service: "SupplierService", method: "getSuppliers", params: { userId: inflightKey } },
      async ({ signal }) => {
        const rows = await SupplierService.fetchSuppliersFromApi({ signal: opts?.signal ?? signal });
      if (userId) {
        SupplierService.setSuppliersCache(userId, rows);
      }
      return rows;
      },
    );
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

    const payload = await EdgeClient.invokeWithRetry<{ supplier?: Supplier }>('suppliers-create', {
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
    try {
      PersistentCacheService.invalidateSuppliers();
    } catch {
      void 0;
    }
    return row;
  }

  /** Оновлення постачальника */
  static async updateSupplier(id: number, supplierData: UpdateSupplierData): Promise<Supplier> {
    if (!id) throw new Error("Supplier ID is required");

    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";

    const cleanData: Partial<Pick<Supplier, 'supplier_name' | 'website_url' | 'xml_feed_url' | 'phone' | 'is_active'>> & { updated_at?: string } = {};
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
    if (supplierData.is_active !== undefined) {
      cleanData.is_active = supplierData.is_active;
    }

    if (Object.keys(cleanData).length === 0) {
      throw new Error("No fields to update");
    }

    cleanData.updated_at = new Date().toISOString();

    const payload = await EdgeClient.invokeWithRetry<{ supplier?: Supplier }>('suppliers-update', { id, ...cleanData });
    const row = payload?.supplier as Supplier | undefined;
    if (!row) throw new Error('Update failed');
    if (userId) {
      const cached = SupplierService.getCachedSuppliers(userId);
      const prev = cached?.rows || [];
      const next = prev.map((s) => (Number(s.id) === Number(row.id) ? row : s));
      const exists = next.some((s) => Number(s.id) === Number(row.id));
      SupplierService.setSuppliersCache(userId, exists ? next : [row, ...next]);
    }
    try {
      PersistentCacheService.invalidateSuppliers();
    } catch {
      void 0;
    }
    return row;
  }

  /** Видалення постачальника. Returns linkedStoreIds for cache invalidation. */
  static async deleteSupplier(id: number): Promise<{ linkedStoreIds?: string[] }> {
    if (!id) throw new Error("Supplier ID is required");

    const sessionValidation = await requireValidSession({ requireAccessToken: false });
    const userId = sessionValidation.user?.id ? String(sessionValidation.user.id) : "";
    const result = await EdgeClient.invokeWithRetry<{ ok?: boolean; linkedStoreIds?: string[] }>('suppliers-delete', { id });
    if (userId) {
      const cached = SupplierService.getCachedSuppliers(userId);
      const prev = cached?.rows || [];
      const next = prev.filter((s) => Number(s.id) !== Number(id));
      SupplierService.setSuppliersCache(userId, next);
    }
    try {
      const { PersistentCacheService } = await import("@/lib/persistent-cache-service");
      PersistentCacheService.invalidateSuppliers();
    } catch {
      void 0;
    }

    // Invalidate Dashboard Cache
    try {
      const { DashboardService } = await import("@/lib/dashboard-service");
      DashboardService.clearCache();
    } catch {
      void 0;
    }

    return { linkedStoreIds: result?.linkedStoreIds };
  }
}
