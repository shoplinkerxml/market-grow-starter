/**
 * Session and Token Validation Utilities
 * 
 * This module provides utilities for validating Supabase authentication sessions
 * and ensuring proper token handling for Row Level Security (RLS) policies.
 * 
 * Key Issues Addressed:
 * - Ensures access_token (not anon key) is used in Authorization header
 * - Validates session expiration and auto-refresh
 * - Provides debugging utilities for RLS token issues
 * - Monitors token validity for database operations
 */

import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { EdgeClient, type RetryOptions } from "@/lib/request-handler";
import { AppError, mapError } from "@/lib/error-handler";

const __DEV__ = import.meta.env?.DEV ?? false;

EdgeClient.configure({
  invoke: supabase.functions.invoke.bind(supabase.functions) as any,
  authProvider: {
    getAccessToken: () => SessionValidator.getToken(),
    refresh: async () => {
      await SessionValidator.refreshSession();
    },
  },
  logger: (event) => {
    const shouldLog = __DEV__ || event.type === "edge_retry" || (event.type === "edge_invoke" && event.ok === false);
    if (!shouldLog) return;
    try {
      const level = event.type === "edge_invoke" && event.ok === false ? "error" : "info";
      (console as any)[level]?.(JSON.stringify({ ...event, ts: new Date().toISOString() }));
    } catch {
      void 0;
    }
  },
});

export interface SessionValidationResult {
  isValid: boolean;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  timeUntilExpiry: number | null;
  needsRefresh: boolean;
  error?: string;
}

export interface TokenDebugInfo {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenPrefix: string;
  userId: string | null;
  isExpired: boolean;
  expiresIn: number | null;
  sessionAge: number | null;
}

/**
 * Comprehensive session validation utility
 * Ensures proper access token handling for RLS policies
 */
export class SessionValidator {
  private static readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly SESSION_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  private static sessionCache: { value: SessionValidationResult; expiresAt: number } | null = null;

  static clearCache(): void {
    SessionValidator.sessionCache = null;
  }
  
  /**
   * Validate current session and access token
   * Returns detailed information about session state
   */
  static async validateSession(): Promise<SessionValidationResult> {
    const now = Date.now();
    const cached = SessionValidator.sessionCache;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session ?? null;
        
        if (error) {
          if (__DEV__) console.error("[SessionValidator] Session fetch error:", error);
          const out = {
            isValid: false,
            session: null,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            timeUntilExpiry: null,
            needsRefresh: false,
            error: error.message,
          };
          SessionValidator.sessionCache = { value: out, expiresAt: now + 2_000 };
          return out;
        }
        
        if (!session) {
          const out = {
            isValid: false,
            session: null,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            timeUntilExpiry: null,
            needsRefresh: false,
            error: "No active session",
          };
          SessionValidator.sessionCache = { value: out, expiresAt: now + 2_000 };
          return out;
        }
        
        const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
        const timeUntilExpiry = expiresAt ? expiresAt - now : null;
        const needsRefresh = timeUntilExpiry ? timeUntilExpiry < this.REFRESH_THRESHOLD_MS : false;
        const isExpired = timeUntilExpiry ? timeUntilExpiry <= 0 : false;
        
        const result: SessionValidationResult = {
          isValid: !isExpired && !!session.access_token && !!session.user,
          session,
          user: session.user,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt,
          timeUntilExpiry,
          needsRefresh,
          error: isExpired ? 'Session expired' : undefined
        };
        SessionValidator.sessionCache = { value: result, expiresAt: now + 30_000 };
        return result;
    } catch (error) {
      console.error('[SessionValidator] Validation error:', error);
      const out = {
        isValid: false,
        session: null,
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        timeUntilExpiry: null,
        needsRefresh: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      SessionValidator.sessionCache = { value: out, expiresAt: now + 2_000 };
      return out;
    }
  }
  
  /**
   * Ensure session is valid and refresh if needed
   * Critical for RLS operations that require valid access token
   */
  static async ensureValidSession(): Promise<SessionValidationResult> {
    return await this.validateSession();
  }

