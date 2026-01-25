import type { StoreProductLink, StoreProductLinkPatchInput } from "@/lib/product-service";
import { SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import { GlobalRequestDeduplicator } from "@/lib/request-deduplicator";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { ShopProductSyncService } from "@/lib/services/shop-product-sync-service";
import { EdgeClient } from "@/lib/request-handler";

export class ProductLinkService {
  private static edgeError(
    error: { context?: { status?: number }; status?: number; statusCode?: number; message?: string } | null,
    fallbackKey: string,
  ): never {
    const status = (error?.context?.status ?? error?.status ?? error?.statusCode) as number | undefined;
    const message = (error?.message as string | undefined) || undefined;
    if (status === 403) throw new ApiError("permission_denied", 403, "PERMISSION_DENIED");
    if (status === 400) throw new ApiError("products_limit_reached", 400, "LIMIT_REACHED");
    if (status === 422) throw new ApiError("validation_error", 422, "VALIDATION_ERROR");
    throw new ApiError(message || fallbackKey, status || 500);
  }

  private static async invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
    try {
      return await EdgeClient.invokeWithRetry<T>(name, body);
    } catch (error) {
      ProductLinkService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  private static async ensureValidSession(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  static async getStoreProductLink(productId: string, storeId: string): Promise<StoreProductLink | null> {
    await ProductLinkService.ensureValidSession();
    const payload = await ProductLinkService.invokeEdge<{ link?: StoreProductLink | null }>("product-edit-data", {
      product_id: String(productId),
      store_id: String(storeId),
    });
    return payload?.link ?? null;
  }

  static async updateStoreProductLink(
    productId: string,
    storeId: string,
    patch: Partial<StoreProductLinkPatchInput>,
  ): Promise<StoreProductLink | null> {
    await ProductLinkService.ensureValidSession();
    try {
      const resp = await EdgeClient.invokeWithRetry<{ link?: StoreProductLink | null }>("update-store-product-link", {
        product_id: productId,
        store_id: storeId,
        patch,
      });
      return resp?.link ?? null;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 403) throw new Error("Недостатньо прав");
      const msg = (error as { message?: string } | null)?.message || "update_failed";
      throw new Error(msg);
    }
  }

  static async removeStoreProductLink(productId: string, storeId: string): Promise<void> {
    await ProductLinkService.ensureValidSession();
    try {
      await EdgeClient.invokeWithRetry<unknown>("bulk-remove-store-product-links", {
        product_ids: [productId],
        store_ids: [storeId],
      });
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message || "delete_failed";
      throw new Error(msg);
    }
  }

  static async bulkRemoveStoreProductLinks(
    productIds: string[],
    storeIds: string[],
  ): Promise<{
    deleted: number;
    deletedByStore: Record<string, number>;
    categoryNamesByStore?: Record<string, string[]>;
    deletedProductIds?: string[];
  }> {
    await ProductLinkService.ensureValidSession();
    let out: { 
      deleted?: number; 
      deletedByStore?: Record<string, number>; 
      categoryNamesByStore?: Record<string, string[]>;
      deletedProductIds?: string[];
    };
    try {
      out = await EdgeClient.invokeWithRetry("bulk-remove-store-product-links", { product_ids: productIds, store_ids: storeIds });
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message || "bulk_delete_failed";
      throw new Error(msg);
    }

    try {
      const deletedByStore = out.deletedByStore || {};
      const categoryNamesByStore = out.categoryNamesByStore || {};
      const actualProductIds = Array.isArray(out.deletedProductIds) && out.deletedProductIds.length > 0
        ? out.deletedProductIds.map(String)
        : productIds;

      Promise.resolve()
        .then(async () => {
          await ShopProductSyncService.syncAfterBulkRemove(
            deletedByStore,
            categoryNamesByStore,
            actualProductIds,
            storeIds
          );
        })
        .catch((error) => {
          console.error("ProductLinkService.bulkRemoveStoreProductLinks sync failed", error);
        });
    } catch (error) {
      console.error("ProductLinkService.bulkRemoveStoreProductLinks sync failed", error);
    }

    return {
      deleted: out.deleted ?? 0,
      deletedByStore: out.deletedByStore ?? {},
      categoryNamesByStore: out.categoryNamesByStore || {},
      deletedProductIds: Array.isArray(out.deletedProductIds) ? out.deletedProductIds.map(String) : [],
    };
  }

  static async bulkAddStoreProductLinks(payload: Array<{
    product_id: string;
    store_id: string;
    is_active?: boolean;
    custom_price?: number | null;
    custom_price_old?: number | null;
    custom_price_promo?: number | null;
    custom_stock_quantity?: number | null;
    custom_available?: boolean | null;
  }>): Promise<{ inserted: number; addedByStore: Record<string, number>; categoryNamesByStore?: Record<string, string[]> }> {
    await ProductLinkService.ensureValidSession();
    let out: { inserted?: number; addedByStore?: Record<string, number>; categoryNamesByStore?: Record<string, string[]> };
    try {
      out = await EdgeClient.invokeWithRetry("bulk-add-store-product-links", { links: payload });
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message || "bulk_insert_failed";
      throw new Error(msg);
    }

    try {
      const addedByStore = out.addedByStore || {};
      const categoryNamesByStore = out.categoryNamesByStore || {};
      const productIds = Array.from(new Set(payload.map(p => p.product_id)));
      
      await ShopProductSyncService.syncAfterBulkAdd(
        addedByStore,
        categoryNamesByStore,
        productIds,
        payload.map((p) => ({ product_id: String(p.product_id), store_id: String(p.store_id) }))
      );
    } catch (error) {
      console.error("ProductLinkService.bulkAddStoreProductLinks sync failed", error);
    }

    return {
      inserted: out.inserted ?? 0,
      addedByStore: out.addedByStore ?? {},
      categoryNamesByStore: out.categoryNamesByStore || {},
    };
  }

  static async getStoreLinksForProduct(productId: string): Promise<string[]> {
    return await GlobalRequestDeduplicator.dedupeExpensive(
      { service: "ProductLinkService", method: "getStoreLinksForProduct", params: { productId: String(productId) } },
      async (_ctx) => {
        await ProductLinkService.ensureValidSession();
        const payload = await ProductLinkService.invokeEdge<{ store_ids?: string[] }>("get-store-links-for-product", {
          product_id: productId,
        });
        return Array.isArray(payload.store_ids) ? payload.store_ids.map(String) : [];
      },
    );
  }

  static invalidateStoreLinksCache(productId: string) {
    try {
      const key = GlobalRequestDeduplicator.buildKey({
        service: "ProductLinkService",
        method: "getStoreLinksForProduct",
        params: { productId: String(productId) },
      });
      GlobalRequestDeduplicator.remove(key);
    } catch (error) {
      console.error("ProductLinkService.invalidateStoreLinksCache failed", error);
    }
  }
}
