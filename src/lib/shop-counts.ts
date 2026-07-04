import type { QueryClient } from "@tanstack/react-query";
import { PersistentCacheService } from "@/lib/persistent-cache-service";

const suppressionTtlMs = 15_000;
const realtimeDeltaSuppressions = new Map<string, { delta: number; ts: number }>();
const userRealtimeSuppressions = new Map<string, number>(); // userId -> expiresAt (ms)

type ShopCountsSyncEvent =
  | {
      type: "shop_counts_invalidate";
      tabId: string;
      ts: number;
      userId: string;
      storeIds: string[];
      reason?: string;
    };

const SYNC_STORAGE_KEY = "mg:sync";

function getTabId(): string {
  try {
    if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    void 0;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const TAB_ID = getTabId();

function broadcastEvent(evt: ShopCountsSyncEvent): void {
  try {
    if (typeof window === "undefined") return;
  } catch {
    return;
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("mg:sync");
      ch.postMessage(evt);
      try {
        ch.close();
      } catch {
        void 0;
      }
    }
  } catch {
    void 0;
  }

  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(evt));
  } catch {
    void 0;
  }
}

function suppressionKey(userId: string, storeId: string) {
  return `${userId ? String(userId) : "current"}:${String(storeId)}`;
}

function cleanupSuppressions(now: number) {
  for (const [k, v] of realtimeDeltaSuppressions) {
    if (now - v.ts > suppressionTtlMs) realtimeDeltaSuppressions.delete(k);
  }
}

export const ShopCountsService = {
  tabId() {
    return TAB_ID;
  },
  syncStorageKey() {
    return SYNC_STORAGE_KEY;
  },
  key(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopCounts", storeId] as const;
  },
  shopsListKey(userId: string) {
    return ["user", userId ? String(userId) : "current", "shops"] as const;
  },
  shopsMenuKey(userId: string) {
    return this.shopsListKey(userId);
  },
  shopDetailKey(userId: string, storeId: string) {
    return ["user", userId ? String(userId) : "current", "shopDetail", storeId] as const;
  },
  invalidate(
    queryClient: QueryClient,
    userId: string,
    storeIds?: string[] | string | null,
    reason?: string,
    opts?: {
      broadcast?: boolean;
      invalidateAuthMe?: boolean;
      invalidatePersistentShops?: boolean;
      invalidateShopsQueries?: boolean;
      refetch?: "active" | "inactive" | "all" | "none" | false;
    },
  ) {
    const uid = userId ? String(userId) : "current";
    const ids = Array.isArray(storeIds)
      ? storeIds.map((s) => String(s)).filter(Boolean)
      : storeIds
        ? [String(storeIds)]
        : [];

    console.info("[ShopCountsService] invalidate", { userId: uid, storeIds: ids, reason: reason || "unknown" });

    const refetchType = opts?.refetch === false ? "none" : opts?.refetch;

    if (opts?.invalidateAuthMe !== false) {
      try {
        import("@/lib/user-auth-service")
          .then(({ UserAuthService }) => {
            UserAuthService.clearAuthMeCache();
          })
          .catch(() => void 0);
      } catch {
        void 0;
      }
    }

    if (opts?.invalidatePersistentShops !== false) {
      try {
        PersistentCacheService.invalidateShops();
      } catch {
        void 0;
      }
    }

    if (opts?.invalidateAuthMe !== false) {
      try {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"], exact: true });
      } catch {
        void 0;
      }
    }

    if (opts?.invalidateShopsQueries !== false) {
      try {
        queryClient.invalidateQueries({
          queryKey: this.shopsListKey(uid),
          exact: true,
          refetchType: refetchType as any,
        });
      } catch {
        void 0;
      }
    }

    try {
      queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard-stats"], exact: true });
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

    if (opts?.broadcast !== false && ids.length > 0) {
      broadcastEvent({
        type: "shop_counts_invalidate",
        tabId: TAB_ID,
        ts: Date.now(),
        userId: uid,
        storeIds: ids,
        reason,
      });
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
  /**
   * Suppress all realtime-driven counter updates for a user for `ms` milliseconds.
   * Used after bulk operations (XML import finish) where explicit cache
   * invalidation happens right after and per-row realtime events would only
   * cause redundant refetches and UI flicker.
   */
  suppressAllRealtimeForUser(userId: string, ms: number = 3000): void {
    const uid = userId ? String(userId) : "current";
    const expiresAt = Date.now() + Math.max(0, ms);
    const prev = userRealtimeSuppressions.get(uid) ?? 0;
    if (expiresAt > prev) userRealtimeSuppressions.set(uid, expiresAt);
  },
  isRealtimeSuppressedForUser(userId: string): boolean {
    const uid = userId ? String(userId) : "current";
    const exp = userRealtimeSuppressions.get(uid);
    if (!exp) return false;
    if (Date.now() > exp) {
      userRealtimeSuppressions.delete(uid);
      return false;
    }
    return true;
  },
};
