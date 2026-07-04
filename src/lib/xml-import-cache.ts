import type { QueryClient } from "@tanstack/react-query";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { ProductCacheManager } from "@/lib/product/product-cache-manager";
import { ShopCountsService } from "@/lib/shop-counts";
import type { SupplierImportRun } from "@/lib/xml-import-service";

const finishedStatuses = new Set(["succeeded", "failed", "cancelled"]);
const handledRuns = new Map<string, string>(); // run_id -> last handled status
const HANDLED_TTL_MS = 10 * 60_000;
let lastCleanup = 0;

function cleanupHandled() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  if (handledRuns.size < 200) return;
  handledRuns.clear();
}

function affectsData(run: SupplierImportRun): boolean {
  const created = Number(run.created_count ?? 0) || 0;
  const updated = Number(run.updated_count ?? 0) || 0;
  const failed = Number(run.failed_count ?? 0) || 0;
  // Even failed runs may have partial writes; only skip if nothing changed at all.
  return created + updated + failed > 0;
}

/**
 * Called from realtime handlers for `supplier_import_runs`. Detects transitions
 * into a terminal status and invalidates every cache layer that could hold
 * stale product/shop/supplier data after a bulk XML import.
 *
 * Idempotent — calling it repeatedly with the same terminal status for the
 * same run is a no-op.
 */
export function handleImportRunFinish(
  queryClient: QueryClient,
  userId: string | null | undefined,
  run: SupplierImportRun | null | undefined,
): void {
  if (!run) return;
  const status = String(run.status ?? "");
  if (!finishedStatuses.has(status)) return;

  cleanupHandled();
  const prev = handledRuns.get(run.id);
  if (prev === status) return;
  handledRuns.set(run.id, status);

  if (status === "succeeded" && run.error === "not-modified") return;
  if (!affectsData(run)) return;

  const uid = userId ? String(userId) : "current";

  // 1. Suppress noisy per-row realtime for a few seconds — the explicit
  //    invalidations below will refetch once.
  ShopCountsService.suppressAllRealtimeForUser(uid, 3000);

  // 2. Drop persistent + in-memory caches touched by the import.
  try { ProductCacheManager.clearAllProductsCaches(); } catch { /* ignore */ }
  try { PersistentCacheService.invalidateShops(); } catch { /* ignore */ }
  try { PersistentCacheService.invalidateSuppliers(); } catch { /* ignore */ }
  try { PersistentCacheService.invalidateAuthMe(); } catch { /* ignore */ }

  // 3. Invalidate react-query keys so mounted screens refetch.
  try {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"], exact: true });
    queryClient.invalidateQueries({ queryKey: ["user", uid, "shops"] });
    queryClient.invalidateQueries({ queryKey: ["user", uid, "suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard-stats"] });
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes("products"),
    });
  } catch { /* ignore */ }

  // 4. Bump shop-counts sync (broadcasts to other tabs too).
  try { ShopCountsService.invalidate(queryClient, uid, [], "xml-import-finish"); } catch { /* ignore */ }
}
