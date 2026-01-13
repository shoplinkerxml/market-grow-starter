import type { QueryClient } from "@tanstack/react-query";

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
  invalidate(
    queryClient: QueryClient,
    userId: string,
    storeIds?: string[] | string | null,
    reason?: string,
  ) {
    const uid = userId ? String(userId) : "current";
    const ids = Array.isArray(storeIds)
      ? storeIds.map((s) => String(s)).filter(Boolean)
      : storeIds
        ? [String(storeIds)]
        : [];

    console.info("[ShopCountsService] invalidate", { userId: uid, storeIds: ids, reason: reason || "unknown" });

    try {
      import("@/lib/user-auth-service")
        .then(({ UserAuthService }) => {
          UserAuthService.clearAuthMeCache();
        })
        .catch(() => void 0);
    } catch {
      void 0;
    }

    try {
      import("@/lib/persistent-cache-service")
        .then(({ PersistentCacheService }) => {
          PersistentCacheService.invalidateShops();
        })
        .catch(() => void 0);
    } catch {
      void 0;
    }

    try {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"], exact: true });
    } catch {
      void 0;
    }

    try {
      queryClient.invalidateQueries({ queryKey: this.shopsListKey(uid), exact: true });
      queryClient.invalidateQueries({ queryKey: this.shopsMenuKey(uid), exact: true });
    } catch {
      void 0;
    }

    for (const storeId of ids) {
      try {
        queryClient.invalidateQueries({ queryKey: this.shopDetailKey(uid, storeId), exact: true });
      } catch {
        void 0;
      }
      try {
        queryClient.removeQueries({ queryKey: this.key(uid, storeId), exact: true });
      } catch {
        void 0;
      }
    }
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
};
