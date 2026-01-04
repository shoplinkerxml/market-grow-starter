import type { QueryClient } from "@tanstack/react-query";
import { ShopService } from "./shop-service";
import type { ShopAggregated } from "./shop-service";
import type { ShopCounts } from "@/types/shop";

export const ShopCountsService = {
  key(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopCounts", storeId] as const;
  },
  shopsListKey(userId: string) {
    return ["user", userId ? String(userId) : "current", "shops"] as const;
  },
  shopDetailKey(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopDetail", storeId] as const;
  },
  set(queryClient: QueryClient, userId: string, storeId: string, counts: ShopCounts) {
    queryClient.setQueryData<ShopCounts>(this.key(userId, storeId), counts);
    queryClient.setQueryData<ShopAggregated[]>(this.shopsListKey(userId), (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((s) =>
        String(s.id) === String(storeId)
          ? { ...s, productsCount: counts.productsCount, categoriesCount: counts.categoriesCount }
          : s
      );
    });
    queryClient.setQueryData<ShopAggregated | null>(this.shopDetailKey(userId, storeId), (prev) => {
      if (prev === undefined) {
        const list = queryClient.getQueryData<ShopAggregated[]>(this.shopsListKey(userId)) || [];
        const fromList = (list || []).find((s) => String(s.id) === String(storeId));
        return fromList
          ? { ...fromList, productsCount: counts.productsCount, categoriesCount: counts.categoriesCount }
          : prev;
      }
      if (prev === null) return null;
      return { ...prev, productsCount: counts.productsCount, categoriesCount: counts.categoriesCount };
    });
  },
  bumpProducts(queryClient: QueryClient, userId: string, storeId: string, delta: number) {
    queryClient.setQueryData<ShopCounts>(this.key(userId, storeId), (old) => {
      const base = old?.productsCount ?? 0;
      const cats = old?.categoriesCount ?? 0;
      const nextProducts = Math.max(0, base + delta);
      const nextCategories = nextProducts === 0 ? 0 : cats;
      return { productsCount: nextProducts, categoriesCount: nextCategories };
    });
    queryClient.setQueryData<ShopAggregated[]>(this.shopsListKey(userId), (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((s) =>
        String(s.id) === String(storeId)
          ? {
              ...s,
              productsCount: Math.max(0, (s.productsCount ?? 0) + delta),
              categoriesCount: Math.max(0, (s.productsCount ?? 0) + delta) === 0 ? 0 : (s.categoriesCount ?? 0),
            }
          : s
      );
    });
    queryClient.setQueryData<ShopAggregated | null>(this.shopDetailKey(userId, storeId), (prev) => {
      if (!prev) return prev;
      const nextProductsCount = Math.max(0, Number(prev.productsCount ?? 0) + delta);
      const nextCategoriesCount = nextProductsCount === 0 ? 0 : Math.max(0, Number(prev.categoriesCount ?? 0));
      return { ...prev, productsCount: nextProductsCount, categoriesCount: nextCategoriesCount };
    });
  },
  async recompute(queryClient: QueryClient, userId: string, storeId: string) {
    const { productsCount, categoriesCount } = await ShopService.recomputeStoreCounts(storeId);
    this.set(queryClient, userId, storeId, { productsCount, categoriesCount });
    return { productsCount, categoriesCount };
  },
};
