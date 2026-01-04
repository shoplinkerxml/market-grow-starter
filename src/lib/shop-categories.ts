import { ShopServiceCore, type StoreCategory } from "./shop-core";

interface CategoryRow {
  id: number;
  store_id: string;
  category_id: number;
  custom_name?: string | null;
  external_id?: string | null;
  rz_id_value?: string | null;
  is_active: boolean;
  store_categories?: {
    name?: string;
    external_id?: string | null;
    parent_external_id?: string | null;
    rz_id?: string | null;
  };
}

export class ShopCategoriesService extends ShopServiceCore {
  static async getStoreCategories(storeId: string): Promise<StoreCategory[]> {
    if (!storeId) throw new Error("Store ID is required");

    await this.ensureSession();

    const response = await this.invokeEdge<{ rows: CategoryRow[] }>("store-categories-list", {
      store_id: storeId,
    });

    return (response.rows || []).map((row) => ({
      store_category_id: row.id,
      store_id: row.store_id,
      category_id: row.category_id,
      name: row.custom_name || row.store_categories?.name || "",
      base_external_id: row.store_categories?.external_id || null,
      parent_external_id: row.store_categories?.parent_external_id || null,
      base_rz_id: row.store_categories?.rz_id || null,
      store_external_id: row.external_id || null,
      store_rz_id_value: row.rz_id_value || null,
      is_active: row.is_active,
    }));
  }

  static async updateStoreCategory(payload: {
    id: number;
    rz_id_value?: string | null;
    is_active?: boolean;
    custom_name?: string | null;
    external_id?: string | null;
  }): Promise<void> {
    if (!payload?.id) throw new Error("Category ID is required");

    const patch: Record<string, unknown> = {};

    if (payload.rz_id_value !== undefined) patch.rz_id_value = payload.rz_id_value;
    if (payload.is_active !== undefined) patch.is_active = payload.is_active;
    if (payload.custom_name !== undefined) patch.custom_name = payload.custom_name;
    if (payload.external_id !== undefined) patch.external_id = payload.external_id;

    await this.invokeEdge("update-store-category", { id: payload.id, patch });
  }

  static async deleteStoreCategoryWithProducts(storeId: string, categoryId: number): Promise<void> {
    if (!storeId || !categoryId) {
      throw new Error("Store ID and Category ID are required");
    }

    await this.invokeEdge("delete-store-category-with-products", {
      store_id: storeId,
      category_id: categoryId,
    });
  }

  static async deleteStoreCategoriesWithProducts(storeId: string, categoryIds: number[]): Promise<void> {
    if (!storeId || !categoryIds?.length) return;

    await this.invokeEdge("delete-store-categories-with-products", {
      store_id: storeId,
      category_ids: categoryIds,
    });
  }

  static async ensureStoreCategory(
    storeId: string,
    categoryId: number,
    options?: { external_id?: string | null; custom_name?: string | null }
  ): Promise<number | null> {
    if (!storeId || !Number.isFinite(categoryId)) {
      throw new Error("Valid Store ID and Category ID are required");
    }

    await this.ensureSession();

    const response = await this.invokeEdge<{ id?: number }>("ensure-store-category", {
      store_id: storeId,
      category_id: categoryId,
      external_id: options?.external_id ?? null,
      custom_name: options?.custom_name ?? null,
    });

    return response.id != null ? Number(response.id) : null;
  }

  static async getStoreCategoryExternalId(storeId: string, categoryId: number): Promise<string | null> {
    if (!storeId || !Number.isFinite(categoryId)) {
      throw new Error("Valid Store ID and Category ID are required");
    }

    const response = await this.invokeEdge<{ external_id?: string | null }>("get-store-category-external-id", {
      store_id: storeId,
      category_id: categoryId,
    });

    return response.external_id || null;
  }

  static async cleanupUnusedStoreCategory(storeId: string, categoryId: number): Promise<void> {
    if (!storeId || !Number.isFinite(categoryId)) return;

    await this.invokeEdge("cleanup-unused-store-category", {
      store_id: storeId,
      category_id: categoryId,
    });
  }
}

