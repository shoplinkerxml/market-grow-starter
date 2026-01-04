import type { StoreProductLink, StoreProductLinkPatchInput } from "@/lib/product-service";
import { invokeEdgeWithAuth, SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import { RequestDeduplicatorFactory } from "@/lib/request-deduplicator";

export class ProductLinkService {
  private static readonly INFLIGHT_LINKS_MAX_SIZE = 200;
  private static linksByProductDeduplicator = RequestDeduplicatorFactory.create<string[]>("product-link-service:linksByProduct", {
    ttl: 30_000,
    maxSize: ProductLinkService.INFLIGHT_LINKS_MAX_SIZE,
    enableMetrics: true,
    errorStrategy: "remove",
  });

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
      return await invokeEdgeWithAuth<T>(name, body);
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
      const resp = await invokeEdgeWithAuth<{ link?: StoreProductLink | null }>("update-store-product-link", {
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
      await invokeEdgeWithAuth<unknown>("bulk-remove-store-product-links", {
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
  }> {
    await ProductLinkService.ensureValidSession();
    let out: { deleted?: number; deletedByStore?: Record<string, number>; categoryNamesByStore?: Record<string, string[]> };
    try {
      out = await invokeEdgeWithAuth("bulk-remove-store-product-links", { product_ids: productIds, store_ids: storeIds });
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message || "bulk_delete_failed";
      throw new Error(msg);
    }

    try {
      const { ShopService } = await import("@/lib/shop-service");
      const catsByStore = out.categoryNamesByStore || {};
      for (const sid of Object.keys(catsByStore)) {
        const cnt = Array.isArray(catsByStore[sid]) ? catsByStore[sid].length : 0;
        ShopService.setCategoriesCountInCache(String(sid), cnt);
      }
    } catch (error) {
      console.error("ProductLinkService.bulkRemoveStoreProductLinks ShopService sync failed", error);
    }

    return {
      deleted: out.deleted ?? 0,
      deletedByStore: out.deletedByStore ?? {},
      categoryNamesByStore: out.categoryNamesByStore || {},
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
      out = await invokeEdgeWithAuth("bulk-add-store-product-links", { links: payload });
    } catch (error) {
      const msg = (error as { message?: string } | null)?.message || "bulk_insert_failed";
      throw new Error(msg);
    }

    try {
      const { ShopService } = await import("@/lib/shop-service");
      const catsByStore = out.categoryNamesByStore || {};
      for (const sid of Object.keys(catsByStore)) {
        const cnt = Array.isArray(catsByStore[sid]) ? catsByStore[sid].length : 0;
        ShopService.setCategoriesCountInCache(String(sid), cnt);
      }
    } catch (error) {
      console.error("ProductLinkService.bulkAddStoreProductLinks ShopService sync failed", error);
    }

    return {
      inserted: out.inserted ?? 0,
      addedByStore: out.addedByStore ?? {},
      categoryNamesByStore: out.categoryNamesByStore || {},
    };
  }

  static async getStoreLinksForProduct(productId: string): Promise<string[]> {
    return await ProductLinkService.linksByProductDeduplicator.dedupe(productId, async () => {
      await ProductLinkService.ensureValidSession();
      const payload = await ProductLinkService.invokeEdge<{ store_ids?: string[] }>("get-store-links-for-product", {
        product_id: productId,
      });
      return Array.isArray(payload.store_ids) ? payload.store_ids.map(String) : [];
    });
  }

  static invalidateStoreLinksCache(productId: string) {
    try {
      ProductLinkService.linksByProductDeduplicator.remove(productId);
    } catch (error) {
      console.error("ProductLinkService.invalidateStoreLinksCache failed", error);
    }
  }
}
