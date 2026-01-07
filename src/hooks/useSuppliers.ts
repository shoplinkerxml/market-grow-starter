import { SupplierService, type Supplier } from "@/lib/supplier-service";
import { usePersistentQuery } from "./usePersistentQuery";

export function useSuppliers(userId: string, options?: { enabled?: boolean }) {
  const uid = userId ? String(userId) : "current";
  return usePersistentQuery<Supplier[]>({
    queryKey: ["user", uid, "suppliers", "list"],
    cacheType: "suppliers",
    fetchFn: async () => await SupplierService.getSuppliers(),
    enabled: options?.enabled ?? true,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev as any,
  });
}

