
import { UnifiedCacheManager } from "./cache-utils";
import { invokeEdgeWithAuth } from "./session-validation";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

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
  private static deduplicator = RequestDeduplicatorFactory.create("dashboard-service", {
    ttl: 60_000, // 1 minute deduplication
    maxSize: 10,
    enableMetrics: true,
  });

  private static cache = UnifiedCacheManager.create("dashboard-service", {
    mode: "memory",
    defaultTtlMs: 300_000, // 5 minutes cache
    maxSize: 10,
  });

  static async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = "dashboard-stats";
    const cached = this.cache.get<DashboardStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      return await this.deduplicator.dedupe(cacheKey, async () => {
        const stats = await invokeEdgeWithAuth<DashboardStats>("get-dashboard-stats", {});
        // Only cache successful responses
        this.cache.set(cacheKey, stats);
        return stats;
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
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
    this.deduplicator.clear();
  }
}
