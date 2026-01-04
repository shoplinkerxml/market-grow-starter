/**
 * Centralized Profile Service
 * 
 * This service provides standardized methods for profile operations
 * with proper error handling for PostgREST PGRST116 errors.
 * It replaces direct .single() calls with .maybeSingle() to prevent
 * 406 "Not Acceptable" errors when profiles don't exist.
 */

import {
  checkMultipleUsersExist,
  createProfile,
  createProfileWithVerification,
  ensureProfile,
  findProfilesByEmailPattern,
  getProfile,
  getProfileByEmail,
  getProfileFields,
  getUserRole,
  hasAdminAccess,
  isAdmin,
  profileExistsByEmail,
  requireProfile,
  updateProfile,
  upsertProfile,
} from "./profile-crud";
import { createProfileWithAuth, createProfileWithAuthContext, createProfileWithAuthRetry } from "./profile-auth";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive';
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Profile error types for consistent error handling
 */
export enum ProfileError {
  PROFILE_NOT_FOUND = 'profile_not_found',
  PROFILE_CREATION_FAILED = 'profile_creation_failed',
  PROFILE_UPDATE_FAILED = 'profile_update_failed',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  NETWORK_ERROR = 'network_error'
}

export class ProfileService {
  static async getProfileByEmail(email: string): Promise<UserProfile | null> {
    return await getProfileByEmail(email);
  }

  static async getProfile(userId: string): Promise<UserProfile | null> {
    return await getProfile(userId);
  }

  static async requireProfile(userId: string): Promise<UserProfile> {
    return await requireProfile(userId);
  }

  static async checkMultipleUsersExist(emails: string[]): Promise<Map<string, boolean>> {
    return await checkMultipleUsersExist(emails);
  }

  static async getProfileFields(userId: string, fields: string[]): Promise<Partial<UserProfile> | null> {
    return await getProfileFields(userId, fields);
  }

  static async upsertProfile(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
    return await upsertProfile(profileData);
  }

  static async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    return await updateProfile(userId, updates);
  }

  static async isAdmin(userId: string): Promise<boolean> {
    return await isAdmin(userId);
  }

  static async hasAdminAccess(userId: string): Promise<boolean> {
    return await hasAdminAccess(userId);
  }

  static async getUserRole(userId: string): Promise<string | null> {
    return await getUserRole(userId);
  }

  static async ensureProfile(userId: string, profileData: { email: string; name: string }): Promise<UserProfile | null> {
    return await ensureProfile(userId, profileData);
  }

  static async createProfileWithAuthContext(
    profileData: Partial<UserProfile> & { id: string },
    options: { waitForAuth?: boolean; maxWaitTime?: number } = {},
  ): Promise<UserProfile> {
    return await createProfileWithAuthContext(profileData, options);
  }

  static async createProfileWithAuthRetry(
    profileData: Partial<UserProfile> & { id: string },
    maxRetries: number = 3,
  ): Promise<UserProfile> {
    return await createProfileWithAuthRetry(profileData, maxRetries);
  }

  static async createProfileWithVerification(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    return await createProfileWithVerification(profileData);
  }

  static async createProfile(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
    return await createProfile(profileData);
  }

  static async findProfilesByEmailPattern(pattern: string, limit: number = 10): Promise<UserProfile[]> {
    return await findProfilesByEmailPattern(pattern, limit);
  }

  static async profileExistsByEmail(email: string): Promise<boolean> {
    return await profileExistsByEmail(email);
  }

  static async createProfileWithAuth(profileData: Partial<UserProfile> & { id: string }, accessToken?: string): Promise<UserProfile> {
    return await createProfileWithAuth(profileData, accessToken);
  }
}

/**
 * Error response creator for consistent API responses
 */
export function createErrorResponse(message: string, code?: string, status = 500): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Content-Type': 'application/json'
  };

  return new Response(
    JSON.stringify({ 
      error: message, 
      code,
      timestamp: new Date().toISOString()
    }),
    { 
      status, 
      headers: corsHeaders 
    }
  );
}

/**
 * API Service for handling responses with PostgREST error handling
 */
export class APIService {
  static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 406) {
        // Handle PostgREST 406 errors specifically
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'PGRST116') {
          return null as T; // Convert to null for empty results
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}
