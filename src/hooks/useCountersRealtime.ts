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

function isUuidLike(value: string): boolean {
  // good-enough check for store ids (uuid)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isNumericId(value: string): boolean {
  return /^[0-9]+$/.test(String(value || ""));
}

function legacyParseStoreEntityId(entityId: string): { storeId: string; kind: "products" | "categories" } | null {
  // Legacy: store:<storeId>:products | store:<storeId>:categories
  const parts = String(entityId || "").split(":");
  if (parts.length !== 3) return null;
  if (parts[0] !== "store") return null;
  const storeId = parts[1];
  const kind = parts[2];
  if (!storeId) return null;
  if (kind !== "products" && kind !== "categories") return null;
  return { storeId, kind };
}

function counterKey(row: Pick<CounterRow, "counter_type" | "entity_id">): string {
  return `${String(row.counter_type)}:${String(row.entity_id)}`;
}

function parseStoreCounter(row: CounterRow, userId: string): { storeId: string; kind: "products" | "categories" } | null {
  // Primary format we see in DB: counter_type = products|categories, entity_id = <store_uuid>
  const entityId = String(row.entity_id || "");
  const ct = String(row.counter_type || "");

  // New format
  if ((ct === "products" || ct === "categories") && isUuidLike(entityId) && entityId !== String(userId)) {
    return { storeId: entityId, kind: ct as "products" | "categories" };
  }

  // Legacy format
  const legacy = legacyParseStoreEntityId(entityId);
  if (legacy) return legacy;

  return null;
}

function parseSupplierProductsCounter(row: CounterRow, userId: string): { supplierId: number; count: number } | null {
  // Format observed: counter_type = products, entity_id = <supplier_id_number>
  const entityId = String(row.entity_id || "");
  const ct = String(row.counter_type || "");
  if (ct !== "products") return null;
  if (entityId === String(userId)) return null;
  if (isUuidLike(entityId)) return null;
  if (!isNumericId(entityId)) return null;
  const supplierId = Number(entityId);
  if (!Number.isFinite(supplierId)) return null;
  return { supplierId, count: Math.max(0, Number(row.count) || 0) };
}

function isUserTotalCounter(row: CounterRow, userId: string): row is CounterRow {
  const entityId = String(row.entity_id || "");
  const ct = String(row.counter_type || "");
  return entityId === String(userId) && (ct === "products" || ct === "categories" || ct === "shops" || ct === "suppliers");
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

    // NOTE: do NOT invalidate dashboard here.
    // Dashboard uses edge response which historically was computed from other tables.
    // We keep dashboard in sync by applying counters updates directly in handleChange.

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
      ids.forEach((raw) => {
        const id = String(raw);
        suppressedRef.current.add(id);
        // Support storeId-only suppression (we don't always know counter_type at call site)
        suppressedRef.current.add(`products:${id}`);
        suppressedRef.current.add(`categories:${id}`);
      });
      setTimeout(
        () =>
          ids.forEach((raw) => {
            const id = String(raw);
            suppressedRef.current.delete(id);
            suppressedRef.current.delete(`products:${id}`);
            suppressedRef.current.delete(`categories:${id}`);
          }),
        SUPPRESSION_WINDOW_MS,
      );
    };
    window.addEventListener(COUNTERS_MUTATION_EVENT as any, handleLocalMutation as EventListener);

    const handleChange = (payload: RealtimePayload) => {
      const row = payload.new || payload.old;
      if (!row?.entity_id) return;

      const suppressKey = counterKey(row);
      const legacyKey = String(row.entity_id || "");
      if (suppressedRef.current.has(suppressKey) || suppressedRef.current.has(legacyKey)) return;
      const parsed = parseStoreCounter(row, uid);
      if (parsed) {
        const count = Math.max(0, Number(row.count) || 0);
        const current = pendingRef.current.get(parsed.storeId) || {};
        if (parsed.kind === "products") current.products = count;
        else current.categories = count;
        pendingRef.current.set(parsed.storeId, current);
        scheduleFlush();
        return;
      }

      // 2) Supplier product counters -> update dashboard suppliers list (no refetch)
      const supplierParsed = parseSupplierProductsCounter(row, uid);
      if (supplierParsed) {
        // ensure in-memory service cache won't keep stale values
        try {
          DashboardService.clearCache();
        } catch {
          void 0;
        }

        queryClient.setQueryData<any>(["user", uid, "dashboard-stats"], (prev) => {
          const base = prev && typeof prev === "object" ? prev : { suppliers: [], stores: [], totalProducts: 0, totalCategories: 0 };
          const suppliers = Array.isArray((base as any).suppliers) ? (base as any).suppliers : [];
          const nextSuppliers = suppliers.map((s: any) =>
            Number(s?.id) === supplierParsed.supplierId ? { ...s, productCount: supplierParsed.count } : s,
          );
          return { ...base, suppliers: nextSuppliers };
        });
        return;
      }

      // 3) Per-user totals -> update dashboard cache immediately (no refetch)
      if (isUserTotalCounter(row, uid)) {
        const count = Math.max(0, Number(row.count) || 0);

        // ensure in-memory service cache won't keep stale values
        try {
          DashboardService.clearCache();
        } catch {
          void 0;
        }

        queryClient.setQueryData<any>(["user", uid, "dashboard-stats"], (prev) => {
          const base = prev && typeof prev === "object" ? prev : { suppliers: [], stores: [], totalProducts: 0, totalCategories: 0 };
          const ct = String(row.counter_type || "");
          if (ct === "products") return { ...base, totalProducts: count };
          if (ct === "categories") return { ...base, totalCategories: count };
          return base;
        });
      }
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
