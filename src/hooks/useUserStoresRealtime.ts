import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopService } from "@/lib/shop-service";
import { DashboardService } from "@/lib/dashboard-service";

type UserStoreRow = {
  id: string;
  user_id: string;
  store_name: string;
  store_company: string | null;
  store_url: string | null;
  template_id: string | null;
  xml_config: unknown | null;
  custom_mapping: unknown | null;
  marketplace: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: UserStoreRow | null;
  old: UserStoreRow | null;
};

/**
 * Realtime subscription for `user_stores`.
 * Keeps shops list + dashboard stats in sync across tabs/devices.
 */
export function useUserStoresRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const lastEventRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    const uid = String(userId);

    const applyShopsListMutation = (payload: RealtimePayload) => {
      const now = Date.now();
      // simple throttle to avoid bursts
      if (now - lastEventRef.current < 150) return;
      lastEventRef.current = now;

      const row = payload.new || payload.old;
      if (!row || String(row.user_id) !== uid) return;

      const shopsKey = ["user", uid, "shops"] as const;

      const removeFromLists = (storeId: string) => {
        queryClient.setQueryData<any[]>(shopsKey, (prev) =>
          Array.isArray(prev) ? prev.filter((s) => String(s?.id) !== String(storeId)) : prev
        );
      };

      const upsertIntoLists = (store: any) => {
        const normalize = (item: any) => ({
          ...item,
          id: String(item.id),
          user_id: String(item.user_id),
          store_name: String(item.store_name || ""),
          is_active: item.is_active !== false,
          marketplace: item.marketplace ?? undefined,
          // counts are unknown here; keep existing or default to 0
          productsCount: typeof item.productsCount === "number" ? item.productsCount : 0,
          categoriesCount: typeof item.categoriesCount === "number" ? item.categoriesCount : 0,
        });

        queryClient.setQueryData<any[]>(shopsKey, (prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const sid = String(store.id);
          const exists = list.some((s) => String(s?.id) === sid);
          if (!exists) return [normalize(store), ...list];
          return list.map((s) => (String(s?.id) === sid ? normalize({ ...s, ...store }) : s));
        });
      };

      if (payload.eventType === "DELETE" && payload.old?.id) {
        removeFromLists(String(payload.old.id));
      }

      if ((payload.eventType === "INSERT" || payload.eventType === "UPDATE") && payload.new?.id) {
        // If shop turned inactive, remove it from lists
        if (payload.new.is_active === false) {
          removeFromLists(String(payload.new.id));
        } else {
          upsertIntoLists({
            ...payload.new,
            productsCount: undefined,
            categoriesCount: undefined,
          });
        }
      }

      // Clear internal service caches so next reads won't serve stale data
      try {
        ShopService.invalidateInternalCache();
      } catch {
        void 0;
      }

      // Dashboard stats have their own memory cache; clear it and refetch via react-query
      try {
        DashboardService.clearCache();
      } catch {
        void 0;
      }
      queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard-stats"], exact: true });
    };

    type RealtimeChannelApi = { on: (...args: unknown[]) => RealtimeChannelApi; subscribe: () => unknown };
    const sb = supabase as unknown as {
      channel: (name: string) => RealtimeChannelApi;
      removeChannel: (ch: unknown) => void;
    };

    const channel = sb
      .channel(`user_stores_${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_stores", filter: `user_id=eq.${uid}` },
        applyShopsListMutation
      )
      .subscribe();

    return () => {
      try {
        sb.removeChannel(channel);
      } catch {
        void 0;
      }
    };
  }, [queryClient, userId]);
}
