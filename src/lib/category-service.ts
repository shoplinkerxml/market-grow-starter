import type { Database } from "@/integrations/supabase/types";
import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";
import { SessionValidator } from "@/lib/session-validation";
import { EdgeClient } from "@/lib/request-handler";

export interface CreateCategoryInput {
  supplier_id: string | number;
  external_id: string;
  name: string;
  store_id?: string;
  parent_external_id?: string | null;
}

type StoreCategoryRow = Database["public"]["Tables"]["store_categories"]["Row"];
type CategoryDb = Pick<
  StoreCategoryRow,
  "id" | "external_id" | "name" | "parent_external_id" | "rz_id" | "store_id" | "supplier_id" | "created_at"
>;

export type Category = Partial<
  Omit<CategoryDb, "id" | "supplier_id"> & {
    id: CategoryDb["id"] | string;
    supplier_id: CategoryDb["supplier_id"] | string;
  }
>;

function castNullableNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function categoriesSelect(columns: string, supplierId?: string | number) {
  const normalized = castNullableNumber(supplierId);
  return { columns, supplierId: normalized } as { columns: string; supplierId?: number };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isStringOrNumber(v: unknown): v is string | number {
  return typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

export function isCategoryBase(v: unknown): v is Category & { external_id: string; name: string; parent_external_id: string | null } {
  if (!isRecord(v)) return false;
  if (!isString(v.external_id) || v.external_id.trim() === "") return false;
  if (!isString(v.name)) return false;
  if (!isNullableString(v.parent_external_id)) return false;
  return true;
}

export function isCategoryFull(
  v: unknown,
): v is Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null } {
  if (!isCategoryBase(v)) return false;
  const rec = v as Record<string, unknown>;
  if (!isStringOrNumber(rec.id)) return false;
  if (!isStringOrNumber(rec.supplier_id)) return false;
  return true;
}

function assertArray<T>(items: unknown[], guard: (v: unknown) => v is T, errorMessage: string): asserts items is T[] {
  for (const it of items) {
    if (!guard(it)) throw new Error(errorMessage);
  }
}

export function invalidateCategoriesCache(): void {
  try { UnifiedCacheManager.invalidatePattern(/^products:supplierCategoriesMap(?::|$)/); } catch {}
  try { UnifiedCacheManager.invalidatePattern(/^rq:supplierCategoriesMap(?::|$)/); } catch {}
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export const CategoryService = {
  
  // 0. Read specific category by internal id
  async getById(id: string | number): Promise<(Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }) | null> {
    const idNum = castNullableNumber(id);
    if (idNum === undefined) return null;
    const resp = await EdgeClient.invokeWithRetry<{ item?: Category | null }>("categories", {
      action: "get_by_id",
      id: idNum,
    });
    if (!resp.item) return null;
    return isCategoryFull(resp.item) ? resp.item : null;
  },

  // 0a. Read category name by internal id (safe)
  async getNameByIdSafe(id: number | string): Promise<string | null> {
    const idNum = castNullableNumber(id);
    if (idNum === undefined) return null;
    const resp = await EdgeClient.invokeWithRetry<{ name?: string | null }>("categories", { action: "get_name_by_id", id: idNum });
    return resp.name ?? null;
  },
  // 4. Get all categories of supplier
  async listCategories(
    supplierId?: string | number,
  ): Promise<Array<Category & { external_id: string; name: string; parent_external_id: string | null }>> {
    const sel = categoriesSelect("external_id,name,parent_external_id", supplierId);
    const resp = await EdgeClient.invokeWithRetry<{ rows?: Category[] }>("categories", {
      action: "list",
      supplier_id: sel.supplierId,
    });
    const rows = (resp.rows ?? []) as unknown[];
    assertArray<Category & { external_id: string; name: string; parent_external_id: string | null }>(rows, isCategoryBase, "Invalid category row");
    return rows;
  },

  // 1–2. Create category or subcategory
  async createCategory(input: CreateCategoryInput): Promise<Category & { external_id: string; name: string; parent_external_id: string | null }> {
    const payload = {
      supplier_id: castNullableNumber(input.supplier_id),
      external_id: input.external_id,
      name: input.name,
      parent_external_id: input.parent_external_id ?? null,
    };
    const resp = await EdgeClient.invokeWithRetry<{ item: Category }>("categories", { action: "create", data: payload });
    invalidateCategoriesCache();
    if (!isCategoryBase(resp.item)) throw new Error("Invalid category row");
    return resp.item;
  },

  // 3. Bulk create
  async bulkCreate(
    items: CreateCategoryInput[],
  ): Promise<Array<Category & { external_id: string; name: string; parent_external_id: string | null }>> {
    if (!items || items.length === 0) return [];
    const payload = items.map((it) => ({
      supplier_id: castNullableNumber(it.supplier_id),
      external_id: it.external_id,
      name: it.name,
      parent_external_id: it.parent_external_id ?? null,
    }));
    const resp = await EdgeClient.invokeWithRetry<{ rows?: Category[] }>("categories", { action: "bulk_create", items: payload });
    const rows = (resp.rows ?? []) as unknown[];
    invalidateCategoriesCache();
    assertArray<Category & { external_id: string; name: string; parent_external_id: string | null }>(rows, isCategoryBase, "Invalid category row");
    return rows;
  },

  // 4. Read all categories for supplier (full shape including id)
  async getSupplierCategories(
    supplierId: string | number,
  ): Promise<Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>> {
    const sel = categoriesSelect("id,external_id,name,parent_external_id,supplier_id", supplierId);
    const resp = await EdgeClient.invokeWithRetry<{ rows?: Category[] }>("categories", {
      action: "get_supplier_categories",
      supplier_id: sel.supplierId,
    });
    const rows = (resp.rows ?? []) as unknown[];
    assertArray<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>(
      rows,
      isCategoryFull,
      "Invalid full category row",
    );
    return rows;
  },

  // Aggregated: read categories for multiple suppliers in one request and return a map
  async getCategoriesMapForSuppliers(
    supplierIds: Array<string | number>,
  ): Promise<Record<string, Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>>> {
    const ids = Array.from(new Set((supplierIds || []).map(String).filter(Boolean)));
    if (ids.length === 0) return {};
    const uid = await SessionValidator.validateSession()
      .then((v) => (v?.user?.id ? String(v.user.id) : "current"))
      .catch(() => "current");
    const cache = UnifiedCacheManager.create("products:supplierCategoriesMap", {
      mode: "auto",
      defaultTtlMs: CACHE_TTL.supplierCategoriesMap,
    });
    const cacheKey = `user:${uid || "current"}`;

    const tryReadLegacy = (): Record<
      string,
      Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>
    > | null => {
      try {
        if (typeof window === "undefined") return null;
        const legacyKey = `rq:supplierCategoriesMap:${uid || "current"}`;
        const candidates = [legacyKey, `v1:${legacyKey}`];
        const storages: Storage[] = [];
        try { storages.push(window.localStorage); } catch { void 0; }
        try { storages.push(window.sessionStorage); } catch { void 0; }
        for (const s of storages) {
          for (const k of candidates) {
            const raw = s.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as { data?: unknown; expiresAt?: unknown };
            const expiresAt = typeof parsed?.expiresAt === "number" ? parsed.expiresAt : 0;
            if (expiresAt > 0 && expiresAt <= Date.now()) continue;
            const data = parsed?.data;
            if (!data || typeof data !== "object") continue;
            try {
              for (const kk of candidates) s.removeItem(kk);
            } catch {
              void 0;
            }
            return data as Record<
              string,
              Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>
            >;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    const cached = cache.get<
      Record<string, Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>>
    >(cacheKey, false);
    const legacy = !cached ? tryReadLegacy() : null;
    const map: Record<string, Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>> =
      (cached && typeof cached === "object" ? cached : null) ??
      (legacy && typeof legacy === "object" ? legacy : null) ??
      {};

    const numericIds = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    const missing = numericIds.filter((supplierId) => {
      const k = String(supplierId);
      return !Array.isArray(map[k]);
    });

    if (missing.length > 0) {
      const batches = chunk(missing, 20);
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (supplierId) => {
            const resp = await EdgeClient.invokeWithRetry<{ rows?: Category[] }>("categories", {
              action: "get_supplier_categories",
              supplier_id: supplierId,
            });
            return { supplierId: String(supplierId), rows: resp.rows ?? [] };
          }),
        );
        for (const r of results) {
          const rows = (r.rows ?? []) as unknown[];
          assertArray<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>(
            rows,
            isCategoryFull,
            "Invalid full category row",
          );
          map[r.supplierId] = rows;
        }
      }
      cache.set(cacheKey, map, CACHE_TTL.supplierCategoriesMap);
    } else if (legacy) {
      cache.set(cacheKey, map, CACHE_TTL.supplierCategoriesMap);
    }

    return map;
  },

  // 5. Read subcategories of a specific category
  async getSubcategories(
    supplierId: string | number,
    parentExternalId: string,
  ): Promise<Array<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>> {
    const normalized = castNullableNumber(supplierId);
    const resp = await EdgeClient.invokeWithRetry<{ rows?: Category[] }>("categories", {
      action: "get_subcategories",
      supplier_id: normalized,
      parent_external_id: parentExternalId,
    });
    const rows = (resp.rows ?? []) as unknown[];
    assertArray<Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }>(
      rows,
      isCategoryFull,
      "Invalid full category row",
    );
    return rows;
  },

  // 6. Read specific category by external_id
  async getByExternalId(
    supplierId: string | number,
    externalId: string,
  ): Promise<(Category & { id: string | number; supplier_id: string | number; external_id: string; name: string; parent_external_id: string | null }) | null> {
    const normalized = castNullableNumber(supplierId);
    const resp = await EdgeClient.invokeWithRetry<{ item?: Category | null }>("categories", {
      action: "get_by_external_id",
      supplier_id: normalized,
      external_id: externalId,
    });
    if (!resp.item) return null;
    return isCategoryFull(resp.item) ? resp.item : null;
  },

  // 7. Update category name by external_id and supplier_id
  async updateName(
    supplierId: string | number,
    externalId: string,
    name: string,
  ): Promise<Category & { external_id: string; name: string; parent_external_id: string | null }> {
    const normalized = castNullableNumber(supplierId);
    if (normalized === undefined) {
      throw new Error("Invalid supplierId");
    }
    const resp = await EdgeClient.invokeWithRetry<{ item: Category }>("categories", {
      action: "update_name",
      supplier_id: normalized,
      external_id: externalId,
      name,
    });
    invalidateCategoriesCache();
    if (!isCategoryBase(resp.item)) throw new Error("Invalid category row");
    return resp.item;
  },

  // 8. Delete category by external_id and supplier_id
  async deleteCategory(supplierId: string | number, externalId: string): Promise<boolean> {
    const normalized = castNullableNumber(supplierId);
    if (normalized === undefined) {
      throw new Error("Invalid supplierId");
    }
    await EdgeClient.invokeWithRetry<{ ok: boolean }>("categories", {
      action: "delete",
      supplier_id: normalized,
      external_id: externalId,
    });
    invalidateCategoriesCache();
    return true;
  },

  // 9. Cascade delete: delete a category and all its descendants for a supplier
  async deleteCategoryCascade(supplierId: string | number, externalId: string): Promise<boolean> {
    const normalized = castNullableNumber(supplierId);
    if (normalized === undefined) {
      throw new Error("Invalid supplierId");
    }
    await EdgeClient.invokeWithRetry<{ ok: boolean }>("categories", {
      action: "delete_cascade",
      supplier_id: normalized,
      external_id: externalId,
    });
    invalidateCategoriesCache();
    return true;
  },
};
