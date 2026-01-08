import { ShopCountsService } from "@/lib/shop-counts";
import { ProductLinkService } from "@/lib/product/product-link-service";
import { queryClient } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopService, type ShopAggregated } from "@/lib/shop-service";
import { PersistentCacheService } from "@/lib/persistent-cache-service";

type StoreLink = { product_id: string; store_id: string };

export class ShopProductSyncService {
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
      // Fetch fresh data from server (which reads from Redis)
      const refreshed = await ShopService.getShopsAggregated({ force: true, forceCounts: true });
      
      for (const uid of uids) {
        // Update main shops list cache
        queryClient.setQueryData(["user", uid, "shops"], refreshed);
        queryClient.setQueryData(["user", uid, "shops", "menu"], refreshed);
        
        // Update individual shop counts caches
        for (const storeId of storeIds) {
          const found = (refreshed || []).find((s: any) => String(s?.id) === String(storeId));
          if (!found) continue;
          
          const productsCount = Math.max(0, Number((found as any).productsCount ?? 0) || 0);
          const categoriesCount = productsCount === 0 ? 0 : Math.max(0, Number((found as any).categoriesCount ?? 0) || 0);
          
          // Set both the counts cache and shop detail cache
          ShopCountsService.set(queryClient, uid, storeId, { productsCount, categoriesCount });
        }
      }
      
      // Also bump persistent cache
      const deltas: Record<string, number> = {};
      for (const s of refreshed || []) {
        const sid = String((s as any)?.id || "");
        if (!sid || !storeIds.includes(sid)) continue;
        deltas[sid] = 0; // Just touch to update
      }
      await PersistentCacheService.bumpCachedShopsCounts(deltas);
    } catch (error) {
      console.warn("[ShopProductSyncService] refreshCountersFromServer failed:", error);
      // Fallback: invalidate caches
      ShopService.invalidateInternalCache();
    }
  }

  static async syncAfterBulkAdd(
    addedByStore: Record<string, number>,
    categoryNamesByStore: Record<string, string[]>,
    productIds: string[],
    links?: StoreLink[]
  ): Promise<void> {
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
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
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    if (!userId) return;

    const uids = Array.from(new Set([String(userId), "current"]));
    const storeIds = Object.keys(deletedByStore);

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
    if (removeSet.size > 0 && productIds.length > 0) {
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
                  if (!pid || !productIds.includes(pid)) return prod;
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