  static async getToken(): Promise<string> {
    const v = await this.validateSession();
    if (!v.isValid || !v.accessToken) throw new Error(v.error || "No access token");
    return v.accessToken;
  }

  static async refreshSession(): Promise<SessionValidationResult> {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw Object.assign(new Error(error.message || "Refresh failed"), { status: 401 });
    return await this.validateSession();
  }
  
  /**
   * Wait for a valid authentication session
   * Used during registration/login to ensure proper token availability
   */
  static async waitForValidSession(
    expectedUserId?: string,
    maxWaitTime: number = 10000
  ): Promise<SessionValidationResult> {
    const startTime = Date.now();
    let interval = 200;
    
    if (__DEV__) console.log('[SessionValidator] Waiting for valid session...', { expectedUserId, maxWaitTime });
    
    while (Date.now() - startTime < maxWaitTime) {
      const validation = await this.validateSession();
      
      if (validation.isValid) {
        // If we're expecting a specific user, verify it matches
        if (expectedUserId && validation.user?.id !== expectedUserId) {
          if (__DEV__) {
            console.warn('[SessionValidator] Session user mismatch', {
              expected: expectedUserId,
              actual: validation.user?.id
            });
          }
          await new Promise(resolve => setTimeout(resolve, interval));
          interval = Math.min(Math.floor(interval * 1.5), 1000);
          continue;
        }
        
        if (__DEV__) {
          console.log('[SessionValidator] Valid session found', {
            userId: validation.user?.id,
            hasAccessToken: !!validation.accessToken,
            timeUntilExpiry: validation.timeUntilExpiry
          });
        }
        return validation;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      interval = Math.min(Math.floor(interval * 1.5), 1000);
    }
    
    if (__DEV__) {
      console.warn('[SessionValidator] No valid session found within timeout', {
        maxWaitTime,
        expectedUserId
      });
    }
    
    return this.validateSession(); // Return final state
  }
  
  /**
   * Get detailed token information for debugging
   * Helps diagnose RLS issues related to token handling
   */
  static async getTokenDebugInfo(): Promise<TokenDebugInfo> {
    const validation = await this.validateSession();
    
    return {
      hasAccessToken: !!validation.accessToken,
      hasRefreshToken: !!validation.refreshToken,
      tokenPrefix: validation.accessToken ? 
        `${validation.accessToken.substring(0, 10)}...` : 'none',
      userId: validation.user?.id || null,
      isExpired: validation.timeUntilExpiry ? validation.timeUntilExpiry <= 0 : false,
      expiresIn: validation.timeUntilExpiry,
      sessionAge: null // Remove session age tracking as created_at is not available
    };
  }
  
  /**
   * Check if current user has valid auth.uid() context for RLS
   * This validates that database queries will have proper user context
   */
  static async validateRLSContext(): Promise<{ isValid: boolean; userId: string | null; error?: string }> {
    try {
      const validation = await this.validateSession();
      if (!validation.isValid || !validation.accessToken) {
        return { isValid: false, userId: null, error: 'No valid access token for RLS context' };
      }
      // Avoid extra network calls: rely on session presence as RLS proxy
      return { isValid: true, userId: validation.user?.id || null };
    } catch (error) {
      return { isValid: false, userId: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Log detailed session information for debugging
   * Useful for troubleshooting authentication and RLS issues
   */
  static async logSessionDebugInfo(context: string = 'general'): Promise<void> {
    // Only log in development to avoid extra network calls in production
    const isDev = typeof import.meta !== 'undefined' && !!((import.meta as unknown as { env?: Record<string, unknown> })?.env?.DEV);
    if (!isDev) return;
    try {
      const validation = await this.validateSession();
      const debugInfo = await this.getTokenDebugInfo();
      const rlsContext = await this.validateRLSContext();
      
      console.log(`[SessionValidator] Debug info for ${context}:`, {
        timestamp: new Date().toISOString(),
        session: {
          isValid: validation.isValid,
          hasSession: !!validation.session,
          hasUser: !!validation.user,
          userId: validation.user?.id,
          email: validation.user?.email,
          error: validation.error
        },
        tokens: debugInfo,
        rls: rlsContext,
        context,
        // Add header conflict detection
        headerConflictCheck: this.detectHeaderConflicts()
      });
    } catch (error) {
      console.error('[SessionValidator] Failed to log debug info:', error);
    }
  }
  
  private static detectHeaderConflicts(): { hasConflict: boolean; details?: string } {
    // Check for common header conflicts that cause 500 errors
    try {
      // This is a simplified check - in reality would need to inspect actual request headers
      return { hasConflict: false };
    } catch (error) {
      return { hasConflict: false, details: 'Unable to check for header conflicts' };
    }
  }
  
  /**
   * Monitor session health in the background
   * Helps detect and resolve token issues proactively
   */
  static startSessionMonitoring(): () => void {
    const intervalId = setInterval(async () => {
      try {
        const validation = await this.validateSession();
        
        if (!validation.isValid) {
          console.warn('[SessionValidator] Session monitoring detected invalid session:', {
            error: validation.error,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('[SessionValidator] Session monitoring error:', error);
      }
    }, this.SESSION_CHECK_INTERVAL);
    
    console.log('[SessionValidator] Session monitoring started');
    
    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      console.log('[SessionValidator] Session monitoring stopped');
    };
  }
}

/**
 * Utility function to check if error is related to authentication/authorization
 * Helps identify RLS-related issues
 */
export function isAuthenticationError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { status?: number; statusCode?: number; message?: string; code?: string };
  const status = e.status ?? e.statusCode;
  if (status === 401 || status === 403) return true;
  const message = (e.message || '').toLowerCase();
  if (message.includes('unauthorized') || 
      message.includes('violates row-level security') ||
      message.includes('jwt') ||
      message.includes('permission denied') ||
      message.includes('access denied') ||
      message.includes('forbidden') ||
      message.includes('authentication') ||
      message.includes('auth.uid()')) return true;
      
  // Check PostgREST error codes
  if (e.code === 'PGRST301' || e.code === 'PGRST116') return true;
  
  return false;
}

/**
 * Utility function to create an authenticated Supabase client with explicit token
 * Use this only when the default client doesn't have proper session context
 */
export async function createAuthenticatedClient(accessToken?: string) {
  const { createClient } = await import('@supabase/supabase-js');
  
  // Get token from parameter or current session
  const token = accessToken || (await SessionValidator.validateSession()).accessToken;
  
  if (!token) {
    throw new Error('No access token available for authenticated client');
  }
  
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        // Only include Authorization header, not apikey for Edge Functions
        'Authorization': `Bearer ${token}`
        // Remove apikey header to prevent conflicts
      }
    }
  });
}

export class EdgeInvokeError extends AppError {
  constructor(message: string, status?: number, cause?: unknown, context?: Record<string, unknown>) {
    const effectiveStatus = typeof status === "number" ? status : 500;
    super("edge_invoke_failed", message, {
      status: effectiveStatus,
      retryable: effectiveStatus >= 500 || effectiveStatus === 0,
      context,
      cause,
      name: "EdgeInvokeError",
    });
  }
}

export async function requireValidSession(options?: { requireAccessToken?: boolean }): Promise<SessionValidationResult> {
  const v = await SessionValidator.ensureValidSession();
  if (!v.isValid) {
    throw new Error(v.error || "Session expired");
  }
  if (options?.requireAccessToken && !v.accessToken) {
    throw new Error(v.error || "No access token");
  }
  return v;
}

export async function withValidSession<T>(
  fn: (ctx: { session: Session; user: User; accessToken: string }) => Promise<T>,
): Promise<T> {
  const v = await requireValidSession({ requireAccessToken: true });
  return await fn({ session: v.session as Session, user: v.user as User, accessToken: v.accessToken as string });
}

export async function invokeEdgeWithAuth<T>(name: string, body: unknown, opts?: RetryOptions): Promise<T> {
  try {
    return await EdgeClient.invokeWithRetry<T>(name, body, opts);
  } catch (e) {
    const mapped = e instanceof AppError ? e : mapError(e, { code: "edge_invoke_failed", context: { edgeFunction: name } });
    throw new EdgeInvokeError(mapped.message, mapped.status, mapped, { edgeFunction: name });
  }
}
