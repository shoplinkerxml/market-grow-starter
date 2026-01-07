import type { QueryClient } from "@tanstack/react-query";
import { ShopService } from "./shop-service";
import type { ShopAggregated } from "./shop-service";
import type { ShopCounts } from "@/types/shop";

const suppressionTtlMs = 15_000;
const realtimeDeltaSuppressions = new Map<string, { delta: number; ts: number }>();

function suppressionKey(userId: string, storeId: string) {
  return `${userId ? String(userId) : "current"}:${String(storeId)}`;
}

function cleanupSuppressions(now: number) {
  for (const [k, v] of realtimeDeltaSuppressions) {
    if (now - v.ts > suppressionTtlMs) realtimeDeltaSuppressions.delete(k);
  }
}

export const ShopCountsService = {
  key(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopCounts", storeId] as const;
  },
  shopsListKey(userId: string) {
    return ["user", userId ? String(userId) : "current", "shops"] as const;
  },
  shopsMenuKey(userId: string) {
    return ["user", userId ? String(userId) : "current", "shops", "menu"] as const;
  },
  shopDetailKey(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopDetail", storeId] as const;
  },
  suppressRealtimeProductsDelta(userId: string, storeId: string, delta: number) {
    const d = Number(delta) || 0;
    if (!d) return;
    const now = Date.now();
    cleanupSuppressions(now);
    const k = suppressionKey(userId, storeId);
    const prev = realtimeDeltaSuppressions.get(k);
    const nextDelta = (prev?.delta ?? 0) + d;
    realtimeDeltaSuppressions.set(k, { delta: nextDelta, ts: now });
  },
  consumeRealtimeProductsDelta(userId: string, storeId: string, delta: number): boolean {
    const d = Number(delta) || 0;
    if (!d) return false;
    const now = Date.now();
    cleanupSuppressions(now);
    const k = suppressionKey(userId, storeId);
    const current = realtimeDeltaSuppressions.get(k);
    if (!current?.delta) return false;
    if (Math.sign(current.delta) !== Math.sign(d)) return false;
    if (Math.abs(current.delta) < Math.abs(d)) return false;
    const next = current.delta - d;
    if (!next) {
      realtimeDeltaSuppressions.delete(k);
      return true;
    }
    realtimeDeltaSuppressions.set(k, { delta: next, ts: now });
    return true;
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
    queryClient.setQueryData<ShopAggregated[]>(this.shopsMenuKey(userId), (prev) => {
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
      const list = queryClient.getQueryData<ShopAggregated[]>(this.shopsListKey(userId));
      const fromList = Array.isArray(list) ? (list || []).find((s) => String(s.id) === String(storeId)) : null;
      const fromDetail = queryClient.getQueryData<ShopAggregated | null>(this.shopDetailKey(userId, storeId));
      const base = Number(old?.productsCount ?? fromDetail?.productsCount ?? fromList?.productsCount ?? 0) || 0;
      const cats = Number(old?.categoriesCount ?? fromDetail?.categoriesCount ?? fromList?.categoriesCount ?? 0) || 0;
      const nextProducts = Math.max(0, base + delta);
      const nextCategories = nextProducts === 0 ? 0 : cats;
      return { productsCount: nextProducts, categoriesCount: nextCategories };
    });
    queryClient.setQueryData<ShopAggregated[]>(this.shopsListKey(userId), (prev) => {
      if (!Array.isArray(prev)) return prev;
      const nextCounts = queryClient.getQueryData<ShopCounts>(this.key(userId, storeId));
      return prev.map((s) =>
        String(s.id) === String(storeId)
          ? {
              ...s,
              productsCount:
                nextCounts && typeof nextCounts.productsCount === "number"
                  ? Math.max(0, nextCounts.productsCount)
                  : Math.max(0, (s.productsCount ?? 0) + delta),
              categoriesCount:
                nextCounts && typeof nextCounts.categoriesCount === "number"
                  ? Math.max(0, nextCounts.productsCount) === 0
                    ? 0
                    : Math.max(0, nextCounts.categoriesCount)
                  : Math.max(0, (s.productsCount ?? 0) + delta) === 0
                    ? 0
                    : (s.categoriesCount ?? 0),
            }
          : s
      );
    });
    queryClient.setQueryData<ShopAggregated[]>(this.shopsMenuKey(userId), (prev) => {
      if (!Array.isArray(prev)) return prev;
      const nextCounts = queryClient.getQueryData<ShopCounts>(this.key(userId, storeId));
      return prev.map((s) =>
        String(s.id) === String(storeId)
          ? {
              ...s,
              productsCount:
                nextCounts && typeof nextCounts.productsCount === "number"
                  ? Math.max(0, nextCounts.productsCount)
                  : Math.max(0, (s.productsCount ?? 0) + delta),
              categoriesCount:
                nextCounts && typeof nextCounts.categoriesCount === "number"
                  ? Math.max(0, nextCounts.productsCount) === 0
                    ? 0
                    : Math.max(0, nextCounts.categoriesCount)
                  : Math.max(0, (s.productsCount ?? 0) + delta) === 0
                    ? 0
                    : (s.categoriesCount ?? 0),
            }
          : s
      );
    });
    queryClient.setQueryData<ShopAggregated | null>(this.shopDetailKey(userId, storeId), (prev) => {
      if (!prev) return prev;
      const nextCounts = queryClient.getQueryData<ShopCounts>(this.key(userId, storeId));
      if (nextCounts && typeof nextCounts.productsCount === "number" && typeof nextCounts.categoriesCount === "number") {
        const productsCount = Math.max(0, nextCounts.productsCount);
        const categoriesCount = productsCount === 0 ? 0 : Math.max(0, nextCounts.categoriesCount);
        return { ...prev, productsCount, categoriesCount };
      }
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
