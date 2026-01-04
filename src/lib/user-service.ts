// File: src/services/UserService.ts (клиентская часть)
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { SessionValidator } from "./session-validation";
import { ServiceError, toServiceError } from "./error-handler";

/**
 * Helper function to get the appropriate authentication headers
 * - Если пользователь авторизован, используем Bearer token
 * - Для операций администратора, используем только Bearer token
 */
async function getAuthHeaders() {
  const validation = await SessionValidator.ensureValidSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (validation.isValid && validation.accessToken) {
    headers["Authorization"] = `Bearer ${validation.accessToken}`;
  }
  return headers;
}

/** Интерфейсы данных */
export interface UserProfile {
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

export interface UserFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  role?: "user" | "admin" | "manager" | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface UsersResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: "user";
  notify_by_email: boolean;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  status?: "active" | "inactive";
}

/** Класс для работы с пользователями */
export class UserService {
  /** Получение списка пользователей */
  static async getUsers(
    filters: UserFilters = {},
    pagination: PaginationParams = { page: 1, limit: 10 }
  ): Promise<UsersResponse> {
    // Validate session before operation
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ApiError("Invalid session: " + (sessionValidation.error || "Session expired"), 401);
    }

    void filters; void pagination;

    // Get auth headers
    const headers = await getAuthHeaders();
    
    // Build query parameters
    const params = new URLSearchParams();
    params.append('page', pagination.page.toString());
    params.append('limit', pagination.limit.toString());
    
    // Add filters as query parameters
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== "all") params.append('status', filters.status);
    if (filters.role && filters.role !== "all") params.append('role', filters.role);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    // Send direct HTTP GET request to Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/users?${params.toString()}`, {
      method: 'GET',
      headers
    });

    const responseData = await response.json();
    void response;

    if (!response.ok) {
      throw new ApiError(responseData.error || "Failed to fetch users", response.status);
    }

    // Return the response in expected format
    return {
      users: responseData.users || [],
      total: responseData.total || responseData.users?.length || 0,
      page: pagination.page,
      limit: pagination.limit
    };
  }

  /** Создание пользователя */
  static async createUser(userData: CreateUserData): Promise<UserProfile> {
    if (!userData.email || !userData.password || !userData.name) {
      throw new ApiError("Missing required fields: email, password, or name", 400);
    }

    // Validate session before operation
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ApiError("Invalid session: " + (sessionValidation.error || "Session expired"), 401);
    }

    console.log("UserService.createUser called with:", userData);

    // Get auth headers
    const headers = await getAuthHeaders();
    
    // Send direct HTTP POST request to Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        phone: userData.phone,
        role: userData.role || 'user'
      })
    });

    const responseData = await response.json();
    console.log("UserService.createUser response:", { status: response.status, responseData });

    if (!response.ok) {
      throw new ApiError(responseData.error || "Failed to create user", response.status);
    }

    if (!responseData || !responseData.user) {
      throw new ApiError("Invalid response from server", 500);
    }

    return responseData.user;
  }

  /** Обновление пользователя */
  static async updateUser(id: string, data: UpdateUserData): Promise<UserProfile> {
    if (!id) throw new ApiError("User ID is required", 400);
    
    // Validate session before operation
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ApiError("Invalid session: " + (sessionValidation.error || "Session expired"), 401);
    }

    // Убираем undefined, но оставляем null
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanData).length === 0) {
      throw new ApiError("No fields provided for update", 400);
    }

    void id; void cleanData;

    // Get auth headers
    const headers = await getAuthHeaders();
    
    // Send direct HTTP PATCH request to Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/users/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(cleanData)
    });

    const responseData = await response.json();
    void response;

    if (!response.ok) {
      throw new ApiError(responseData.error || "Failed to update user", response.status);
    }

    if (!responseData || !responseData.user) {
      throw new ApiError("Invalid response from server", 500);
    }

    return responseData.user;
  }

  /** Получение одного пользователя */
  static async getUser(id: string): Promise<UserProfile> {
    if (!id) throw new ApiError("User ID is required", 400);

    // Validate session before operation
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ApiError("Invalid session: " + (sessionValidation.error || "Session expired"), 401);
    }

    void id;

    // Get auth headers
    const headers = await getAuthHeaders();
    
    // Send direct HTTP GET request to Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/users/${id}`, {
      method: 'GET',
      headers
    });

    const responseData = await response.json();
    void response;

    if (!response.ok) {
      throw new ApiError(responseData.error || "Failed to get user", response.status);
    }

    if (!responseData || !responseData.user) {
      throw new ApiError("User not found", 404);
    }

    return responseData.user;
  }

  /** Удаление пользователя */
  static async deleteUser(id: string): Promise<{success: boolean, deletedAuth: boolean, deletedProfile: boolean}> {
    if (!id) throw new ApiError("User ID is required", 400);

    // Validate session before operation
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ApiError("Invalid session: " + (sessionValidation.error || "Session expired"), 401);
    }

    console.log("UserService.deleteUser called with:", { id });

    // Get auth headers
    const headers = await getAuthHeaders();
    
    // Send direct HTTP DELETE request to Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/users/${id}`, {
      method: 'DELETE',
      headers
    });

    const responseData = await response.json();
    console.log("UserService.deleteUser response:", { status: response.status, responseData });

    if (!response.ok) {
      throw new ApiError(responseData.error || "Failed to delete user", response.status);
    }

    if (!responseData || typeof responseData.success !== 'boolean') {
      throw new ApiError("Invalid response from server", 500);
    }

    return {
      success: responseData.success,
      deletedAuth: responseData.deletedAuth || false,
      deletedProfile: responseData.deletedProfile || false
    };
  }

  /** Переключение статуса пользователя */
  static async toggleUserStatus(id: string, status: "active" | "inactive"): Promise<UserProfile> {
    // Validate parameters
    if (!id) throw new ApiError("User ID is required", 400);
    if (status === undefined || status === null) throw new ApiError("Status is required", 400);
    if (!["active", "inactive"].includes(status)) throw new ApiError("Invalid status value", 400);

    console.log("UserService.toggleUserStatus called with:", { id, status });

    return this.updateUser(id, { status });
  }
}

/** Класс для ошибок API */
export class ApiError extends Error {
  constructor(message: string, public status: number = 500, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError };

/** Обработка ошибок */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ServiceError) {
    return new ApiError(error.message, error.status ?? 500, error.code);
  }

  const asService = toServiceError(error);
  if (asService) {
    return new ApiError(asService.message, asService.status ?? 500, asService.code);
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return new ApiError(error.message, 500);
    }
    if ("error" in error && typeof error.error === "string") {
      return new ApiError(error.error, 500);
    }
  }

  return new ApiError("An unexpected error occurred", 500);
}
