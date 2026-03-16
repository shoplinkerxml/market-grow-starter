import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";
import { SessionValidator } from "@/lib/session-validation";
import { invokeEdge } from "./product-utils";
import { 
  Product, 
  ProductAggregated, 
  ProductListPage, 
  ProductListResponseObj 
} from "./types";

type ProductsPageResponse = {
  products: ProductAggregated[];
  page: ProductListPage;
};

export class ProductListService {
  private static readonly SOFT_REFRESH_THRESHOLD_MS = 120_000;

  private static readonly productsPageCache = UnifiedCacheManager.create("products_v2", {
    mode: "auto",
    defaultTtlMs: CACHE_TTL.productsPage,
  });

  private static normalizeStoreId(storeId: string | null | undefined): string {
    const s = storeId ? String(storeId) : "";
    return s.trim() === "" ? "master" : s;
  }

  private static async getUserKeyPart(): Promise<string> {
    try {
      const v = await SessionValidator.validateSession();
      return v?.user?.id ? String(v.user.id) : "current";
    } catch {
      return "current";
    }
  }

  private static makePageKey(params: { userId: string; storeId: string; limit: number; offset: number }): string {
    return `page:${params.userId}.${params.storeId}.${params.limit}:${params.offset}`;
  }

  private static parsePageKey(subKey: string): { userId: string; storeId: string; limit: number; offset: number } | null {
    if (!subKey.startsWith("page:")) return null;
    const parts = subKey.split(":");
    if (parts.length !== 3) return null;
    const meta = parts[1] ?? "";
    const offsetStr = parts[2] ?? "";
    const metaParts = meta.split(".");
    if (metaParts.length < 3) return null;
    const userId = metaParts[0] ?? "";
    const storeId = metaParts[1] ?? "";
    const limit = Number(metaParts[2] ?? "");
    const offset = Number(offsetStr);
    if (!userId || !storeId) return null;
    if (!Number.isFinite(limit) || limit <= 0) return null;
    if (!Number.isFinite(offset) || offset < 0) return null;
    return { userId, storeId, limit, offset };
  }

  static clearAllProductsCaches(): void {
    ProductListService.productsPageCache.clearWhere(() => true);
  }

  static clearAllFirstPageCaches(): void {
    ProductListService.productsPageCache.clearWhere((k) => {
      const parsed = ProductListService.parsePageKey(k);
      return parsed != null && parsed.offset === 0;
    });
  }

  static clearMasterProductsCaches(): void {
    ProductListService.productsPageCache.clearWhere((k) => {
      const parsed = ProductListService.parsePageKey(k);
      return parsed != null && parsed.storeId === "master";
    });
  }

  static clearStoreProductsCaches(storeId: string): void {
    const sid = ProductListService.normalizeStoreId(storeId);
    ProductListService.productsPageCache.clearWhere((k) => {
      const parsed = ProductListService.parsePageKey(k);
      return parsed != null && parsed.storeId === sid;
    });
  }

  static updateFirstPageCaches(storeId: string | null, mutate: (items: unknown[]) => unknown[]) {
    const sid = ProductListService.normalizeStoreId(storeId);
    ProductListService.productsPageCache.updateWhere<ProductsPageResponse>(
      (k) => {
        const parsed = ProductListService.parsePageKey(k);
        return parsed != null && parsed.storeId === sid && parsed.offset === 0;
      },
      (cached) => {
        if (!cached || !Array.isArray(cached.products)) return cached;
        const updatedProducts = mutate(cached.products as unknown as unknown[]);
        if (!Array.isArray(updatedProducts)) return cached;
        return { ...cached, products: updatedProducts as unknown as ProductAggregated[] };
      },
      CACHE_TTL.productsPage,
    );
  }

  static patchProductCaches(productId: string, patch: Partial<ProductAggregated>, storeId?: string | null) {
    const pid = String(productId);
    const sid = storeId === undefined ? null : storeId;
    const storeFilter = sid == null ? null : ProductListService.normalizeStoreId(sid);
    ProductListService.productsPageCache.updateWhere<ProductsPageResponse>(
      (k) => {
        const parsed = ProductListService.parsePageKey(k);
        if (!parsed) return false;
        if (parsed.offset !== 0) return false;
        if (storeFilter && parsed.storeId !== storeFilter) return false;
        return true;
      },
      (cached) => {
        if (!cached || !Array.isArray(cached.products)) return cached;
        let changed = false;
        const next = (cached.products || []).map((p) => {
          if (String((p as any)?.id) !== pid) return p;
          changed = true;
          return { ...(p as any), ...patch } as ProductAggregated;
        });
        if (!changed) return cached;
        return { ...cached, products: next };
      },
      CACHE_TTL.productsPage,
    );
  }

  static async getUserMasterProducts(): Promise<ProductAggregated[]> {
    const resp = await invokeEdge<ProductListResponseObj>("user-products-list", { bypassCache: true });
    const rows = Array.isArray(resp?.products) ? resp.products : [];
    return rows;
  }

  static async getStoreProducts(storeId: string): Promise<ProductAggregated[]> {
    if (!storeId || storeId.trim() === "") {
      throw new Error("Store ID is required");
    }
    const resp = await invokeEdge<ProductListResponseObj>("store-products-list", {
      store_id: String(storeId),
      bypassCache: true,
    });
    const rows = Array.isArray(resp?.products) ? resp.products : [];
    return rows;
  }

  static async getUserMasterProductsPage(
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    const fresh = await invokeEdge<ProductListResponseObj>("user-products-list", {
      limit,
      offset: 0,
      bypassCache: options?.bypassCache === true,
    });
    const products = Array.isArray(fresh?.products) ? fresh.products : [];
    const page: ProductListPage = {
      limit,
      offset: 0,
      hasMore: !!fresh?.page?.hasMore,
      nextOffset: fresh?.page?.nextOffset ?? null,
      total: fresh?.page?.total ?? products.length,
    };
    return { products, page };
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

    const fresh = await invokeEdge<ProductListResponseObj>("store-products-list", {
      store_id: String(storeId),
      limit,
      offset: 0,
      bypassCache: options?.bypassCache === true,
    });
    const products = Array.isArray(fresh?.products) ? fresh.products : [];
    const page: ProductListPage = {
      limit,
      offset: 0,
      hasMore: !!fresh?.page?.hasMore,
      nextOffset: fresh?.page?.nextOffset ?? null,
      total: fresh?.page?.total ?? products.length,
    };
    return { products, page };
  }

  static async getProductsPage(
    storeId: string | null,
    limit: number,
    offset: number,
    options?: { bypassCache?: boolean; force?: boolean },
  ): Promise<ProductsPageResponse> {
    if (options?.force) {
      try {
        ProductListService.clearAllProductsCaches();
      } catch {
        void 0;
      }
    }

    const uid = await ProductListService.getUserKeyPart();
    const sid = ProductListService.normalizeStoreId(storeId);
    const key = ProductListService.makePageKey({ userId: uid, storeId: sid, limit, offset });

    const fetchFresh = async (): Promise<ProductsPageResponse> => {
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
    };

    if (offset !== 0) {
      return await fetchFresh();
    }

    return await ProductListService.productsPageCache.getOrFetch<ProductsPageResponse>(key, fetchFresh, {
      bypassCache: options?.bypassCache || options?.force,
      ttlMs: CACHE_TTL.productsPage,
      softRefreshThresholdMs: ProductListService.SOFT_REFRESH_THRESHOLD_MS,
    });
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
