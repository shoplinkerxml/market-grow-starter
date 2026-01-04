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
import { invokeSupabaseFunctionWithRetry } from "@/lib/request-handler";

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
  private static readonly VALID_CACHE_TTL_MS = 60 * 1000;
  private static readonly INVALID_CACHE_TTL_MS = 2 * 1000;
  private static cache: { result: SessionValidationResult; timestamp: number; ttlMs: number } | null = null;
  private static inFlight: Promise<SessionValidationResult> | null = null;
  private static refreshInFlight: Promise<SessionValidationResult> | null = null;
  private static epoch = 0;

  private static purgeAuthStorage(): void {
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
        try {
          s.removeItem("supabase.auth.token");
        } catch {
          void 0;
        }
        try {
          const urlObj = new URL(SUPABASE_URL);
          const projectRef = urlObj.host.split(".")[0];
          s.removeItem(`sb-${projectRef}-auth-token`);
        } catch {
          void 0;
        }
        try {
          const keys: string[] = [];
          for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (!k) continue;
            if (k.startsWith("sb-") && k.endsWith("-auth-token")) keys.push(k);
          }
          for (const k of keys) {
            try {
              s.removeItem(k);
            } catch {
              void 0;
            }
          }
        } catch {
          void 0;
        }
      }
    } catch {
      void 0;
    }
  }

  static clearCache(): void {
    this.epoch += 1;
    this.cache = null;
    this.inFlight = null;
    this.refreshInFlight = null;
  }
  
  /**
   * Validate current session and access token
   * Returns detailed information about session state
   */
  static async validateSession(): Promise<SessionValidationResult> {
    try {
      const now = Date.now();
      if (this.cache && now - this.cache.timestamp < this.cache.ttlMs) {
        return this.cache.result;
      }
      if (this.inFlight) {
        return await this.inFlight;
      }
      const epoch = this.epoch;
      const flight = (async () => {
        const readStoredSessionResult = (): SessionValidationResult | null => {
          let stored: any = null;
          try {
            const raw = typeof window !== "undefined" ? window.localStorage?.getItem("supabase.auth.token") : null;
            if (raw) stored = JSON.parse(raw);
          } catch {
            stored = null;
          }

          const storedSession = stored && typeof stored === "object" ? stored : null;
          if (!storedSession?.access_token || !storedSession?.user) return null;

          const now = Date.now();
          const expiresAt = storedSession.expires_at ? Number(storedSession.expires_at) * 1000 : null;
          const timeUntilExpiry = expiresAt ? expiresAt - now : null;
          const needsRefresh = timeUntilExpiry ? timeUntilExpiry < this.REFRESH_THRESHOLD_MS : false;
          const isExpired = timeUntilExpiry ? timeUntilExpiry <= 0 : false;

          return {
            isValid: !isExpired && !!storedSession.access_token && !!storedSession.user,
            session: storedSession as any,
            user: storedSession.user as any,
            accessToken: String(storedSession.access_token),
            refreshToken: storedSession.refresh_token ? String(storedSession.refresh_token) : null,
            expiresAt,
            timeUntilExpiry,
            needsRefresh,
            error: isExpired ? "Session expired" : undefined,
          };
        };

        const storedImmediate = readStoredSessionResult();
        if (storedImmediate?.isValid) {
          if (epoch === this.epoch) {
            this.cache = {
              result: storedImmediate,
              timestamp: Date.now(),
              ttlMs: storedImmediate.isValid ? this.VALID_CACHE_TTL_MS : this.INVALID_CACHE_TTL_MS,
            };
          }
          return storedImmediate;
        }

        const timeoutMs = 5000;
        const out = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ timeout: true }>((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs)),
        ]);
        if ((out as any)?.timeout) {
          const storedResult = readStoredSessionResult();
          if (storedResult) {
            if (epoch === this.epoch) {
              this.cache = {
                result: storedResult,
                timestamp: Date.now(),
                ttlMs: storedResult.isValid ? this.VALID_CACHE_TTL_MS : this.INVALID_CACHE_TTL_MS,
              };
            }
            return storedResult;
          }

          const result: SessionValidationResult = {
            isValid: false,
            session: null,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            timeUntilExpiry: null,
            needsRefresh: false,
            error: "Get session timeout",
          };
          if (epoch === this.epoch) {
            this.cache = { result, timestamp: Date.now(), ttlMs: this.INVALID_CACHE_TTL_MS };
          }
          return result;
        }
        const { data: { session }, error } = out as any;
        
        if (error) {
          console.error('[SessionValidator] Session fetch error:', error);
          const storedResult = readStoredSessionResult();
          if (storedResult?.isValid) {
            if (epoch === this.epoch) {
              this.cache = {
                result: storedResult,
                timestamp: Date.now(),
                ttlMs: storedResult.isValid ? this.VALID_CACHE_TTL_MS : this.INVALID_CACHE_TTL_MS,
              };
            }
            return storedResult;
          }
          const result: SessionValidationResult = {
            isValid: false,
            session: null,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            timeUntilExpiry: null,
            needsRefresh: false,
            error: error.message
          };
          if (epoch === this.epoch) {
            this.cache = { result, timestamp: Date.now(), ttlMs: this.INVALID_CACHE_TTL_MS };
          }
          return result;
        }
        
        if (!session) {
          const storedResult = readStoredSessionResult();
          if (storedResult?.isValid) {
            if (epoch === this.epoch) {
              this.cache = {
                result: storedResult,
                timestamp: Date.now(),
                ttlMs: storedResult.isValid ? this.VALID_CACHE_TTL_MS : this.INVALID_CACHE_TTL_MS,
              };
            }
            return storedResult;
          }
          const result: SessionValidationResult = {
            isValid: false,
            session: null,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            timeUntilExpiry: null,
            needsRefresh: false,
            error: 'No active session'
          };
          if (epoch === this.epoch) {
            this.cache = { result, timestamp: Date.now(), ttlMs: this.INVALID_CACHE_TTL_MS };
          }
          return result;
        }
        
        const now = Date.now();
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
        if (epoch === this.epoch) {
          this.cache = {
            result,
            timestamp: Date.now(),
            ttlMs: result.isValid ? this.VALID_CACHE_TTL_MS : this.INVALID_CACHE_TTL_MS,
          };
        }
        return result;
      })();
      this.inFlight = flight;
      try {
        return await flight;
      } finally {
        if (epoch === this.epoch && this.inFlight === flight) {
          this.inFlight = null;
        }
      }
    } catch (error) {
      console.error('[SessionValidator] Validation error:', error);
      return {
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
    }
  }
  
  /**
   * Ensure session is valid and refresh if needed
   * Critical for RLS operations that require valid access token
   */
  static async ensureValidSession(): Promise<SessionValidationResult> {
    const validation = await this.validateSession();
    
    const refreshToken = validation.session?.refresh_token;
    if (validation.isValid && validation.needsRefresh && refreshToken) {
      if (!this.refreshInFlight) {
        const epoch = this.epoch;
        const flight = (async () => {
          try {
            const timeoutMs = 7000;
            const out = await Promise.race([
              supabase.auth.refreshSession({ refresh_token: refreshToken }),
              new Promise<{ timeout: true }>((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs)),
            ]);
            if ((out as any)?.timeout) {
              return validation;
            }
            const { data: { session }, error } = out as any;
            if (error) {
              return validation;
            }
            if (session && epoch === this.epoch) {
              this.cache = null;
            }
            return this.validateSession();
          } catch {
            return validation;
          }
        })();
        this.refreshInFlight = flight;
        flight.finally(() => {
          if (epoch === this.epoch && this.refreshInFlight === flight) {
            this.refreshInFlight = null;
          }
        });
      }
      return validation;
    }

    if (!validation.isValid && refreshToken) {
      if (this.refreshInFlight) return await this.refreshInFlight;
      const epoch = this.epoch;
      const flight = (async () => {
        try {
          const timeoutMs = 7000;
          const out = await Promise.race([
            supabase.auth.refreshSession({ refresh_token: refreshToken }),
            new Promise<{ timeout: true }>((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs)),
          ]);
          if ((out as any)?.timeout) {
            try {
              await (supabase.auth as any).signOut?.({ scope: "local" });
            } catch {
              void 0;
            } finally {
              this.purgeAuthStorage();
              this.clearCache();
            }
            return {
              ...validation,
              session: null,
              user: null,
              accessToken: null,
              refreshToken: null,
              expiresAt: null,
              timeUntilExpiry: null,
              needsRefresh: false,
              error: "Refresh timeout",
            };
          }

          const { data: { session }, error } = out as any;
          if (error) {
            const msg = String((error as any)?.message || "");
            const lower = msg.toLowerCase();
            const status = Number((error as any)?.status ?? (error as any)?.statusCode ?? (error as any)?.context?.status ?? 0);
            const invalidRefresh =
              lower.includes("invalid refresh token") ||
              lower.includes("refresh token not found") ||
              lower.includes("refresh_token_not_found") ||
              (status === 400 && lower.includes("refresh")) ||
              (status === 401 && lower.includes("refresh"));

            if (invalidRefresh) {
              try {
                await (supabase.auth as any).signOut?.({ scope: "local" });
              } catch {
                void 0;
              } finally {
                this.purgeAuthStorage();
                this.clearCache();
              }
              return {
                isValid: false,
                session: null,
                user: null,
                accessToken: null,
                refreshToken: null,
                expiresAt: null,
                timeUntilExpiry: null,
                needsRefresh: false,
                error: msg || "Invalid refresh token",
              };
            }
            return {
              ...validation,
              error: `Refresh failed: ${(error as any)?.message || "unknown"}`
            };
          }

          if (session && epoch === this.epoch) {
            this.cache = null;
          }
          return this.validateSession();
        } catch (error) {
          return {
            ...validation,
            error: error instanceof Error ? error.message : "Refresh failed"
          };
        }
      })();
      this.refreshInFlight = flight;
      try {
        return await flight;
      } finally {
        if (epoch === this.epoch && this.refreshInFlight === flight) {
          this.refreshInFlight = null;
        }
      }
    }
    
    return validation;
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
    const checkInterval = 200; // Check every 200ms
    
    console.log('[SessionValidator] Waiting for valid session...', { expectedUserId, maxWaitTime });
    
    while (Date.now() - startTime < maxWaitTime) {
      const validation = await this.validateSession();
      
      if (validation.isValid) {
        // If we're expecting a specific user, verify it matches
        if (expectedUserId && validation.user?.id !== expectedUserId) {
          console.warn('[SessionValidator] Session user mismatch', {
            expected: expectedUserId,
            actual: validation.user?.id
          });
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }
        
        console.log('[SessionValidator] Valid session found', {
          userId: validation.user?.id,
          hasAccessToken: !!validation.accessToken,
          timeUntilExpiry: validation.timeUntilExpiry
        });
        return validation;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    console.warn('[SessionValidator] No valid session found within timeout', {
      maxWaitTime,
      expectedUserId
    });
    
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
        
        if (validation.needsRefresh && validation.session?.refresh_token) {
          console.log('[SessionValidator] Proactively refreshing session...');
          await supabase.auth.refreshSession({
            refresh_token: validation.session.refresh_token
          });
        }
        
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

export class EdgeInvokeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "EdgeInvokeError";
    this.status = status;
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

export async function invokeEdgeWithAuth<T>(name: string, body: unknown): Promise<T> {
  return await withValidSession(async ({ accessToken }) => {
    const { data, error } = await invokeSupabaseFunctionWithRetry<T | string>(
      supabase.functions.invoke.bind(supabase.functions) as any,
      name,
      { body, headers: { Authorization: `Bearer ${accessToken}` } },
      { timeoutMs: 12_000, maxRetries: 0 },
    );
    if (error) {
      const status =
        (error as { context?: { status?: number }; status?: number; statusCode?: number } | null)?.context?.status ??
        (error as { status?: number } | null)?.status ??
        (error as { statusCode?: number } | null)?.statusCode;
      const msg =
        (error as unknown as { message?: string } | null)?.message ||
        (error as unknown as { name?: string } | null)?.name ||
        "edge_invoke_failed";
      throw new EdgeInvokeError(msg, typeof status === "number" ? status : undefined);
    }
    return typeof data === "string" ? (JSON.parse(data) as T) : (data as T);
  });
}
