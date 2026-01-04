import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopCountsService } from "@/lib/shop-counts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface UseShopRealtimeSyncOptions {
  shopId: string;
  userId?: string | null;
  enabled?: boolean;
}

export const useShopRealtimeSync = ({ shopId, userId, enabled = true }: UseShopRealtimeSyncOptions) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !shopId) return;
    const uid = userId ? String(userId) : "current";

    const handleInsert = (payload: any) => {
      const { store_id, is_active } = payload.new;
      if (String(store_id) === shopId && is_active !== false) ShopCountsService.bumpProducts(queryClient, uid, shopId, +1);
    };

    const handleDelete = (payload: any) => {
      const { store_id, is_active } = payload.old;
      if (String(store_id) === shopId && is_active !== false) ShopCountsService.bumpProducts(queryClient, uid, shopId, -1);
    };

    const handleUpdate = (payload: any) => {
      const oldRow = payload?.old || {};
      const newRow = payload?.new || {};
      const sidOld = oldRow?.store_id ? String(oldRow.store_id) : "";
      const sidNew = newRow?.store_id ? String(newRow.store_id) : "";
      const wasActive = oldRow?.is_active !== false;
      const isActive = newRow?.is_active !== false;

      if (sidOld === sidNew && sidNew === shopId) {
        if (wasActive !== isActive) {
          ShopCountsService.bumpProducts(queryClient, uid, shopId, isActive ? +1 : -1);
        }
        return;
      }

      if (sidOld === shopId && wasActive) ShopCountsService.bumpProducts(queryClient, uid, shopId, -1);
      if (sidNew === shopId && isActive) ShopCountsService.bumpProducts(queryClient, uid, shopId, +1);
    };

    const client = supabase as SupabaseClient;

    const channel = client
      .channel(`shop_realtime_${shopId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "store_product_links" }, handleInsert)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "store_product_links" }, handleDelete)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_product_links" }, handleUpdate)
      .subscribe();

    return () => {
      client.removeChannel(channel).catch(() => void 0);
    };
  }, [shopId, enabled, queryClient, userId]);
};
