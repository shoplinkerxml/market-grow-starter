import { ShopCountsService } from "@/lib/shop-counts";
import { ProductLinkService } from "@/lib/product/product-link-service";
import { queryClient } from "@/lib/react-query";
import { ShopService } from "@/lib/shop-service";
import { requireValidSession } from "@/lib/session-validation";

type StoreLink = { product_id: string; store_id: string };

export class ShopProductSyncService {
  private static async getCurrentUserId(): Promise<string | null> {
    try {
      const v = await requireValidSession({ requireAccessToken: false });
      return v?.user?.id ? String(v.user.id) : null;
    } catch {
      return null;
    }
  }

  /**
   * Immediately update counters in react-query cache for given stores.
   * This is the primary mechanism to keep UI in sync after mutations.
   */
  private static async refreshCountersFromServer(
    uids: string[],
    storeIds: string[],
  ): Promise<void> {
    if (storeIds.length === 0) return;
    
    try {
      try {
        ShopService.clearAllCaches();
      } catch {
        void 0;
      }

      for (const uid of uids) {
        ShopCountsService.invalidate(queryClient, uid, storeIds, "sync_after_bulk_mutation");
      }
    } catch (error) {
      console.warn("[ShopProductSyncService] refreshCountersFromServer failed:", error);
      try {
        ShopService.invalidateInternalCache();
      } catch {
        void 0;
      }
    }
  }

  static async syncAfterBulkAdd(
    addedByStore: Record<string, number>,
    categoryNamesByStore: Record<string, string[]>,
    productIds: string[],
    links?: StoreLink[]
  ): Promise<void> {
    const userId = await ShopProductSyncService.getCurrentUserId();
    if (!userId) return;

    const uids = Array.from(new Set([String(userId), "current"]));
    const storeIds = Object.keys(addedByStore);

    // Suppress realtime updates for these stores to avoid double-counting
    for (const uid of uids) {
      for (const storeId of storeIds) {
        const addedCount = addedByStore[storeId] || 0;
        if (addedCount === 0) continue;
        ShopCountsService.suppressRealtimeProductsDelta(uid, storeId, addedCount);
      }
    }

    // Immediately refresh counters from server
    await this.refreshCountersFromServer(uids, storeIds);
    
    void categoryNamesByStore;

    if (Array.isArray(links) && links.length > 0) {
      const storeIdsByProduct = new Map<string, Set<string>>();
      for (const l of links) {
        const pid = String(l.product_id);
        const sid = String(l.store_id);
        if (!pid || !sid) continue;
        const set = storeIdsByProduct.get(pid) ?? new Set<string>();
        set.add(sid);
        storeIdsByProduct.set(pid, set);
      }

      for (const uid of uids) {
        queryClient.setQueriesData(
          {
            predicate: (q) => {
              const k = q.queryKey as unknown[];
              return Array.isArray(k) && k.length >= 3 && k[0] === "user" && String(k[1]) === uid && k[2] === "products";
            },
          },
          (old: any) => {
            if (!old) return old;
            if (typeof old !== "object" || !Array.isArray((old as any).pages)) return old;
            const prev = old as any;
            return {
              ...prev,
              pages: (prev.pages || []).map((p: any) => {
                const products = Array.isArray(p?.products) ? p.products : [];
                const nextProducts = products.map((prod: any) => {
                  const pid = String(prod?.id ?? "");
                  if (!pid || !storeIdsByProduct.has(pid)) return prod;
                  const add = Array.from(storeIdsByProduct.get(pid) || []);
                  const prevIds = Array.isArray(prod?.linkedStoreIds) ? prod.linkedStoreIds.map(String) : [];
                  const merged = Array.from(new Set([...prevIds, ...add]));
                  return { ...prod, linkedStoreIds: merged };
                });
                return { ...p, products: nextProducts };
              }),
            };
          },
        );
      }
    }

    // Notify realtime hook to suppress updates for these products
    if (productIds.length > 0) {
      window.dispatchEvent(new CustomEvent("product-links-mutation", { detail: { productIds } }));
    }

    for (const productId of productIds) {
      ProductLinkService.invalidateStoreLinksCache(productId);
    }

    if (productIds.length > 0) {
      queryClient.invalidateQueries({
        queryKey: ["product", "links"],
        predicate: (query) => {
           const key = query.queryKey as string[];
           return key.includes("links") && productIds.includes(key[key.length - 1]);
        }
      });
    }
  }

  static async syncAfterBulkRemove(
    deletedByStore: Record<string, number>,
    categoryNamesByStore: Record<string, string[]>,
    productIds: string[],
    storeIdsToRemove?: string[]
  ): Promise<void> {
    const userId = await ShopProductSyncService.getCurrentUserId();
    if (!userId) return;

    const uids = Array.from(new Set([String(userId), "current"]));
    const storeIds = Object.keys(deletedByStore).length > 0 
      ? Object.keys(deletedByStore) 
      : (storeIdsToRemove || []);

    // Suppress realtime updates for these stores to avoid double-counting
    for (const uid of uids) {
      for (const storeId of storeIds) {
        const deletedCount = deletedByStore[storeId] || 0;
        if (deletedCount === 0) continue;
        ShopCountsService.suppressRealtimeProductsDelta(uid, storeId, -deletedCount);
      }
    }

    // Immediately refresh counters from server
    await this.refreshCountersFromServer(uids, storeIds);
    
    void categoryNamesByStore;

    const removeSet = new Set((storeIdsToRemove || storeIds).map((s) => String(s)).filter(Boolean));
    const productIdsSet = new Set(productIds.map(String));
    
    if (removeSet.size > 0 && productIdsSet.size > 0) {
      for (const uid of uids) {
        queryClient.setQueriesData(
          {
            predicate: (q) => {
              const k = q.queryKey as unknown[];
              return Array.isArray(k) && k.length >= 3 && k[0] === "user" && String(k[1]) === uid && k[2] === "products";
            },
          },
          (old: any) => {
            if (!old) return old;
            if (typeof old !== "object" || !Array.isArray((old as any).pages)) return old;
            const prev = old as any;
            return {
              ...prev,
              pages: (prev.pages || []).map((p: any) => {
                const products = Array.isArray(p?.products) ? p.products : [];
                const nextProducts = products.map((prod: any) => {
                  const pid = String(prod?.id ?? "");
                  if (!pid || !productIdsSet.has(pid)) return prod;
                  const prevIds = Array.isArray(prod?.linkedStoreIds) ? prod.linkedStoreIds.map(String) : [];
                  if (prevIds.length === 0) return prod;
                  const nextIds = prevIds.filter((sid) => !removeSet.has(String(sid)));
                  return { ...prod, linkedStoreIds: nextIds };
                });
                return { ...p, products: nextProducts };
              }),
            };
          },
        );
      }
    }

    // Notify realtime hook to suppress updates for these products
    if (productIds.length > 0) {
      window.dispatchEvent(new CustomEvent("product-links-mutation", { detail: { productIds } }));
    }

    for (const productId of productIds) {
      ProductLinkService.invalidateStoreLinksCache(productId);
    }

    if (productIds.length > 0) {
      queryClient.invalidateQueries({
        queryKey: ["product", "links"],
        predicate: (query) => {
           const key = query.queryKey as string[];
           return key.includes("links") && productIds.includes(key[key.length - 1]);
        }
      });
    }
  }
}
