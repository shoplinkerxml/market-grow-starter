/**
 * RLS and Token Monitoring Utilities
 * 
 * This module provides comprehensive monitoring and debugging utilities
 * for Row Level Security (RLS) and token-related issues in Supabase.
 * 
 * Key Features:
 * - Real-time RLS policy validation
 * - Token health monitoring
 * - Database operation success/failure tracking
 * - Comprehensive debugging information
 * - Performance metrics for auth operations
 */

import { supabase } from "@/integrations/supabase/client";
import { SessionValidator, type SessionValidationResult } from "./session-validation";

export interface RLSTestResult {
  testName: string;
  success: boolean;
  error?: string;
  executionTime: number;
  rlsContext: {
    hasValidToken: boolean;
    authUid: string | null;
    tokenType: 'access_token' | 'anon_key' | 'none';
  };
}

export interface TokenHealthMetrics {
  timestamp: string;
  sessionValid: boolean;
  tokenPresent: boolean;
  tokenExpiry: number | null;
  timeUntilExpiry: number | null;
  autoRefreshEnabled: boolean;
  rlsContextWorking: boolean;
  lastRefreshTime?: string;
  consecutiveFailures: number;
}

export interface RLSMonitoringReport {
  timestamp: string;
  overall: {
    healthy: boolean;
    score: number; // 0-100
    issues: string[];
  };
  session: SessionValidationResult;
  tokenHealth: TokenHealthMetrics;
  rlsTests: RLSTestResult[];
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    failedQueries: number;
  };
}

/**
 * Comprehensive RLS and Token Monitoring Service
 */
export class RLSMonitor {
  private static performanceMetrics = {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    minMs: 0,
    slowCount: 0,
    failedQueries: 0,
    ewmaMs: 0,
    lastResetTime: Date.now()
  };
  
  private static consecutiveFailures = 0;
  private static lastHealthCheck: RLSMonitoringReport | null = null;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static lastRunAt: number | null = null;
  private static inFlight: Promise<RLSMonitoringReport> | null = null;
  private static cacheTtlMs = 60000;
  private static minCheckIntervalMs = 30000;
  
  /**
   * Perform comprehensive RLS health check
   */
  static async performHealthCheck(): Promise<RLSMonitoringReport> {
    const now = Date.now();
    if (this.lastHealthCheck && this.lastRunAt && (now - this.lastRunAt) < this.cacheTtlMs) {
      return this.lastHealthCheck;
    }
    if (this.inFlight) {
      return await this.inFlight;
    }
    if (this.lastRunAt && (now - this.lastRunAt) < this.minCheckIntervalMs && this.lastHealthCheck) {
      return this.lastHealthCheck;
    }
    const startTime = now;
    if (import.meta.env?.DEV) {
      console.debug('[RLSMonitor] Starting comprehensive health check...');
    }
    this.inFlight = (async () => {

    try {
      // 1. Session validation
      const sessionValidation = await SessionValidator.ensureValidSession();
      
      // 2. Token health metrics
      const tokenHealth = await this.getTokenHealthMetrics();
      
      // 3. RLS policy tests
      const rlsTests = await this.runRLSTests();
      
      // 4. Performance metrics
      const performance = this.getPerformanceMetrics();
      
      // 5. Overall health assessment
      const overall = this.assessOverallHealth(sessionValidation, tokenHealth, rlsTests);
      
      const report: RLSMonitoringReport = {
        timestamp: new Date().toISOString(),
        overall,
        session: sessionValidation,
        tokenHealth,
        rlsTests,
        performance
      };
      
      this.lastHealthCheck = report;
      this.lastRunAt = Date.now();
      
      const executionTime = Date.now() - startTime;
      if (import.meta.env?.DEV) {
        console.debug(`[RLSMonitor] Health check completed in ${executionTime}ms`, {
          healthy: overall.healthy,
          score: overall.score,
          issues: overall.issues.length
        });
      }
      
      return report;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.error('[RLSMonitor] Health check failed:', error);
      }
      
      // Return minimal error report
      const failed = {
        timestamp: new Date().toISOString(),
        overall: {
          healthy: false,
          score: 0,
          issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        },
        session: {
          isValid: false,
          session: null,
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          timeUntilExpiry: null,
          needsRefresh: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        tokenHealth: await this.getTokenHealthMetrics().catch(() => ({
          timestamp: new Date().toISOString(),
          sessionValid: false,
          tokenPresent: false,
          tokenExpiry: null,
          timeUntilExpiry: null,
          autoRefreshEnabled: false,
          rlsContextWorking: false,
          consecutiveFailures: ++this.consecutiveFailures
        })),
        rlsTests: [],
        performance: this.getPerformanceMetrics()
      };
      this.lastHealthCheck = failed;
      this.lastRunAt = Date.now();
      return failed;
    }
    })();
    try {
      const res = await this.inFlight;
      return res;
    } finally {
      this.inFlight = null;
    }
  }
  
