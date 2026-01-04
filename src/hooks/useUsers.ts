import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserService } from "@/lib/user-service";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "user" | "admin" | "manager";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  subscription?: {
    tariff_name: string | null;
    is_active: boolean;
  };
}

interface UserFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  role?: "user" | "admin" | "manager" | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface PaginationParams {
  page: number;
  limit: number;
}

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: "user";
  notify_by_email: boolean;
}

interface UpdateUserData {
  name?: string;
  phone?: string;
  status?: "active" | "inactive";
}

// Add a small delay to prevent loading flicker for fast requests
const withMinimumDelay = async <T>(promise: Promise<T>, minDelayMs = 300): Promise<T> => {
  const [result] = await Promise.all([
    promise,
    new Promise(resolve => setTimeout(resolve, minDelayMs))
  ]);
  return result;
};

// Query Keys
export const userQueries = {
  all: ["users"] as const,
  lists: () => [...userQueries.all, "list"] as const,
  list: (filters: UserFilters, pagination: PaginationParams) => 
    [...userQueries.lists(), filters, pagination] as const,
  details: () => [...userQueries.all, "detail"] as const,
  detail: (id: string) => [...userQueries.details(), id] as const,
};

// Custom Hooks
export function useUsers(filters: UserFilters = {}, pagination: PaginationParams = { page: 1, limit: 10 }) {
  return useQuery({
    queryKey: userQueries.list(filters, pagination),
    queryFn: () => withMinimumDelay(UserService.getUsers(filters, pagination)),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  
  return useMutation({
    mutationFn: (userData: CreateUserData) => UserService.createUser(userData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userQueries.lists() });
      toast.success(t("user_created_success"), {
        description: `${data.name} ${t("user_created_desc")}`,
      });
    },
    onError: (error: Error) => {
      console.error("Create user error:", error);
      toast.error(t("failed_create_user"), {
        description: error.message || t("error_try_again"),
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) => 
      UserService.updateUser(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userQueries.lists() });
      queryClient.invalidateQueries({ queryKey: userQueries.detail(data.id) });
      toast.success(t("user_updated_success"), {
        description: `${data.name} ${t("user_updated_desc")}`,
      });
    },
    onError: (error: Error) => {
      console.error("Update user error:", error);
      toast.error(t("failed_update_user"), {
        description: error.message || t("error_try_again"),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  
  return useMutation({
    mutationFn: (id: string) => UserService.deleteUser(id),
    onSuccess: (data, userId) => {
      // Remove user from all lists in cache optimistically
      queryClient.invalidateQueries({ queryKey: userQueries.lists() });
      queryClient.removeQueries({ queryKey: userQueries.detail(userId) });
      
      // Show success message based on what was actually deleted
      const message = t("user_deleted_success");
      let description = "";
      
      if (data.deletedAuth && data.deletedProfile) {
        description = t("user_fully_deleted");
      } else if (data.deletedProfile) {
        description = t("user_profile_deleted");
      } else if (data.deletedAuth) {
        description = t("user_auth_deleted");
      }
      
      toast.success(message, {
        description: description || t("user_deleted_desc"),
      });
    },
    onError: (error: Error) => {
      console.error("Delete user error:", error);
      toast.error(t("failed_delete_user"), {
        description: error.message || t("error_try_again"),
      });
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) => 
      UserService.toggleUserStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: userQueries.lists() });
      
      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(userQueries.lists());
      
      // Optimistically update to the new value
      queryClient.setQueryData(userQueries.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users?.map((user: UserProfile) => 
            user.id === id ? { ...user, status } : user
          ) || []
        };
      });
      
      // Return a context object with the snapshotted value
      return { previousUsers };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousUsers) {
        queryClient.setQueryData(userQueries.lists(), context.previousUsers);
      }
    },
    onSettled: () => {
      // Invalidate queries regardless of success or failure
      queryClient.invalidateQueries({ queryKey: userQueries.lists() });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userQueries.detail(data.id) });
      
      const action = data.status === "active" ? "activated" : "deactivated";
      const actionText = data.status === "active" ? t("user_activated_desc") : t("user_deactivated_desc");
      const successMessage = data.status === "active" ? t("user_activated_success") : t("user_deactivated_success");
      toast.success(successMessage, {
        description: `${data.name} ${actionText}`,
      });
    },
  });
}

// Helper hook to prefetch user data
export function usePrefetchUser() {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: userQueries.detail(id),
      queryFn: () => UserService.getUser(id),
      staleTime: 1000 * 60 * 10, // 10 minutes
    });
  };
}

// Prefetch list of users
export function usePrefetchUsers(filters: UserFilters = {}, pagination: PaginationParams = { page: 1, limit: 10 }) {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.prefetchQuery({
      queryKey: userQueries.list(filters, pagination),
      queryFn: () => withMinimumDelay(UserService.getUsers(filters, pagination)),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}
