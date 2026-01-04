import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';

interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  registeredUsers: number;
}

// Query Keys
export const statisticsQueries = {
  all: ["statistics"] as const,
  userStats: () => [...statisticsQueries.all, "user"] as const,
};

// Data fetching function
const fetchUserStatistics = async (): Promise<UserStatistics> => {
  // Fetch total users with 'user' role
  const { count: totalUsers, error: totalError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user');

  if (totalError) throw new Error(totalError.message);

  // Fetch active users with 'user' role
  const { count: activeUsers, error: activeError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user')
    .eq('status', 'active');

  if (activeError) throw new Error(activeError.message);

  return {
    totalUsers: totalUsers || 0,
    activeUsers: activeUsers || 0,
    registeredUsers: totalUsers || 0, // For now, same as total users
  };
};

export const useUserStatistics = () => {
  return useQuery({
    queryKey: statisticsQueries.userStats(),
    queryFn: fetchUserStatistics,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
};