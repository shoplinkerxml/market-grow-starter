import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserAuthService } from '@/lib/user-auth-service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthMe } from './useAuthMe';

export const useUserRole = () => {
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useAuthMe({ enabled: true });
  const role = data?.user?.role ?? null;

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    });
    return () => subscription?.subscription?.unsubscribe();
  }, [queryClient]);

  return { role: role ?? null, loading };
};
