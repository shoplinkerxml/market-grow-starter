import { UserAuthService } from "@/lib/user-auth-service";
import { usePersistentQuery } from "./usePersistentQuery";

export function useAuthMe(options?: { enabled?: boolean }) {
  return usePersistentQuery({
    queryKey: ["auth", "me"],
    cacheType: "authMe",
    fetchFn: async () => await UserAuthService.fetchAuthMe(),
    enabled: options?.enabled ?? true,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev as any,
  });
}

