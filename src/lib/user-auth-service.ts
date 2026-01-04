import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "./profile-service";
import type { UserMenuItem } from "./user-menu-service";
import { 
  RegistrationData, 
  LoginData, 
  ResetPasswordData, 
  AuthResponse, 
  UserAuthError,
  UserProfile,
  AuthorizationError,
  SessionContext
} from "./user-auth-schemas";
import { AuthorizationErrorHandler } from "./error-handler";
import { invokeEdgeWithAuth, SessionValidator, isAuthenticationError } from "./session-validation";
import { readCache, writeCache, removeCache, CACHE_TTL } from "./cache-utils";
import { registerUser, type RegistrationOptions } from "./user-auth-register";
import { signInWithFacebook, signInWithGoogle, handleOAuthCallback } from "./user-auth-oauth";
import { loginUser, logout, resetPassword, updatePassword } from "./user-auth-login";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

type UserStoreLite = { id: string; store_name: string };

type AuthMeData = {
  user: UserProfile | null;
  subscription: any | null;
  tariffLimits: Array<{ limit_name: string; value: number }>;
  menuItems: UserMenuItem[];
  userStores: UserStoreLite[];
};

export class UserAuthService {
  private static authMeDeduplicator = RequestDeduplicatorFactory.create<AuthMeData>("user-auth-service:authMe", {
    ttl: 30_000,
    maxSize: 200,
    enableMetrics: true,
    errorStrategy: "remove",
    maxRetries: 0,
  });

