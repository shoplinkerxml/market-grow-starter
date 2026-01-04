import type { Database } from "@/integrations/supabase/types";
import { readCache, writeCache, CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";
import { invokeEdgeWithAuth, SessionValidator } from "@/lib/session-validation";

// Minimal DTO shape aligned with UI needs
export type StoreCategory = {
  external_id: string;
  name: string;
  parent_external_id: string | null;
};

// Extended DTO used for admin views and precise queries
export type StoreCategoryFull = StoreCategory & {
  id: string; // keep as string to avoid numeric/uuid ambiguity in UI
  supplier_id: string;
};

export interface CreateCategoryInput {
  supplier_id: string | number;
  external_id: string;
  name: string;
  store_id?: string;
  parent_external_id?: string | null;
}

type StoreCategoryRow = Database["public"]["Tables"]["store_categories"]["Row"];
type StoreCategoryBase = Pick<StoreCategoryRow, "external_id" | "name" | "parent_external_id">;
type StoreCategoryFullRow = Pick<StoreCategoryRow, "id" | "external_id" | "name" | "parent_external_id" | "supplier_id">;

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

function toFull(row: StoreCategoryFullRow): StoreCategoryFull {
  return {
    id: String(row.id),
    external_id: row.external_id,
    name: row.name,
    parent_external_id: row.parent_external_id,
    supplier_id: String(row.supplier_id),
  };
}

function toBase(row: StoreCategoryBase): StoreCategory {
  return {
    external_id: row.external_id,
    name: row.name,
    parent_external_id: row.parent_external_id,
  };
}

function invalidateCategoriesCache(): void {
  try { UnifiedCacheManager.invalidatePattern(/^rq:supplierCategoriesMap(?::|$)/); } catch {}
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export const CategoryService = {
  
  // 0. Read specific category by internal id
  async getById(id: string | number): Promise<StoreCategoryFull | null> {
    const idNum = castNullableNumber(id);
    if (idNum === undefined) return null;
    const resp = await invokeEdgeWithAuth<{ item?: StoreCategoryFullRow | null }>("categories", {
      action: "get_by_id",
      id: idNum,
    });
    if (!resp.item) return null;
    return toFull(resp.item);
  },

  // 0a. Read category name by internal id (safe)
  async getNameByIdSafe(id: number | string): Promise<string | null> {
    const idNum = castNullableNumber(id);
    if (idNum === undefined) return null;
    const resp = await invokeEdgeWithAuth<{ name?: string | null }>("categories", { action: "get_name_by_id", id: idNum });
    return resp.name ?? null;
  },
  // 4. Get all categories of supplier
  async listCategories(supplierId?: string | number): Promise<StoreCategory[]> {
    const sel = categoriesSelect("external_id,name,parent_external_id", supplierId);
    const resp = await invokeEdgeWithAuth<{ rows?: StoreCategoryBase[] }>("categories", {
      action: "list",
      supplier_id: sel.supplierId,
    });
    const rows = resp.rows ?? [];
    return rows.map(toBase);
  },

  // 1–2. Create category or subcategory
  async createCategory(input: CreateCategoryInput): Promise<StoreCategory> {
    const payload = {
      supplier_id: castNullableNumber(input.supplier_id),
      external_id: input.external_id,
      name: input.name,
      parent_external_id: input.parent_external_id ?? null,
    };
    const resp = await invokeEdgeWithAuth<{ item: StoreCategoryBase }>("categories", { action: "create", data: payload });
    invalidateCategoriesCache();
    return toBase(resp.item);
  },

  // 3. Bulk create
  async bulkCreate(items: CreateCategoryInput[]): Promise<StoreCategory[]> {
    if (!items || items.length === 0) return [];
    const payload = items.map((it) => ({
      supplier_id: castNullableNumber(it.supplier_id),
      external_id: it.external_id,
      name: it.name,
      parent_external_id: it.parent_external_id ?? null,
    }));
    const resp = await invokeEdgeWithAuth<{ rows?: StoreCategoryBase[] }>("categories", { action: "bulk_create", items: payload });
    const rows = resp.rows ?? [];
    invalidateCategoriesCache();
    return rows.map(toBase);
  },

  // 4. Read all categories for supplier (full shape including id)
  async getSupplierCategories(supplierId: string | number): Promise<StoreCategoryFull[]> {
    const sel = categoriesSelect("id,external_id,name,parent_external_id,supplier_id", supplierId);
    const resp = await invokeEdgeWithAuth<{ rows?: StoreCategoryFullRow[] }>("categories", {
      action: "get_supplier_categories",
      supplier_id: sel.supplierId,
    });
    const rows = resp.rows ?? [];
    return rows.map(toFull);
  },

  // Aggregated: read categories for multiple suppliers in one request and return a map
  async getCategoriesMapForSuppliers(supplierIds: Array<string | number>): Promise<Record<string, StoreCategoryFull[]>> {
    const ids = Array.from(new Set((supplierIds || []).map(String).filter(Boolean)));
    if (ids.length === 0) return {};
    const uid = await SessionValidator.validateSession()
      .then((v) => (v?.user?.id ? String(v.user.id) : "current"))
      .catch(() => "current");
    const cacheKey = `rq:supplierCategoriesMap:${uid || "current"}`;
    const env = readCache<Record<string, StoreCategoryFull[]>>(cacheKey, false);
    if (env?.data && typeof env.data === "object") {
      return env.data;
    }

    const numericIds = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    const map: Record<string, StoreCategoryFull[]> = {};
    const batches = chunk(numericIds, 20);
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (supplierId) => {
          const resp = await invokeEdgeWithAuth<{ rows?: StoreCategoryFullRow[] }>("categories", {
            action: "get_supplier_categories",
            supplier_id: supplierId,
          });
          return { supplierId: String(supplierId), rows: resp.rows ?? [] };
        }),
      );
      for (const r of results) {
        map[r.supplierId] = r.rows.map(toFull);
      }
    }

    writeCache(cacheKey, map, CACHE_TTL.supplierCategoriesMap);
    return map;
  },

  // 5. Read subcategories of a specific category
  async getSubcategories(supplierId: string | number, parentExternalId: string): Promise<StoreCategoryFull[]> {
    const normalized = castNullableNumber(supplierId);
    const resp = await invokeEdgeWithAuth<{ rows?: StoreCategoryFullRow[] }>("categories", {
      action: "get_subcategories",
      supplier_id: normalized,
      parent_external_id: parentExternalId,
    });
    const rows = resp.rows ?? [];
    return rows.map(toFull);
  },

  // 6. Read specific category by external_id
  async getByExternalId(supplierId: string | number, externalId: string): Promise<StoreCategoryFull | null> {
    const normalized = castNullableNumber(supplierId);
    const resp = await invokeEdgeWithAuth<{ item?: StoreCategoryFullRow | null }>("categories", {
      action: "get_by_external_id",
      supplier_id: normalized,
      external_id: externalId,
    });
    if (!resp.item) return null;
    return toFull(resp.item);
  },

  // 7. Update category name by external_id and supplier_id
  async updateName(supplierId: string | number, externalId: string, name: string): Promise<StoreCategory> {
    const normalized = castNullableNumber(supplierId);
    if (normalized === undefined) {
      throw new Error("Invalid supplierId");
    }
    const resp = await invokeEdgeWithAuth<{ item: StoreCategoryBase }>("categories", {
      action: "update_name",
      supplier_id: normalized,
      external_id: externalId,
      name,
    });
    invalidateCategoriesCache();
    return toBase(resp.item);
  },

  // 8. Delete category by external_id and supplier_id
  async deleteCategory(supplierId: string | number, externalId: string): Promise<boolean> {
    const normalized = castNullableNumber(supplierId);
    if (normalized === undefined) {
      throw new Error("Invalid supplierId");
    }
    await invokeEdgeWithAuth<{ ok: boolean }>("categories", {
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
    await invokeEdgeWithAuth<{ ok: boolean }>("categories", {
      action: "delete_cascade",
      supplier_id: normalized,
      external_id: externalId,
    });
    invalidateCategoriesCache();
    return true;
  },
};
