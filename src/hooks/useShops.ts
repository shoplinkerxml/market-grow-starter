import { ShopService, type ShopAggregated } from "@/lib/shop-service";
import { usePersistentQuery } from "./usePersistentQuery";

export function useShops(userId: string, options?: { enabled?: boolean; force?: boolean; forceCounts?: boolean }) {
  const uid = userId ? String(userId) : "current";
  return usePersistentQuery<ShopAggregated[]>({
    queryKey: ["user", uid, "shops"],
    cacheType: "shops",
    fetchFn: async () => await ShopService.getShopsAggregated({ force: options?.force, forceCounts: options?.forceCounts }),
    enabled: options?.enabled ?? true,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev as any,
  });
}

