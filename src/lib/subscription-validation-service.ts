import { supabase } from '@/integrations/supabase/client';
import { RequestDeduplicatorFactory } from './request-deduplicator';
// Dev-only logging toggle and transient abort detector
const __DEV__ = import.meta.env?.DEV ?? false;
function isTransientAbortError(err: unknown): boolean {
  const name = (err as any)?.name as string | undefined;
  const message = (err as any)?.message as string | undefined;
  return (
    name === 'AbortError' ||
    (message?.includes('AbortError') ?? false) ||
    (message?.includes('The user aborted a request') ?? false) ||
    (message?.includes('net::ERR_ABORTED') ?? false) ||
    // Some browsers surface aborted fetches as generic TypeError
    (message?.includes('Failed to fetch') ?? false)
  );
}

/**
 * Service for validating and managing user subscription status
 * Automatically deactivates expired subscriptions based on end_date
 */
export class SubscriptionValidationService {
  // Simple in-memory cache for subscription validation per user
  private static cache: Map<string, {
    timestamp: number;
    result: {
      hasValidSubscription: boolean;
      subscription: any | null;
      isDemo: boolean;
    };
  }> = new Map();
  private static readonly CACHE_MAX_SIZE = 200;

  private static deduplicator = RequestDeduplicatorFactory.create<{
    hasValidSubscription: boolean;
    subscription: any | null;
    isDemo: boolean;
  }>("subscription-validation-service", {
    ttl: 15_000,
    maxSize: 200,
    enableMetrics: true,
    errorStrategy: "remove",
  });

  // Cache TTL (ms) for subscription status
  private static readonly TTL_MS = 15000;

  private static cacheGet(userId: string) {
    const v = this.cache.get(userId);
    if (!v) return null;
    this.cache.delete(userId);
    this.cache.set(userId, v);
    return v;
  }

  private static cacheSet(userId: string, value: { timestamp: number; result: { hasValidSubscription: boolean; subscription: any | null; isDemo: boolean } }) {
    this.cache.delete(userId);
    this.cache.set(userId, value);
    while (this.cache.size > this.CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Check if a subscription is expired based on end_date
   */
  private static isExpired(endDate: string | null): boolean {
    if (!endDate) {
      if (__DEV__) console.log('[Subscription] Lifetime subscription (no end_date)');
      return false; // Lifetime subscriptions have no end_date
    }
    const endMs = new Date(endDate).getTime();
    const nowMs = Date.now();
    const expired = endMs < nowMs;
    if (__DEV__) {
      console.log('[Subscription] Check expiration:', {
        endDate,
        endMs,
        nowMs,
        currentDate: new Date().toISOString(),
        expired
      });
    }
    return expired;
  }

  /**
   * Validate and update user's active subscription
   * Deactivates subscription if end_date has passed
   * Returns true if subscription is active and valid, false otherwise
   */
  static async validateUserSubscription(userId: string): Promise<{
    isValid: boolean;
    subscription: any | null;
    wasDeactivated: boolean;
  }> {
    try {
      // Get current active subscription
      const { data: activeSubscription, error } = await (supabase as any)
        .from('user_subscriptions')
        .select('*, tariffs(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        if (isTransientAbortError(error)) {
          if (__DEV__) console.debug('[Subscription] Fetch aborted while loading active subscription');
          return {
            isValid: false,
            subscription: null,
            wasDeactivated: false
          };
        }
        if (__DEV__) console.error('Error fetching active subscription:', error);
        throw error;
      }

      // No active subscription found
      if (!activeSubscription) {
        return {
          isValid: false,
          subscription: null,
          wasDeactivated: false
        };
      }

      // Check if subscription is expired
      const expired = this.isExpired(activeSubscription.end_date);

      if (expired) {
        // Deactivate expired subscription
        const { error: updateError } = await (supabase as any)
          .from('user_subscriptions')
          .update({ is_active: false })
          .eq('id', activeSubscription.id);

        if (updateError) {
          if (isTransientAbortError(updateError)) {
            if (__DEV__) console.debug('[Subscription] Fetch aborted while deactivating expired subscription');
            return {
              isValid: false,
              subscription: activeSubscription,
              wasDeactivated: false
            };
          }
          if (__DEV__) console.error('Error deactivating expired subscription:', updateError);
          throw updateError;
        }
        if (__DEV__) console.log('Subscription deactivated due to expiration:', activeSubscription.id);

        return {
          isValid: false,
          subscription: activeSubscription,
          wasDeactivated: true
        };
      }

      // Subscription is active and valid
      return {
        isValid: true,
        subscription: activeSubscription,
        wasDeactivated: false
      };

    } catch (error) {
      if (isTransientAbortError(error)) {
        if (__DEV__) console.debug('[Subscription] Validation aborted due to navigation/reload');
        return {
          isValid: false,
          subscription: null,
          wasDeactivated: false
        };
      }
      if (__DEV__) console.error('Error in validateUserSubscription:', error);
      throw error;
    }
  }

  /**
   * Validate subscription without auto-creating new ones
   * This should be called on every page load/navigation
   */
  static async ensureValidSubscription(userId: string, options?: { forceRefresh?: boolean }): Promise<{
    hasValidSubscription: boolean;
    subscription: any | null;
    isDemo: boolean;
  }> {
    try {
      const forceRefresh = options?.forceRefresh === true;

      // Serve from cache if fresh and no force refresh requested
      const cached = this.cacheGet(userId);
      const now = Date.now();
      if (!forceRefresh && cached && (now - cached.timestamp) < this.TTL_MS) {
        return cached.result;
      }
      const run = async () => {
        // Validate existing subscription and deactivate if expired
        const validation = await this.validateUserSubscription(userId);

        // If valid subscription exists, return it
        if (validation.isValid && validation.subscription) {
          const result = {
            hasValidSubscription: true,
            subscription: validation.subscription,
            isDemo: (validation.subscription.tariffs?.is_free === true) && 
                    (validation.subscription.tariffs?.visible === false)
          };
          // Cache successful result
          this.cacheSet(userId, { timestamp: Date.now(), result });
          return result;
        }

        // No valid subscription - do NOT auto-create, just return false
        if (__DEV__) console.log('[Subscription] No valid subscription found for user:', userId);
        const result = {
          hasValidSubscription: false,
          subscription: null,
          isDemo: false
        };
        this.cacheSet(userId, { timestamp: Date.now(), result });
        return result;

      };

      if (forceRefresh) {
        return await run();
      }

      return await this.deduplicator.dedupe(userId, run);

    } catch (error) {
      if (isTransientAbortError(error)) {
        if (__DEV__) console.debug('[Subscription] ensureValidSubscription aborted due to navigation/reload');
        return {
          hasValidSubscription: false,
          subscription: null,
          isDemo: false
        };
      }
      if (__DEV__) console.error('Error in ensureValidSubscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription info with validation
   * Returns subscription details or null if expired/invalid
   */
  static async getValidSubscription(userId: string, options?: { forceRefresh?: boolean }): Promise<any | null> {
    const result = await this.ensureValidSubscription(userId, options);
    return result.hasValidSubscription ? result.subscription : null;
  }
}