  private static getAuthMeCacheKey(userId: string): string {
    return `auth-me:${userId}`;
  }
  /**
   * Register a new user with email confirmation flow
   * Following Supabase email confirmation workflow:
   * 1. Registration creates user but no token until email confirmed
   * 2. User receives email with confirmation link
   * 3. After confirmation, user can login to get access token
   */
  static async register(data: RegistrationData, options: Partial<RegistrationOptions> = {}): Promise<AuthResponse> {
    return await registerUser(data, options, {
      mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error),
      isAuthorizationError: (error) => UserAuthService.isAuthorizationError(error),
    });
  }

  /**
   * Sign in with Google OAuth
   */
  static async signInWithGoogle(): Promise<AuthResponse> {
    return await signInWithGoogle({
      mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error),
    });
  }

  /**
   * Sign in with Facebook OAuth
   */
  static async signInWithFacebook(): Promise<AuthResponse> {
    return await signInWithFacebook({
      mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error),
    });
  }

  /**
   * Handle OAuth callback and ensure proper role assignment
   * Also handles email confirmation callback
   */
  static async handleOAuthCallback(): Promise<AuthResponse> {
    return await handleOAuthCallback();
  }

  /**
   * Login user and validate role
   * Properly handles email confirmation flow
   */
  static async login(data: LoginData): Promise<AuthResponse> {
    return await loginUser(data, {
      mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error),
      clearAuthMeCache: () => UserAuthService.clearAuthMeCache(),
      fetchAuthMe: () => UserAuthService.fetchAuthMe(),
    });
  }

  /**
   * Initiate password reset
   */
  static async resetPassword(data: ResetPasswordData): Promise<{ success: boolean; error: string | null }> {
    return await resetPassword(data, { mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error) });
  }

  /**
   * Update password with reset token
   */
  static async updatePassword(password: string): Promise<{ success: boolean; error: string | null }> {
    return await updatePassword(password, { mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error) });
  }

  /**
   * Logout user
   */
  static async logout(): Promise<{ success: boolean; error: string | null }> {
    return await logout({ mapSupabaseError: (error) => UserAuthService.mapSupabaseError(error) });
  }

  static async fetchAuthMe(): Promise<AuthMeData> {
    const validation = await SessionValidator.ensureValidSession();
    if (!validation.isValid || !validation.session || !validation.user) {
      this.clearAuthMeCache();
      return { user: null, subscription: null, tariffLimits: [], menuItems: [], userStores: [] };
    }
    const cacheKey = this.getAuthMeCacheKey(validation.user.id);
    const sessionKey = `${validation.user.id}:${validation.expiresAt ?? 0}`;
    const cached = readCache<AuthMeData>(cacheKey);
    if (cached?.data) {
      return cached.data;
    }
    return await this.authMeDeduplicator.dedupe(sessionKey, async () => {
      try {
        const timeoutMs = 12_000;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const resp = await Promise.race([
          invokeEdgeWithAuth<{
          user?: UserProfile | null;
          subscription?: unknown | null;
          tariffLimits?: Array<{ limit_name: string; value: number }>;
          menuItems?: UserMenuItem[];
          userStores?: UserStoreLite[];
          }>("auth-me", {}),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("auth_me_timeout")), timeoutMs);
          }),
        ]).finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        });
        const result = {
          user: (resp?.user ?? null) as UserProfile | null,
          subscription: resp?.subscription ?? null,
          tariffLimits: Array.isArray(resp?.tariffLimits)
            ? (resp.tariffLimits as Array<{ limit_name: string; value: number }>)
            : [],
          menuItems: Array.isArray(resp?.menuItems) ? (resp.menuItems as UserMenuItem[]) : [],
          userStores: Array.isArray(resp?.userStores) ? (resp.userStores as UserStoreLite[]) : [],
        };
        writeCache(cacheKey, result, CACHE_TTL.authMe);
        return result;
      } catch {
        const cachedFallback = readCache<AuthMeData>(cacheKey, true);
        return cachedFallback?.data || { user: null, subscription: null, tariffLimits: [], menuItems: [], userStores: [] };
      }
    });
  }

  static clearAuthMeCache(): void {
    this.authMeDeduplicator.clear();
    removeCache("auth-me");
    try {
      if (typeof window === "undefined") return;
      const storages: Storage[] = [];
      try {
        storages.push(window.localStorage);
      } catch {
        void 0;
      }
      try {
        storages.push(window.sessionStorage);
      } catch {
        void 0;
      }
      for (const s of storages) {
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (!k) continue;
          if (k === "auth-me" || k === "v1:auth-me" || k.startsWith("auth-me:") || k.startsWith("v1:auth-me:")) {
            keys.push(k);
          }
        }
        for (const k of keys) {
          try {
            s.removeItem(k);
          } catch {
            void 0;
          }
        }
      }
    } catch {
      void 0;
    }
  }

  /**
   * Get current user session and profile
   */
  static async getCurrentUser(): Promise<AuthResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          user: null,
          session: null,
          error: null
        };
      }

      const authMe = await this.fetchAuthMe();
      return {
        user: authMe.user,
        session: session,
        error: null
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        user: null,
        session: null,
        error: UserAuthError.NETWORK_ERROR
      };
    }
  }

  /**
   * Create user profile in database
   */
  private static async createUserProfile(userId: string, userData: { email: string; name: string }): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userData.email,
        name: userData.name
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in createUserProfile:', error);
    throw error;
  }
}


  /**
   * Get user profile from database (deprecated - use ProfileService.getProfile instead)
   * @deprecated Use ProfileService.getProfile for better error handling
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    console.warn('getUserProfile is deprecated, use ProfileService.getProfile instead');
    return ProfileService.getProfile(userId);
  }

  /**
   * Wait for database trigger to create profile (fallback strategy)
   */
  private static async waitForTriggerProfile(
    userId: string, 
    maxWaitTime: number = 3000
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 200;
    
    console.log(`Waiting for trigger-created profile for user ${userId}...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const profile = await ProfileService.getProfile(userId);
        if (profile) {
          console.log('Trigger-created profile detected:', profile.id);
          return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.warn('Error checking for trigger profile:', error);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    console.warn(`No trigger profile found within ${maxWaitTime}ms for user ${userId}`);
    return false;
  }

  /**
   * Wait for session to be ready with proper authentication context
   * Enhanced with comprehensive session validation
   */
  private static async waitForSessionReady(userId: string, timeout: number): Promise<SessionContext> {
    console.log(`[UserAuthService] Waiting for session to be ready for user ${userId}...`);
    
    const validation = await SessionValidator.waitForValidSession(userId, timeout);
    
    if (validation.isValid) {
      console.log('[UserAuthService] Session ready for user:', userId);
      return {
        accessToken: validation.accessToken,
        refreshToken: validation.refreshToken,
        userId: validation.user!.id,
        isReady: true,
        expiresAt: validation.expiresAt
      };
    }
    
    console.warn(`[UserAuthService] Session not ready after ${timeout}ms timeout for user ${userId}`);
    return {
      accessToken: null,
      refreshToken: null,
      userId,
      isReady: false,
      expiresAt: null
    };
  }

  /**
   * Create profile with session-aware retry mechanism
   */
  private static async createProfileWithSessionRetry(
    profileData: Partial<UserProfile> & { id: string },
    sessionContext: SessionContext,
    config: RegistrationOptions
  ): Promise<UserProfile> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`Profile creation attempt ${attempt}/${config.maxRetries}`);
        
        // Add delay before each attempt (except the first)
        if (attempt > 1) {
          const delay = config.retryDelay * Math.pow(2, attempt - 2); // Exponential backoff
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Refresh session if needed
          if (sessionContext.isReady && sessionContext.expiresAt && 
              Date.now() > sessionContext.expiresAt - 60000) { // Refresh if expires within 1 minute
            await this.refreshSessionIfNeeded();
          }
        } else {
          // Initial delay to allow for trigger processing
          await new Promise(resolve => setTimeout(resolve, config.profileCreationDelay));
        }
        
        // Attempt profile creation with current session context
        const profile = await ProfileService.createProfileWithVerification(profileData);
        
        console.log(`Profile creation successful on attempt ${attempt}`);
        return profile;
        
      } catch (error) {
        lastError = error;
        console.error(`Profile creation attempt ${attempt} failed:`, error);
        
        // If this is an authorization error, log additional context
        if (this.isAuthorizationError(error)) {
          console.error('Authorization error detected:', {
            attempt,
            sessionReady: sessionContext.isReady,
            hasAccessToken: !!sessionContext.accessToken,
            userId: profileData.id
          });
          
          // If session appears ready but we still get auth errors, wait longer
          if (sessionContext.isReady && attempt < config.maxRetries) {
            console.log('Session appears ready but auth failed, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // If not the last attempt, continue retrying
        if (attempt < config.maxRetries) {
          console.log(`Retrying profile creation (${config.maxRetries - attempt} attempts remaining)`);
          continue;
        }
      }
    }
    
    // All attempts failed
    console.error(`Profile creation failed after ${config.maxRetries} attempts`);
    throw lastError || new Error('Profile creation failed after maximum retries');
  }

  /**
   * Enhanced authorization error detection
   */
  private static isAuthorizationError(error: any): boolean {
    return isAuthenticationError(error);
  }

  /**
   * Handle profile creation errors with specific error mapping
   */
  private static handleProfileCreationError(error: any): string {
    if (this.isAuthorizationError(error)) {
      return UserAuthError.INSUFFICIENT_PERMISSIONS;
    }
    
    if (error.code === 'PGRST116') {
      return UserAuthError.USER_NOT_FOUND;
    }
    
    if (error.message?.includes('duplicate key')) {
      return UserAuthError.EMAIL_EXISTS;
    }
    
    return UserAuthError.PROFILE_CREATION_FAILED;
  }

  /**
   * Refresh session if needed to maintain valid authentication
   */
  private static async refreshSessionIfNeeded(): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('Failed to refresh session:', error);
        return;
      }
      
      if (session) {
        console.log('Session refreshed successfully');
      }
    } catch (error) {
      console.warn('Exception during session refresh:', error);
    }
  }

  /**
   * Extract session context from authentication response
   */
  private static extractSessionContext(authData: any): SessionContext {
    return {
      accessToken: authData.session?.access_token || null,
      refreshToken: authData.session?.refresh_token || null,
      userId: authData.user?.id || '',
      isReady: !!(authData.session?.access_token && authData.user?.id),
      expiresAt: authData.session?.expires_at ? authData.session.expires_at * 1000 : null
    };
  }

  /**
   * Get current access token from session
   * Enhanced with session validation
   */
  private static async getCurrentAccessToken(): Promise<string | null> {
    try {
      const validation = await SessionValidator.validateSession();
      
      if (!validation.isValid || !validation.accessToken) {
        console.warn('[UserAuthService] No valid access token available');
        return null;
      }
      
      return validation.accessToken;
    } catch (error) {
      console.error('[UserAuthService] Error getting current session:', error);
      return null;
    }
  }

  /**
   * Map Supabase auth errors to user-friendly messages with enhanced error types
   * Enhanced for email confirmation flow
   */
  private static mapSupabaseError(error: any): string {
    const message = error.message?.toLowerCase() || '';
    const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    
    // Email confirmation specific errors
    if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
      return UserAuthError.EMAIL_CONFIRMATION_REQUIRED;
    }
    if (message.includes('email address not confirmed') || message.includes('signup requires a confirmation')) {
      return UserAuthError.EMAIL_CONFIRMATION_REQUIRED;
    }
    
    // Credential errors
    if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
      return UserAuthError.INVALID_CREDENTIALS;
    }
    
    // User existence errors
    if (message.includes('user already registered') || message.includes('email already registered')) {
      return UserAuthError.EMAIL_EXISTS;
    }
    if (message.includes('user not found') || message.includes('no user found')) {
      return UserAuthError.USER_NOT_FOUND;
    }
    
    // Password errors
    if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
      return UserAuthError.WEAK_PASSWORD;
    }
    
    // Network and connection errors
    if (message.includes('network') || message.includes('connection')) {
      return UserAuthError.NETWORK_ERROR;
    }
    
    // Rate limiting
    if (code === 'over_email_send_rate_limit' || message.includes('too many') || message.includes('rate limit')) {
      return UserAuthError.RATE_LIMIT_EXCEEDED;
    }

    // Email provider disabled / email signups disabled
    if (
      code === 'email_provider_disabled' ||
      message.includes('email provider disabled') ||
      message.includes('email signups are disabled')
    ) {
      return UserAuthError.EMAIL_PROVIDER_DISABLED;
    }
    
    // Authorization errors
    if (message.includes('unauthorized') || message.includes('401')) {
      return UserAuthError.INSUFFICIENT_PERMISSIONS;
    }
    
    // Default fallback
    console.warn('Unmapped Supabase error:', { message, code: error.code, status: error.status });
    return UserAuthError.REGISTRATION_FAILED;
  }

  /**
   * Handle authorization errors with enhanced retry logic
   */
  static async handleAuthorizationError(
    error: any, 
    attemptCount: number, 
    maxAttempts: number = 3
  ): Promise<{ shouldRetry: boolean; waitTime: number; userMessage: string }> {
    const authError = AuthorizationErrorHandler.analyzeAuthorizationError(error);
    const shouldRetry = AuthorizationErrorHandler.shouldRetry(authError, attemptCount, maxAttempts);
    const waitTime = AuthorizationErrorHandler.getRetryWaitTime(authError, attemptCount);
    const userMessage = AuthorizationErrorHandler.getUserFriendlyMessage(authError);
    
    console.log('Authorization error handling decision:', {
      error: authError,
      shouldRetry,
      waitTime,
      attemptCount,
      maxAttempts
    });
    
    return { shouldRetry, waitTime, userMessage };
  }
}
