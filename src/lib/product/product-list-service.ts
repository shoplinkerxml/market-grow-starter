import { SessionValidator } from "@/lib/session-validation";
import { invokeEdge } from "./product-utils";
import { ProductCacheManager } from "./product-cache-manager";
import { 
  Product, 
  ProductAggregated, 
  ProductListPage, 
  ProductListResponseObj 
} from "./types";

export class ProductListService {
  static async getUserMasterProducts(): Promise<ProductAggregated[]> {
    try {
      const resp = await invokeEdge<ProductListResponseObj>("user-products-list", {});
      const rows = Array.isArray(resp?.products) ? resp.products! : [];
      return rows;
    } catch {
      const fb = await ProductListService.fetchProductsPageFallback(null, 50, 0);
      return fb.products;
    }
  }

  static async getStoreProducts(storeId: string): Promise<ProductAggregated[]> {
    if (!storeId || storeId.trim() === "") {
      throw new Error("Store ID is required");
    }
    try {
      const resp = await invokeEdge<ProductListResponseObj>("store-products-list", {
        store_id: String(storeId),
      });
      const rows = Array.isArray(resp?.products) ? resp.products! : [];
      return rows;
    } catch {
      const fb = await ProductListService.fetchProductsPageFallback(String(storeId), 50, 0);
      return fb.products;
    }
  }

  static async getUserMasterProductsPage(
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    try {
      const fresh = await invokeEdge<ProductListResponseObj>("user-products-list", {
        limit,
        offset: 0,
        bypassCache: options?.bypassCache === true,
      });
      const products = Array.isArray(fresh?.products) ? fresh.products! : [];
      const page: ProductListPage = {
        limit,
        offset: 0,
        hasMore: !!fresh?.page?.hasMore,
        nextOffset: fresh?.page?.nextOffset ?? null,
        total: fresh?.page?.total ?? products.length,
      };
      return { products, page };
    } catch (error) {
      const fb = await ProductListService.fetchProductsPageFallback(null, limit, 0);
      return fb;
    }
  }

  static async getStoreProductsPage(
    storeId: string,
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    if (!storeId || storeId.trim() === "") {
      throw new Error("Store ID is required");
    }

    try {
      const fresh = await invokeEdge<ProductListResponseObj>("store-products-list", {
        store_id: String(storeId),
        limit,
        offset: 0,
        bypassCache: options?.bypassCache === true,
      });
      const products = Array.isArray(fresh?.products) ? fresh.products! : [];
      const page: ProductListPage = {
        limit,
        offset: 0,
        hasMore: !!fresh?.page?.hasMore,
        nextOffset: fresh?.page?.nextOffset ?? null,
        total: fresh?.page?.total ?? products.length,
      };
      return { products, page };
    } catch (error) {
      const fb = await ProductListService.fetchProductsPageFallback(String(storeId), limit, 0);
      return fb;
    }
  }

  private static async fetchProductsPageFallback(
    storeId: string | null,
    limit: number,
    offset: number,
  ): Promise<{ products: ProductAggregated[]; page: ProductListPage }> {
    // Retry with bypassCache=true, but allow errors to propagate
    const resp = await invokeEdge<ProductListResponseObj>(
      storeId ? "store-products-list" : "user-products-list",
      {
        ...(storeId ? { store_id: String(storeId) } : {}),
        limit,
        offset,
        bypassCache: true,
      },
    );
    const products = Array.isArray(resp?.products) ? resp.products : [];
    const page: ProductListPage = {
      limit,
      offset,
      hasMore: !!resp?.page?.hasMore,
      nextOffset: resp?.page?.nextOffset ?? null,
      total: resp?.page?.total ?? products.length,
    };
    return { products, page };
  }

  static async getProductsPage(
    storeId: string | null,
    limit: number,
    offset: number,
    options?: { bypassCache?: boolean; force?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: {
      limit: number;
      offset: number;
      hasMore: boolean;
      nextOffset: number | null;
      total: number;
    };
  }> {
    if (options?.force) {
      try {
        ProductCacheManager.clearAllProductsCaches();
      } catch {
        void 0;
      }
    }
    return await ProductCacheManager.getProductsPageCached(
      storeId,
      limit,
      offset,
      async () => {
        // Direct call without swallowing errors.
        // If invokeEdge fails, it should throw, preventing cache from storing empty data.
        const resp = await invokeEdge<ProductListResponseObj>(storeId ? "store-products-list" : "user-products-list", {
          ...(storeId ? { store_id: storeId } : {}),
          limit,
          offset,
          bypassCache: options?.bypassCache || options?.force,
        });
        const products = Array.isArray(resp?.products) ? resp!.products! : [];
        const page: ProductListPage = {
          limit,
          offset,
          hasMore: !!resp?.page?.hasMore,
          nextOffset: resp?.page?.nextOffset ?? null,
          total: resp?.page?.total ?? products.length,
        };
        return { products, page };
      },
      { bypassCache: options?.bypassCache || options?.force }
    );
  }

  /** Полный список продуктов текущего пользователя (по функциям с пагинацией + кэш) */
  static async getProducts(): Promise<Product[]> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }

    const limit = 50;
    let offset = 0;
    const all: ProductAggregated[] = [];

    while (true) {
      const { products, page } = await ProductListService.getProductsPage(null, limit, offset);
      all.push(...products);
      if (!page.hasMore) break;
      if (page.nextOffset == null) break;
      if (page.nextOffset <= offset) break;
      offset = page.nextOffset;
      if (all.length >= 1000) break;
    }

    return all as unknown as Product[];
  }
}
