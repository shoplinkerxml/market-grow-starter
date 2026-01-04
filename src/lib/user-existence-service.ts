/**
 * User Existence Check Service
 * 
 * This service provides comprehensive user existence validation to prevent
 * unnecessary signup attempts and improve registration flow efficiency.
 * It addresses the issue where the system makes redundant API calls to
 * Supabase Auth even when users already exist.
 */

import { supabase } from "@/integrations/supabase/client";
import { ProfileService, UserProfile } from "./profile-service";
import { ProfileCache } from "./error-handler";

/**
 * User existence check result interface
 */
export interface UserExistenceCheck {
  exists: boolean;
  profile?: UserProfile | null;
  authUser?: boolean;
  existenceType?: 'profile_only' | 'auth_only' | 'both' | 'none';
}

/**
 * Registration error types with specific user existence scenarios
 */
export interface RegistrationError {
  type: 'validation' | 'user_exists' | 'network' | 'rate_limit' | 'signup_failed' | 'profile_failed';
  message: string;
  code: string;
  retryable: boolean;
  suggestedAction?: string;
}

/**
 * User existence validation service
 */
export class UserExistenceService {
  private static readonly CACHE_PREFIX = 'user_existence_';
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Primary method for checking if a user exists
   * Uses profile-based checking only for reliability
   */
  static async checkUserExists(email: string): Promise<UserExistenceCheck> {
    try {
      if (!this.validateEmailFormat(email)) {
        throw new Error('Invalid email format');
      }

      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${email.toLowerCase()}`;
      const cached = ProfileCache.get(cacheKey) as UserExistenceCheck | null;
      if (cached && typeof cached === 'object' && 'exists' in cached) {
        this.logCheck(email, cached.exists, 'cached');
        return cached;
      }

      // Main check through profile (more reliable than auth check)
      const profile = await ProfileService.getProfileByEmail(email);
      
      const result: UserExistenceCheck = {
        exists: !!profile,
        profile: profile,
        authUser: !!profile, // If profile exists, auth user exists
        existenceType: profile ? 'both' : 'none'
      };
      
      // Cache the result
      ProfileCache.set(cacheKey, result);
      this.logCheck(email, result.exists, profile ? 'profile_found' : 'not_found');
      
      return result;
    } catch (error) {
      console.error('Error checking user existence:', error);
      this.logCheck(email, false, 'error');
      
      // Safe default - assume user doesn't exist on error
      return {
        exists: false,
        profile: null,
        authUser: false,
        existenceType: 'none'
      };
    }
  }

  /**
   * Check if user exists by ID
   */
  static async checkUserExistsById(id: string): Promise<boolean> {
    try {
      const profile = await ProfileService.getProfile(id);
      return !!profile;
    } catch (error) {
      console.error('Error checking user existence by ID:', error);
      return false;
    }
  }

  /**
   * Check if auth user exists without profile (DEPRECATED)
   * This method is unreliable and should not be used
   * @deprecated Use profile-based checking instead
   */
  static async checkAuthUserExists(email: string): Promise<boolean> {
    console.warn('checkAuthUserExists is deprecated and unreliable. Use profile-based checking instead.');
    
    // Always return false to force profile-based checking
    // This method has been identified as unreliable due to:
    // 1. Uses dummy password approach which can trigger rate limits
    // 2. Error message parsing is brittle and inconsistent
    // 3. Can cause false positives
    return false;
  }

  /**
   * Comprehensive existence check across both auth and profiles
   * Provides detailed information about user state
   */
  static async comprehensiveUserCheck(email: string): Promise<UserExistenceCheck> {
    try {
      const result = await this.checkUserExists(email);
      
      // Additional validation and detailed state detection
      if (result.exists && result.profile) {
        // User has both auth and profile - fully registered
        return {
          ...result,
          existenceType: 'both'
        };
      }
      
      if (result.exists && !result.profile) {
        // User has auth but no profile - incomplete registration
        return {
          ...result,
          existenceType: 'auth_only'
        };
      }
      
      // User doesn't exist
      return {
        ...result,
        existenceType: 'none'
      };
    } catch (error) {
      console.error('Error in comprehensive user check:', error);
      return {
        exists: false,
        profile: null,
        authUser: false,
        existenceType: 'none'
      };
    }
  }

  /**
   * Batch existence check for multiple emails
   * Useful for admin operations or bulk validation
   */
  static async checkMultipleUsersExist(emails: string[]): Promise<Map<string, boolean>> {
    if (!Array.isArray(emails) || emails.length === 0) return new Map<string, boolean>();
    return await ProfileService.checkMultipleUsersExist(emails);
  }

  /**
   * Clear existence cache for a specific email
   */
  static clearExistenceCache(email: string): void {
    const cacheKey = `${this.CACHE_PREFIX}${email.toLowerCase()}`;
    ProfileCache.clearUser(cacheKey);
  }

  /**
   * Clear all existence cache
   */
  static clearAllExistenceCache(): void {
    ProfileCache.clear();
  }

  /**
   * Validate email format
   */
  static validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get registration error with specific messaging
   */
  static getRegistrationError(type: RegistrationError['type'], originalError?: any): RegistrationError {
    const errorMap: Record<RegistrationError['type'], Omit<RegistrationError, 'type'>> = {
      validation: {
        message: 'Please check your input and try again.',
        code: 'VALIDATION_ERROR',
        retryable: true,
        suggestedAction: 'Correct the highlighted fields and resubmit.'
      },
      user_exists: {
        message: 'An account with this email already exists. Please sign in instead.',
        code: 'USER_EXISTS',
        retryable: false,
        suggestedAction: 'Use the sign in form or reset your password if needed.'
      },
      network: {
        message: 'Network connection issue. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
        retryable: true,
        suggestedAction: 'Check your internet connection and retry.'
      },
      rate_limit: {
        message: 'Too many registration attempts. Please try again in a few minutes.',
        code: 'RATE_LIMIT',
        retryable: true,
        suggestedAction: 'Wait a few minutes before attempting registration again.'
      },
      signup_failed: {
        message: 'Registration failed. Please try again.',
        code: 'SIGNUP_FAILED',
        retryable: true,
        suggestedAction: 'Try again or contact support if the problem persists.'
      },
      profile_failed: {
        message: 'Account created but profile setup failed. Please contact support.',
        code: 'PROFILE_FAILED',
        retryable: false,
        suggestedAction: 'Contact support to complete your account setup.'
      }
    };

    return {
      type,
      ...errorMap[type]
    };
  }

  /**
   * Log user existence check for monitoring and debugging
   */
  private static logCheck(email: string, exists: boolean, source: string): void {
    const maskedEmail = email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
    console.log(`[UserExistenceService] Check for ${maskedEmail}: ${exists ? 'EXISTS' : 'NOT_FOUND'} (${source})`, {
      timestamp: new Date().toISOString(),
      source,
      exists
    });
  }
}