  /**
   * Get detailed token health metrics
   */
  static async getTokenHealthMetrics(): Promise<TokenHealthMetrics> {
    try {
      const validation = await SessionValidator.validateSession();
      const debugInfo = await SessionValidator.getTokenDebugInfo();
      const rlsContext = await SessionValidator.validateRLSContext();
      
      // Reset consecutive failures on success
      if (validation.isValid) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
      }
      
      return {
        timestamp: new Date().toISOString(),
        sessionValid: validation.isValid,
        tokenPresent: debugInfo.hasAccessToken,
        tokenExpiry: validation.expiresAt,
        timeUntilExpiry: validation.timeUntilExpiry,
        autoRefreshEnabled: true, // Configured in client
        rlsContextWorking: rlsContext.isValid,
        consecutiveFailures: this.consecutiveFailures
      };
    } catch (error) {
      console.error('[RLSMonitor] Token health check failed:', error);
      this.consecutiveFailures++;
      
      return {
        timestamp: new Date().toISOString(),
        sessionValid: false,
        tokenPresent: false,
        tokenExpiry: null,
        timeUntilExpiry: null,
        autoRefreshEnabled: false,
        rlsContextWorking: false,
        consecutiveFailures: this.consecutiveFailures
      };
    }
  }
  
  /**
   * Run comprehensive RLS policy tests
   */
  static async runRLSTests(): Promise<RLSTestResult[]> {
    const tests: RLSTestResult[] = [];
    
    // Test 1: Profile access (should work with valid token)
    tests.push(await this.testRLSOperation(
      'profile-access',
      async () => {
        const validation = await SessionValidator.validateSession();
        if (!validation.isValid || !validation.user) {
          throw new Error('No valid session for test');
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', validation.user.id)
          .single();
          
        if (error) throw error;
        if (!data) throw new Error('Profile not found - RLS may be blocking access');
        
        return data;
      }
    ));
    
    // Test 2: Menu items access (role-based)
    tests.push(await this.testRLSOperation(
      'menu-items-access',
      async () => {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, title, path')
          .limit(1);
          
        if (error) throw error;
        return data;
      }
    ));
    
    tests.push(await this.testRLSOperation(
      'user-subscriptions-access',
      async () => {
        const validation = await SessionValidator.validateSession();
        if (!validation.isValid || !validation.user) {
          throw new Error('No valid session for test');
        }
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('id,is_active')
          .eq('user_id', validation.user.id)
          .limit(5);
        if (error) throw error;
        return data;
      }
    ));
    
    return tests;
  }
  
  /**
   * Test a specific RLS operation with timing and context
   */
  private static async testRLSOperation(
    testName: string,
    operation: () => Promise<unknown>
  ): Promise<RLSTestResult> {
    const startTime = Date.now();
    
    try {
      // Get current RLS context
      const validation = await SessionValidator.validateSession();
      const debugInfo = await SessionValidator.getTokenDebugInfo();
      
      // Execute the operation
      await operation();
      
      const executionTime = Date.now() - startTime;
      this.recordQueryTime(executionTime);
      
      return {
        testName,
        success: true,
        executionTime,
        rlsContext: {
          hasValidToken: !!validation.accessToken,
          authUid: validation.user?.id || null,
          tokenType: validation.accessToken ? 'access_token' : 'none'
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMetrics.failedQueries++;
      
      if (import.meta.env?.DEV) {
        console.error(`[RLSMonitor] RLS test '${testName}' failed:`, error);
      }
      
      const validation = await SessionValidator.validateSession().catch(() => null);
      
      return {
        testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        rlsContext: {
          hasValidToken: !!validation?.accessToken,
          authUid: validation?.user?.id || null,
          tokenType: validation?.accessToken ? 'access_token' : 
                    validation?.session ? 'anon_key' : 'none'
        }
      };
    }
  }
  
  /**
   * Assess overall system health
   */
  private static assessOverallHealth(
    session: SessionValidationResult,
    tokenHealth: TokenHealthMetrics,
    rlsTests: RLSTestResult[]
  ): { healthy: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;
    
    // Session health (40 points)
    if (!session.isValid) {
      issues.push(`Invalid session: ${session.error}`);
      score -= 40;
    } else if (session.needsRefresh) {
      issues.push('Session needs refresh');
      score -= 10;
    }
    
    // Token health (30 points)
    if (!tokenHealth.tokenPresent) {
      issues.push('No access token present');
      score -= 30;
    } else if (!tokenHealth.rlsContextWorking) {
      issues.push('RLS context not working - auth.uid() may be null');
      score -= 25;
    }
    
    if (tokenHealth.consecutiveFailures > 3) {
      issues.push(`High failure rate: ${tokenHealth.consecutiveFailures} consecutive failures`);
      score -= 15;
    }
    
    // RLS tests (30 points)
    const failedTests = rlsTests.filter(test => !test.success);
    if (failedTests.length > 0) {
      issues.push(`${failedTests.length} RLS tests failed: ${failedTests.map(t => t.testName).join(', ')}`);
      score -= (failedTests.length / rlsTests.length) * 30;
    }
    
    // Performance penalty
    const performance = this.getPerformanceMetrics();
    if (performance.failedQueries > 5) {
      issues.push(`High query failure rate: ${performance.failedQueries} failures`);
      score -= 10;
    }
    
    return {
      healthy: score >= 80 && issues.length === 0,
      score: Math.max(0, Math.round(score)),
      issues
    };
  }
  
  /**
   * Record query execution time for performance metrics
   */
  private static recordQueryTime(time: number): void {
    const alpha = 0.2;
    this.performanceMetrics.count += 1;
    this.performanceMetrics.totalMs += time;
    this.performanceMetrics.maxMs = Math.max(this.performanceMetrics.maxMs, time);
    this.performanceMetrics.minMs = this.performanceMetrics.minMs === 0 ? time : Math.min(this.performanceMetrics.minMs, time);
    this.performanceMetrics.ewmaMs = this.performanceMetrics.ewmaMs === 0 ? time : (alpha * time + (1 - alpha) * this.performanceMetrics.ewmaMs);
    if (time > 1000) this.performanceMetrics.slowCount += 1;
  }
  
  /**
   * Get current performance metrics
   */
  private static getPerformanceMetrics() {
    const average = this.performanceMetrics.count > 0 ? (this.performanceMetrics.totalMs / this.performanceMetrics.count) : 0;
    return {
      averageQueryTime: Math.round(this.performanceMetrics.ewmaMs || average),
      slowQueries: this.performanceMetrics.slowCount,
      failedQueries: this.performanceMetrics.failedQueries
    };
  }
  
  /**
   * Start continuous monitoring
   */
  static startMonitoring(intervalMs: number = 60000): () => void {
    if (this.monitoringInterval) {
      if (import.meta.env?.DEV) {
        console.warn('[RLSMonitor] Monitoring already started');
      }
      return () => this.stopMonitoring();
    }

    if (import.meta.env?.DEV) {
      console.debug(`[RLSMonitor] Starting continuous monitoring (interval: ${intervalMs}ms)`);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const report = await this.performHealthCheck();

        if (!report.overall.healthy) {
          if (import.meta.env?.DEV) {
            console.warn('[RLSMonitor] Health check detected issues:', {
              score: report.overall.score,
              issues: report.overall.issues
            });
          }

          this.handleHealthIssues(report);
        }
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.error('[RLSMonitor] Monitoring error:', error);
        }
      }
    }, intervalMs);

    return () => this.stopMonitoring();
  }
  
  /**
   * Stop continuous monitoring
   */
  static stopMonitoring(): void {
    if (!this.monitoringInterval) return;
    clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;
    if (import.meta.env?.DEV) {
      console.debug('[RLSMonitor] Monitoring stopped');
    }
  }
  
  /**
   * Handle detected health issues
   */
  private static async handleHealthIssues(report: RLSMonitoringReport): Promise<void> {
    if (!report.session.isValid && report.session.session?.refresh_token) {
      if (import.meta.env?.DEV) {
        console.debug('[RLSMonitor] Attempting automatic session refresh...');
      }
      try {
        await supabase.auth.refreshSession({
          refresh_token: report.session.session.refresh_token
        });
        if (import.meta.env?.DEV) {
          console.debug('[RLSMonitor] Session refresh successful');
        }
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.error('[RLSMonitor] Session refresh failed:', error);
        }
      }
    }

    if (report.overall.score < 50) {
      if (import.meta.env?.DEV) {
        console.error('[RLSMonitor] Severe health issues detected:', {
          report,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Get the last health check report
   */
  static getLastHealthReport(): RLSMonitoringReport | null {
    return this.lastHealthCheck;
  }
  
  /**
   * Reset performance metrics
   */
  static resetMetrics(): void {
    this.performanceMetrics = {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      minMs: 0,
      slowCount: 0,
      failedQueries: 0,
      ewmaMs: 0,
      lastResetTime: Date.now()
    };
    this.consecutiveFailures = 0;
    if (import.meta.env?.DEV) {
      console.debug('[RLSMonitor] Performance metrics reset');
    }
  }
  
  /**
   * Generate a detailed diagnostic report
   */
  static async generateDiagnosticReport(): Promise<string> {
    const report = await this.performHealthCheck();
    const tokenDebug = await SessionValidator.getTokenDebugInfo();
    
    return `
# RLS and Token Diagnostic Report
Generated: ${report.timestamp}

## Overall Health
- Status: ${report.overall.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}
- Score: ${report.overall.score}/100
- Issues: ${report.overall.issues.length}

${report.overall.issues.length > 0 ? '### Issues:\n' + report.overall.issues.map(issue => `- ${issue}`).join('\n') : ''}

## Session Status
- Valid: ${report.session.isValid ? '✅' : '❌'}
- User ID: ${report.session.user?.id || 'N/A'}
- Email: ${report.session.user?.email || 'N/A'}
- Token Present: ${report.session.accessToken ? '✅' : '❌'}
- Expires: ${report.session.expiresAt ? new Date(report.session.expiresAt).toISOString() : 'N/A'}
- Needs Refresh: ${report.session.needsRefresh ? '⚠️' : '✅'}

## Token Health
- Token Present: ${report.tokenHealth.tokenPresent ? '✅' : '❌'}
- RLS Context: ${report.tokenHealth.rlsContextWorking ? '✅' : '❌'}
- Consecutive Failures: ${report.tokenHealth.consecutiveFailures}
- Time Until Expiry: ${report.tokenHealth.timeUntilExpiry ? Math.round(report.tokenHealth.timeUntilExpiry / 1000) + 's' : 'N/A'}

## RLS Tests
${report.rlsTests.map(test => 
  `- ${test.testName}: ${test.success ? '✅' : '❌'} (${test.executionTime}ms)${test.error ? ' - ' + test.error : ''}`
).join('\n')}

## Performance
- Average Query Time: ${report.performance.averageQueryTime}ms
- Slow Queries: ${report.performance.slowQueries}
- Failed Queries: ${report.performance.failedQueries}

## Token Debug Info
- Has Access Token: ${tokenDebug.hasAccessToken ? '✅' : '❌'}
- Has Refresh Token: ${tokenDebug.hasRefreshToken ? '✅' : '❌'}
- Token Prefix: ${tokenDebug.tokenPrefix}
- User ID: ${tokenDebug.userId || 'N/A'}
- Is Expired: ${tokenDebug.isExpired ? '❌' : '✅'}
- Session Age: ${tokenDebug.sessionAge ? Math.round(tokenDebug.sessionAge / 1000) + 's' : 'N/A'}
    `.trim();
  }
}

/**
 * Quick utility function to run a health check and log results
 */
export async function quickHealthCheck(): Promise<void> {
  if (import.meta.env?.DEV) {
    console.debug('[RLSMonitor] Running quick health check...');
  }
  const report = await RLSMonitor.performHealthCheck();
  
  if (report.overall.healthy) {
    if (import.meta.env?.DEV) {
      console.debug('✅ System healthy - Score:', report.overall.score);
    }
  } else {
    if (import.meta.env?.DEV) {
      console.warn('❌ System issues detected - Score:', report.overall.score);
      console.warn('Issues:', report.overall.issues);
    }
  }
  
  return;
}

/**
 * Enhanced error logging that includes RLS context
 */
export async function logErrorWithRLSContext(
  operation: string, 
  error: unknown, 
  additionalContext?: unknown
): Promise<void> {
  try {
    const sessionValidation = await SessionValidator.validateSession();
    const tokenDebug = await SessionValidator.getTokenDebugInfo();
    const rlsContext = await SessionValidator.validateRLSContext();
    
    const err = error as { message?: string; code?: string | number; status?: number; statusCode?: number } | undefined;
    console.error(`[RLS Error] ${operation}:`, {
      error: {
        message: err?.message,
        code: err?.code,
        status: (err?.status ?? err?.statusCode)
      },
      session: {
        valid: sessionValidation.isValid,
        hasToken: !!sessionValidation.accessToken,
        userId: sessionValidation.user?.id,
        error: sessionValidation.error
      },
      token: tokenDebug,
      rls: rlsContext,
      additionalContext,
      timestamp: new Date().toISOString()
    });
  } catch (debugError) {
    console.error(`[RLS Error] ${operation} (debug failed):`, error, debugError);
  }
}
