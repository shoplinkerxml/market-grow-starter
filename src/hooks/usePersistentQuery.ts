import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { PersistentCacheService } from "@/lib/persistent-cache-service";

type CacheType = "authMe" | "shops" | "tariffs" | "suppliers" | "currencies" | "menu";

type BaseOptions<T> = Omit<UseQueryOptions<T, unknown, T, any>, "queryKey" | "queryFn">;

interface UsePersistentQueryOptions<T> extends BaseOptions<T> {
  queryKey: readonly unknown[];
  cacheType: CacheType;
  fetchFn: () => Promise<T>;
}

export function usePersistentQuery<T>({ queryKey, cacheType, fetchFn, ...options }: UsePersistentQueryOptions<T>) {
  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      switch (cacheType) {
        case "authMe":
          return await PersistentCacheService.getAuthMe(fetchFn);
        case "shops":
          return await PersistentCacheService.getShops(fetchFn);
        case "tariffs":
          return await PersistentCacheService.getTariffs(fetchFn);
        case "suppliers":
          return await PersistentCacheService.getSuppliers(fetchFn);
        case "currencies":
          return await PersistentCacheService.getCurrencies(fetchFn);
        case "menu":
          return await PersistentCacheService.getMenu(fetchFn);
        default:
          return await fetchFn();
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    ...options,
  });
}

