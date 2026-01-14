import { GlobalRequestDeduplicator } from './request-deduplicator';
import { supabase } from "@/integrations/supabase/client";
import { UnifiedCacheManager } from "./cache-utils";
import { UserAuthService } from "./user-auth-service";
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
  private static readonly TTL_MS = 15_000;
  private static cache = UnifiedCacheManager.create("subscription-validation-service", {
    mode: "memory",
    defaultTtlMs: SubscriptionValidationService.TTL_MS,
    maxSize: 200,
  });

  private static cacheKey(userId: string): string {
    return `user:${String(userId || "").trim()}`;
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

  private static computeIsDemo(subscription: any | null): boolean {
    if (!subscription) return false;
    const tariffs = (subscription as any)?.tariffs ?? null;
    return tariffs?.is_free === true && tariffs?.visible === false;
  }

  private static async fetchActiveSubscription(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*, tariffs (*)")
      .eq("user_id", String(userId))
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as any) ?? null;
  }

  private static async deactivateSubscriptionAtomic(subscriptionId: string | number | null | undefined): Promise<boolean> {
    const id =
      typeof subscriptionId === "number"
        ? subscriptionId
        : subscriptionId != null
          ? Number(subscriptionId)
          : NaN;
    if (!Number.isFinite(id)) return false;

    const { data, error } = await supabase
      .from("user_subscriptions")
      .update({ is_active: false })
      .eq("id", id)
      .eq("is_active", true)
      .select("id");

    if (error) throw error;
    return Array.isArray(data) ? data.length > 0 : !!data;
  }

  private static async computeState(userId: string): Promise<{
    state: { hasValidSubscription: boolean; subscription: any | null; isDemo: boolean };
    wasDeactivated: boolean;
  }> {
    const active = await this.fetchActiveSubscription(userId);
    if (!active) {
      return {
        state: { hasValidSubscription: false, subscription: null, isDemo: false },
        wasDeactivated: false,
      };
    }

    const rawEndDate = (active as any)?.end_date ?? null;
    if (this.isExpired(typeof rawEndDate === "string" ? rawEndDate : null)) {
      const wasDeactivated = await this.deactivateSubscriptionAtomic((active as any)?.id);
      try {
        UserAuthService.clearAuthMeCache();
      } catch {
        void 0;
      }
      return {
        state: { hasValidSubscription: false, subscription: null, isDemo: false },
        wasDeactivated,
      };
    }

    const state = {
      hasValidSubscription: true,
      subscription: active,
      isDemo: this.computeIsDemo(active),
    };
    return { state, wasDeactivated: false };
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
      const uid = String(userId || "").trim();
      if (!uid) return { isValid: false, subscription: null, wasDeactivated: false };
      const computed = await this.computeState(uid);
      return {
        isValid: computed.state.hasValidSubscription,
        subscription: computed.state.hasValidSubscription ? computed.state.subscription : null,
        wasDeactivated: computed.wasDeactivated,
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
  static async getSubscriptionState(userId: string, options?: { forceRefresh?: boolean }): Promise<{
    hasValidSubscription: boolean;
    subscription: any | null;
    isDemo: boolean;
  }> {
    try {
      const forceRefresh = options?.forceRefresh === true;
      const uid = String(userId || "").trim();
      if (!uid) return { hasValidSubscription: false, subscription: null, isDemo: false };

      const key = this.cacheKey(uid);
      if (!forceRefresh) {
        const cached = this.cache.get<{ hasValidSubscription: boolean; subscription: any | null; isDemo: boolean }>(key);
        if (cached) return cached;
      }

      const run = async () => {
        const computed = await this.computeState(uid);
        this.cache.set(key, computed.state, this.TTL_MS);
        return computed.state;
      };

      if (forceRefresh) return await run();

      return await GlobalRequestDeduplicator.dedupeExpensive(
        { service: "SubscriptionValidationService", method: "getSubscriptionState", params: { userId: uid } },
        async (_ctx) => await run(),
      );

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
  static async getSubscription(userId: string, options?: { forceRefresh?: boolean }): Promise<any | null> {
    const result = await this.getSubscriptionState(userId, options);
    return result.hasValidSubscription ? result.subscription : null;
  }

  static async ensureValidSubscription(userId: string, options?: { forceRefresh?: boolean }): Promise<{
    hasValidSubscription: boolean;
    subscription: any | null;
    isDemo: boolean;
  }> {
    return await this.getSubscriptionState(userId, options);
  }

  static async getValidSubscription(userId: string, options?: { forceRefresh?: boolean }): Promise<any | null> {
    return await this.getSubscription(userId, options);
  }

  static clearAllCaches(): void {
    try {
      this.cache.clearAll();
    } catch {
      void 0;
    }
    try {
      GlobalRequestDeduplicator.cancelPrefix("SubscriptionValidationService:getSubscriptionState");
    } catch {
      void 0;
    }
    try {
      UserAuthService.clearAuthMeCache();
    } catch {
      void 0;
    }
  }

  static clearUserCache(userId: string): void {
    const uid = String(userId || "").trim();
    if (!uid) return;
    try {
      this.cache.remove(this.cacheKey(uid));
    } catch {
      void 0;
    }
  }
}
