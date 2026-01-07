import { TariffService, type TariffWithDetails } from "@/lib/tariff-service";
import { usePersistentQuery } from "./usePersistentQuery";

export function useTariffs(options?: { enabled?: boolean; includeInactive?: boolean; includeDemo?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  const includeDemo = options?.includeDemo ?? false;
  return usePersistentQuery<TariffWithDetails[]>({
    queryKey: ["tariffs", "list", includeInactive ? "inactive" : "active", includeDemo ? "demo" : "noDemo"],
    cacheType: "tariffs",
    fetchFn: async () => await TariffService.getTariffsAggregated(includeInactive, includeDemo),
    enabled: options?.enabled ?? true,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev as any,
  });
}

