import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Realtime subscription for store_product_links table.
 * Updates linkedStoreIds in react-query cache without full refetch.
 */
export function useProductLinksRealtime(
  userId: string | null | undefined,
  queryClient: QueryClient,
) {
  const suppressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const uid = String(userId);

    // Suppress updates for 2 seconds after local mutations to avoid conflicts
    const handleLocalMutation = (e: CustomEvent<{ productIds: string[] }>) => {
      const ids = e.detail?.productIds || [];
      ids.forEach((id) => suppressedRef.current.add(String(id)));
      setTimeout(() => {
        ids.forEach((id) => suppressedRef.current.delete(String(id)));
      }, 2000);
    };

    window.addEventListener("product-links-mutation" as any, handleLocalMutation as EventListener);

    type RealtimePayload = {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: { product_id?: string; store_id?: string; is_active?: boolean } | null;
      old: { product_id?: string; store_id?: string } | null;
    };

    const updateProductLinkedStores = (productId: string, storeId: string, action: "add" | "remove") => {
      if (suppressedRef.current.has(productId)) return;

      const productsBaseKey = ["user", uid, "products"];
      
      queryClient.setQueriesData(
        { queryKey: productsBaseKey, exact: false },
        (old: any) => {
          if (!old) return old;

          // Handle infinite query structure
          if (typeof old === "object" && Array.isArray((old as any).pages)) {
            const prev = old as { pages: any[]; pageParams: any[] };
            return {
              ...prev,
              pages: prev.pages.map((page: any) => {
                if (!Array.isArray(page?.products)) return page;
                return {
                  ...page,
                  products: page.products.map((prod: any) => {
                    if (String(prod?.id) !== productId) return prod;
                    
                    const currentIds = Array.isArray(prod.linkedStoreIds)
                      ? prod.linkedStoreIds.map(String)
                      : [];
                    
                    let nextIds: string[];
                    if (action === "add") {
                      nextIds = currentIds.includes(storeId)
                        ? currentIds
                        : [...currentIds, storeId];
                    } else {
                      nextIds = currentIds.filter((id) => id !== storeId);
                    }

                    if (currentIds.length === nextIds.length && currentIds.every((id, i) => id === nextIds[i])) {
                      return prod;
                    }

                    return { ...prod, linkedStoreIds: nextIds };
                  }),
                };
              }),
            };
          }

          // Handle simple array structure
          if (Array.isArray(old)) {
            return old.map((prod: any) => {
              if (String(prod?.id) !== productId) return prod;
              
              const currentIds = Array.isArray(prod.linkedStoreIds)
                ? prod.linkedStoreIds.map(String)
                : [];
              
              let nextIds: string[];
              if (action === "add") {
                nextIds = currentIds.includes(storeId)
                  ? currentIds
                  : [...currentIds, storeId];
              } else {
                nextIds = currentIds.filter((id) => id !== storeId);
              }

              return { ...prod, linkedStoreIds: nextIds };
            });
          }

          return old;
        }
      );

      // Also update "current" user queries
      queryClient.setQueriesData(
        { queryKey: ["user", "current", "products"], exact: false },
        (old: any) => {
          if (!old) return old;

          if (typeof old === "object" && Array.isArray((old as any).pages)) {
            const prev = old as { pages: any[]; pageParams: any[] };
            return {
              ...prev,
              pages: prev.pages.map((page: any) => {
                if (!Array.isArray(page?.products)) return page;
                return {
                  ...page,
                  products: page.products.map((prod: any) => {
                    if (String(prod?.id) !== productId) return prod;
                    
                    const currentIds = Array.isArray(prod.linkedStoreIds)
                      ? prod.linkedStoreIds.map(String)
                      : [];
                    
                    let nextIds: string[];
                    if (action === "add") {
                      nextIds = currentIds.includes(storeId)
                        ? currentIds
                        : [...currentIds, storeId];
                    } else {
                      nextIds = currentIds.filter((id) => id !== storeId);
                    }

                    return { ...prod, linkedStoreIds: nextIds };
                  }),
                };
              }),
            };
          }

          return old;
        }
      );
    };

    const handleChange = (payload: RealtimePayload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      if (eventType === "INSERT" && newRow?.product_id && newRow?.store_id) {
        // Only add if is_active is true (or not specified, defaulting to true)
        if (newRow.is_active !== false) {
          updateProductLinkedStores(String(newRow.product_id), String(newRow.store_id), "add");
        }
      } else if (eventType === "DELETE" && oldRow?.product_id && oldRow?.store_id) {
        updateProductLinkedStores(String(oldRow.product_id), String(oldRow.store_id), "remove");
      } else if (eventType === "UPDATE" && newRow?.product_id && newRow?.store_id) {
        // If is_active changed, add or remove accordingly
        if (newRow.is_active === false) {
          updateProductLinkedStores(String(newRow.product_id), String(newRow.store_id), "remove");
        } else {
          updateProductLinkedStores(String(newRow.product_id), String(newRow.store_id), "add");
        }
      }
    };

    type RealtimeChannelApi = { on: (...args: unknown[]) => RealtimeChannelApi; subscribe: () => unknown };
    const sb = supabase as unknown as {
      channel: (name: string) => RealtimeChannelApi;
      removeChannel: (ch: unknown) => void;
    };

    const channel = sb
      .channel(`product_links_${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_product_links" },
        handleChange
      )
      .subscribe();

    return () => {
      window.removeEventListener("product-links-mutation" as any, handleLocalMutation as EventListener);
      try {
        sb.removeChannel(channel);
      } catch {
        void 0;
      }
    };
  }, [queryClient, userId]);
}
