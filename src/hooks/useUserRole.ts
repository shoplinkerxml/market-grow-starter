import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserAuthService } from '@/lib/user-auth-service';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useUserRole = () => {
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => UserAuthService.fetchAuthMe(),
    staleTime: 60_000,
  });
  const role = data?.user?.role ?? null;

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    });
    return () => subscription?.subscription?.unsubscribe();
  }, [queryClient]);

  return { role: role ?? null, loading };
};
