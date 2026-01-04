import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProductsRealtime(
  storeId: string | undefined,
  userId: string | null | undefined,
  queryClient: QueryClient,
) {
  useEffect(() => {
    let scheduled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      timeoutId = setTimeout(() => {
        scheduled = false;
        const uid = userId ? String(userId) : "current";
        queryClient.invalidateQueries({ queryKey: ["user", uid, "products", storeId ?? "all"], exact: false });
      }, 300);
    };
    type RealtimeChannelApi = { on: (...args: unknown[]) => RealtimeChannelApi; subscribe: () => unknown };
    const sb = supabase as unknown as {
      channel: (name: string) => RealtimeChannelApi;
      removeChannel: (ch: unknown) => void;
    };
    const channel = sb
      .channel(`products_${storeId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_products", ...(storeId ? { filter: `store_id=eq.${storeId}` } : {}) }, () => schedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "store_product_links", ...(storeId ? { filter: `store_id=eq.${storeId}` } : {}) }, () => schedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "store_product_images" }, () => schedule())
      .subscribe();
    return () => {
      try { sb.removeChannel(channel); } catch { void 0; }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [queryClient, storeId, userId]);
}
