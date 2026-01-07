/**
 * Prefetch service for eager loading of user data on login.
 * Loads shops and suppliers in the background to improve perceived performance.
 */

import { ShopService } from "./shop-service";
import { SupplierService } from "./supplier-service";

export class PrefetchService {
  private static prefetchInProgress = false;
  private static prefetchAbortController: AbortController | null = null;

  /**
   * Prefetch all critical user data in the background.
   * Called on successful login to warm up caches.
   */
  static async prefetchUserData(): Promise<void> {
    // Prevent multiple simultaneous prefetches
    if (this.prefetchInProgress) {
      return;
    }

    this.prefetchInProgress = true;
    this.prefetchAbortController = new AbortController();
    const signal = this.prefetchAbortController.signal;

    try {
      // Use Promise.allSettled to not fail if one request fails
      const results = await Promise.allSettled([
        // Prefetch shops with aggregated data
        this.prefetchShops(signal),
        // Prefetch suppliers
        this.prefetchSuppliers(signal),
      ]);

      // Log results for debugging
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      
      if (import.meta.env.DEV) {
        console.log(`[Prefetch] Completed: ${successful} success, ${failed} failed`);
      }
    } catch (error) {
      // Silently ignore prefetch errors
      if (import.meta.env.DEV) {
        console.warn("[Prefetch] Error during prefetch:", error);
      }
    } finally {
      this.prefetchInProgress = false;
      this.prefetchAbortController = null;
    }
  }

  /**
   * Cancel any in-progress prefetch operations.
   * Called on sign-out to prevent stale data being cached.
   */
  static cancelPrefetch(): void {
    if (this.prefetchAbortController) {
      this.prefetchAbortController.abort();
      this.prefetchAbortController = null;
    }
    this.prefetchInProgress = false;
  }

  private static async prefetchShops(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    
    try {
      // Use requestIdleCallback for non-blocking prefetch
      if (typeof requestIdleCallback !== "undefined") {
        await new Promise<void>((resolve) => {
          requestIdleCallback(
            async () => {
              if (signal.aborted) {
                resolve();
                return;
              }
              try {
                await ShopService.getShopsAggregated({ force: false });
              } catch {
                // Ignore errors
              }
              resolve();
            },
            { timeout: 2000 }
          );
        });
      } else {
        await ShopService.getShopsAggregated({ force: false });
      }
    } catch {
      // Silently ignore
    }
  }

  private static async prefetchSuppliers(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    
    try {
      // Use requestIdleCallback for non-blocking prefetch
      if (typeof requestIdleCallback !== "undefined") {
        await new Promise<void>((resolve) => {
          requestIdleCallback(
            async () => {
              if (signal.aborted) {
                resolve();
                return;
              }
              try {
                await SupplierService.getSuppliers({ signal });
              } catch {
                // Ignore errors
              }
              resolve();
            },
            { timeout: 2000 }
          );
        });
      } else {
        await SupplierService.getSuppliers({ signal });
      }
    } catch {
      // Silently ignore
    }
  }

  /**
   * Check if prefetch is currently running
   */
  static isPrefetching(): boolean {
    return this.prefetchInProgress;
  }
}
