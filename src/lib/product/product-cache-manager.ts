import type { ProductAggregated } from "@/lib/product-service";
import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";
import { SessionValidator } from "@/lib/session-validation";

type ProductListPage = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  total: number;
};

type ProductsPageResponse = {
  products: ProductAggregated[];
  page: ProductListPage;
};

export class ProductCacheManager {
  private static readonly SOFT_REFRESH_THRESHOLD_MS = 120_000;

  private static cache = UnifiedCacheManager.create("rq:productsPage", {
    mode: "auto",
    defaultTtlMs: CACHE_TTL.productsPage,
  });

  private static seenKeys = new Set<string>();

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

  private static makePageKey(params: {
    userId: string;
    storeId: string;
    limit: number;
    offset: number;
  }): string {
    return `page:${params.userId}:${params.storeId}:${params.limit}:${params.offset}`;
  }

  static async getProductsPageCached(
    storeId: string | null,
    limit: number,
    offset: number,
    fetchFresh: () => Promise<ProductsPageResponse>,
    options?: { bypassCache?: boolean },
  ): Promise<ProductsPageResponse> {
    const uid = await ProductCacheManager.getUserKeyPart();
    const sid = ProductCacheManager.normalizeStoreId(storeId);
    const key = ProductCacheManager.makePageKey({ userId: uid, storeId: sid, limit, offset });

    if (options?.bypassCache !== true) {
      const env = ProductCacheManager.cache.getEnvelope<ProductsPageResponse>(key, false);
      if (env?.data && Array.isArray(env.data.products) && env.data.page) {
        const timeLeft = env.expiresAt - Date.now();
        if (timeLeft > 0) {
          ProductCacheManager.seenKeys.add(key);
          if (timeLeft < ProductCacheManager.SOFT_REFRESH_THRESHOLD_MS) {
            void fetchFresh()
              .then((fresh) => {
                ProductCacheManager.cache.set(key, fresh, CACHE_TTL.productsPage);
                ProductCacheManager.seenKeys.add(key);
              })
              .catch(() => void 0);
          }
          return env.data;
        }
      }
    }

    const fresh = await fetchFresh();
    ProductCacheManager.cache.set(key, fresh, CACHE_TTL.productsPage);
    ProductCacheManager.seenKeys.add(key);
    return fresh;
  }

  static updateFirstPageCaches(storeId: string | null, mutate: (items: unknown[]) => unknown[]) {
    const sid = ProductCacheManager.normalizeStoreId(storeId);
    for (const key of Array.from(ProductCacheManager.seenKeys)) {
      if (!key.startsWith("page:")) continue;
      const parts = key.split(":");
      if (parts.length !== 5) continue;
      const storePart = parts[2];
      const offsetPart = parts[4];
      if (storePart !== sid) continue;
      if (offsetPart !== "0") continue;
      const cached = ProductCacheManager.cache.get<ProductsPageResponse>(key, false);
      if (!cached || !Array.isArray(cached.products)) continue;
      const updatedProducts = mutate(cached.products as unknown as unknown[]);
      if (!Array.isArray(updatedProducts)) continue;
      ProductCacheManager.cache.set(
        key,
        { ...cached, products: updatedProducts as unknown as ProductAggregated[] },
        CACHE_TTL.productsPage,
      );
    }
  }

  static patchProductCaches(
    productId: string,
    patch: Partial<ProductAggregated>,
    storeId?: string | null,
  ) {
    const pid = String(productId);
    const sid = storeId === undefined ? null : storeId;
    const storeFilter = sid == null ? null : ProductCacheManager.normalizeStoreId(sid);
    for (const key of Array.from(ProductCacheManager.seenKeys)) {
      if (!key.startsWith("page:")) continue;
      const parts = key.split(":");
      if (parts.length !== 5) continue;
      const storePart = parts[2];
      if (storeFilter && storePart !== storeFilter) continue;
      const cached = ProductCacheManager.cache.get<ProductsPageResponse>(key, false);
      if (!cached || !Array.isArray(cached.products)) continue;
      let changed = false;
      const next = (cached.products || []).map((p) => {
        if (String(p?.id) !== pid) return p;
        changed = true;
        return { ...p, ...patch };
      });
      if (!changed) continue;
      ProductCacheManager.cache.set(key, { ...cached, products: next }, CACHE_TTL.productsPage);
    }
  }

  static clearAllFirstPageCaches() {
    ProductCacheManager.cache.clearWhere((k) => {
      if (!k.startsWith("page:")) return false;
      const parts = k.split(":");
      return parts.length === 5 && parts[4] === "0";
    });
    for (const k of Array.from(ProductCacheManager.seenKeys)) {
      if (!k.startsWith("page:")) continue;
      const parts = k.split(":");
      if (parts.length === 5 && parts[4] === "0") ProductCacheManager.seenKeys.delete(k);
    }
  }

  static clearMasterProductsCaches(): void {
    ProductCacheManager.cache.clearWhere((k) => {
      if (!k.startsWith("page:")) return false;
      const parts = k.split(":");
      return parts.length === 5 && parts[2] === "master";
    });
    for (const k of Array.from(ProductCacheManager.seenKeys)) {
      if (!k.startsWith("page:")) continue;
      const parts = k.split(":");
      if (parts.length === 5 && parts[2] === "master") ProductCacheManager.seenKeys.delete(k);
    }
  }

  static clearStoreProductsCaches(storeId: string): void {
    const sid = ProductCacheManager.normalizeStoreId(storeId);
    ProductCacheManager.cache.clearWhere((k) => {
      if (!k.startsWith("page:")) return false;
      const parts = k.split(":");
      return parts.length === 5 && parts[2] === sid;
    });
    for (const k of Array.from(ProductCacheManager.seenKeys)) {
      if (!k.startsWith("page:")) continue;
      const parts = k.split(":");
      if (parts.length === 5 && parts[2] === sid) ProductCacheManager.seenKeys.delete(k);
    }
  }

  static clearAllProductsCaches(): void {
    ProductCacheManager.cache.clearAll();
    ProductCacheManager.seenKeys.clear();
  }
}
