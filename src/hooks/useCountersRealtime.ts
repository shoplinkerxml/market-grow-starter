import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopCountsService } from "@/lib/shop-counts";
import { DashboardService } from "@/lib/dashboard-service";

const COUNTERS_MUTATION_EVENT = "counters-mutation";
const SUPPRESSION_WINDOW_MS = 3000;

/**
 * Use this after local mutations that are known to affect counters,
 * so incoming Realtime events won't momentarily overwrite local cache.
 */
export function dispatchCountersMutation(entityIds: string[]) {
  window.dispatchEvent(new CustomEvent(COUNTERS_MUTATION_EVENT, { detail: { entityIds } }));
}

type CounterRow = {
  id: string;
  entity_id: string;
  counter_type: string;
  count: number;
  updated_at: string;
};

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: CounterRow | null;
  old: CounterRow | null;
};

function parseStoreEntityId(entityId: string): { storeId: string; kind: "products" | "categories" } | null {
  // Expected: store:<storeId>:products | store:<storeId>:categories
  const parts = String(entityId || "").split(":");
  if (parts.length !== 3) return null;
  if (parts[0] !== "store") return null;
  const storeId = parts[1];
  const kind = parts[2];
  if (!storeId) return null;
  if (kind !== "products" && kind !== "categories") return null;
  return { storeId, kind };
}

/**
 * Realtime subscription to table `counters`.
 * Updates react-query cache for shops counts and invalidates dashboard stats.
 */
export function useCountersRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const suppressedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, { products?: number; categories?: number }>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!userId) return;
    const uid = String(userId);

    const pending = pendingRef.current;
    if (pending.size === 0) return;

    for (const [storeId, v] of pending.entries()) {
      const productsCount = v.products ?? 0;
      const categoriesCount = productsCount === 0 ? 0 : (v.categories ?? 0);
      ShopCountsService.set(queryClient, uid, storeId, { productsCount, categoriesCount });
    }

    // Dashboard stats use their own memory cache -> clear + invalidate react-query
    try {
      DashboardService.clearCache();
    } catch {
      void 0;
    }
    queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard-stats"], exact: true });

    pending.clear();
  }, [queryClient, userId]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
      timerRef.current = null;
    }, 100);
  }, [flush]);

  useEffect(() => {
    if (!userId) return;
    const uid = String(userId);

    const handleLocalMutation = (e: CustomEvent<{ entityIds: string[] }>) => {
      const ids = e.detail?.entityIds || [];
      ids.forEach((id) => suppressedRef.current.add(String(id)));
      setTimeout(() => ids.forEach((id) => suppressedRef.current.delete(String(id))), SUPPRESSION_WINDOW_MS);
    };
    window.addEventListener(COUNTERS_MUTATION_EVENT as any, handleLocalMutation as EventListener);

    const handleChange = (payload: RealtimePayload) => {
      const row = payload.new || payload.old;
      if (!row?.entity_id) return;

      const entityId = String(row.entity_id);
      if (suppressedRef.current.has(entityId)) return;

      const parsed = parseStoreEntityId(entityId);
      if (!parsed) return;

      const count = Math.max(0, Number(row.count) || 0);
      const current = pendingRef.current.get(parsed.storeId) || {};
      if (parsed.kind === "products") current.products = count;
      else current.categories = count;
      pendingRef.current.set(parsed.storeId, current);

      scheduleFlush();
    };

    type RealtimeChannelApi = { on: (...args: unknown[]) => RealtimeChannelApi; subscribe: () => unknown };
    const sb = supabase as unknown as {
      channel: (name: string) => RealtimeChannelApi;
      removeChannel: (ch: unknown) => void;
    };

    const channel = sb
      .channel(`counters_${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "counters" }, handleChange)
      .subscribe();

    return () => {
      window.removeEventListener(COUNTERS_MUTATION_EVENT as any, handleLocalMutation as EventListener);
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        sb.removeChannel(channel);
      } catch {
        void 0;
      }
    };
  }, [scheduleFlush, userId]);
}
