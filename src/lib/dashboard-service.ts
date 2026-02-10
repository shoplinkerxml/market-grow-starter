
import { UnifiedCacheManager } from "./cache-utils";
import { EdgeClient } from "./request-handler";
import { GlobalRequestDeduplicator } from "./request-deduplicator";

export interface DashboardStats {
  suppliers: Array<{
    id: number;
    supplier_name: string;
    productCount: number;
  }>;
  stores: Array<{
    id: string;
    store_name: string;
    productsCount: number;
  }>;
  totalProducts: number;
  totalCategories: number;
}

export class DashboardService {
  private static cache = UnifiedCacheManager.create("dashboard-service", {
    mode: "memory",
    defaultTtlMs: 5_000, // 5 seconds - short TTL since edge now reads fresh from counters
    maxSize: 10,
  });

  static async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = "dashboard-stats";
    const cached = this.cache.get<DashboardStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      return await GlobalRequestDeduplicator.dedupeExpensive(
        { service: "DashboardService", method: "getDashboardStats" },
        async ({ signal }) => {
          const stats = await EdgeClient.invokeWithRetry<DashboardStats>("get-dashboard-stats", {}, { signal, log: false });
          this.cache.set(cacheKey, stats);
          return stats;
        },
      );
    } catch (error) {
      const message = String((error as { message?: unknown } | null)?.message || "");
      const name = String((error as { name?: unknown } | null)?.name || "");
      const lowered = message.toLowerCase();
      const isAbort =
        name === "AbortError" ||
        lowered.includes("abort") ||
        lowered.includes("net::err_aborted") ||
        lowered.includes("the user aborted a request");
      if (!isAbort) {
        console.error("Failed to fetch dashboard stats:", error);
      }
      // Return empty stats on error to prevent crashing, but do NOT cache it
      return {
        suppliers: [],
        stores: [],
        totalProducts: 0,
        totalCategories: 0
      };
    }
  }

  static clearCache(): void {
    this.cache.clearAll();
    GlobalRequestDeduplicator.cancelPrefix("DashboardService:");
  }
}
