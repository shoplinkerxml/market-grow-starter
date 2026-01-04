import { useQuery } from "@tanstack/react-query";
import { TariffService } from '@/lib/tariff-service';

interface TariffStatistics {
  totalTariffs: number;
  activeTariffs: number;
  freeTariffs: number;
  paidTariffs: number;
}

// Query Keys
export const tariffStatisticsQueries = {
  all: ["tariff-statistics"] as const,
  stats: () => [...tariffStatisticsQueries.all, "stats"] as const,
};

// Data fetching function
const fetchTariffStatistics = async (): Promise<TariffStatistics> => {
  return await TariffService.getTariffStatistics();
};

export const useTariffStatistics = () => {
  return useQuery({
    queryKey: tariffStatisticsQueries.stats(),
    queryFn: fetchTariffStatistics,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
};