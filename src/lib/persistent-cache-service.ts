import { UnifiedCacheManager } from "./cache-utils";
import { SessionValidator } from "./session-validation";

export class PersistentCacheService {
  private static readonly TTL = {
    AUTH_ME: 24 * 60 * 60 * 1000,
    SHOPS: 30 * 60 * 1000,
    TARIFFS: 60 * 60 * 1000,
    SUPPLIERS: 30 * 60 * 1000,
    CURRENCIES: 60 * 60 * 1000,
    MENU: 30 * 60 * 1000,
    CATEGORIES: 30 * 60 * 1000,
  } as const;

  private static readonly SOFT_REFRESH_THRESHOLD = 2 * 60 * 1000;

  private static authMeCache = UnifiedCacheManager.create("persistent:authMe", {
    mode: "local",
    defaultTtlMs: PersistentCacheService.TTL.AUTH_ME,
  });

  private static shopsCache = UnifiedCacheManager.create("persistent:shops", {
    mode: "memory",
    defaultTtlMs: PersistentCacheService.TTL.SHOPS,
  });

  private static tariffsCache = UnifiedCacheManager.create("persistent:tariffs", {
    mode: "local",
    defaultTtlMs: PersistentCacheService.TTL.TARIFFS,
  });

  private static suppliersCache = UnifiedCacheManager.create("persistent:suppliers", {
    mode: "local",
    defaultTtlMs: PersistentCacheService.TTL.SUPPLIERS,
  });

  private static currenciesCache = UnifiedCacheManager.create("persistent:currencies", {
    mode: "local",
    defaultTtlMs: PersistentCacheService.TTL.CURRENCIES,
  });

  private static menuCache = UnifiedCacheManager.create("persistent:menu", {
    mode: "local",
    defaultTtlMs: PersistentCacheService.TTL.MENU,
  });

  static async getCached<T>(
    cacheKey: string,
    cacheManager: ReturnType<typeof UnifiedCacheManager.create>,
    fetchFn: () => Promise<T>,
    ttl: number,
  ): Promise<T> {
    const envelope = cacheManager.getEnvelope<T>(cacheKey, false);
    if (envelope) {
      const timeLeft = envelope.expiresAt - Date.now();
      if (timeLeft > 0) {
        if (timeLeft < PersistentCacheService.SOFT_REFRESH_THRESHOLD) {
          void fetchFn()
            .then((data) => cacheManager.set(cacheKey, data, ttl))
            .catch((err) => {
              console.warn("Background refresh failed:", err);
            });
        }
        return envelope.data;
      }
    }
    const data = await fetchFn();
    cacheManager.set(cacheKey, data, ttl);
    return data;
  }

  static async getAuthMe<T>(fetchFn: () => Promise<T>): Promise<T> {
    const validation = await SessionValidator.validateSession();
    const userId = validation.user?.id ? String(validation.user.id) : "guest";
    const cacheKey = `user:${userId}`;
    return PersistentCacheService.getCached(cacheKey, PersistentCacheService.authMeCache, fetchFn, PersistentCacheService.TTL.AUTH_ME);
  }

  static async getShops<T>(fetchFn: () => Promise<T>): Promise<T> {
    const validation = await SessionValidator.validateSession();
    const userId = validation.user?.id ? String(validation.user.id) : "guest";
    const cacheKey = `user:${userId}`;
    return PersistentCacheService.getCached(cacheKey, PersistentCacheService.shopsCache, fetchFn, PersistentCacheService.TTL.SHOPS);
  }

  static async getTariffs<T>(fetchFn: () => Promise<T>, cacheKey: string = "all"): Promise<T> {
    return PersistentCacheService.getCached(cacheKey, PersistentCacheService.tariffsCache, fetchFn, PersistentCacheService.TTL.TARIFFS);
  }

  static async getSuppliers<T>(fetchFn: () => Promise<T>): Promise<T> {
    const validation = await SessionValidator.validateSession();
    const userId = validation.user?.id ? String(validation.user.id) : "guest";
    const cacheKey = `user:${userId}`;
    return PersistentCacheService.getCached(
      cacheKey,
      PersistentCacheService.suppliersCache,
      fetchFn,
      PersistentCacheService.TTL.SUPPLIERS,
    );
  }

  static async getCurrencies<T>(fetchFn: () => Promise<T>, cacheKey: string = "all"): Promise<T> {
    return PersistentCacheService.getCached(
      cacheKey,
      PersistentCacheService.currenciesCache,
      fetchFn,
      PersistentCacheService.TTL.CURRENCIES,
    );
  }

  static async getMenu<T>(fetchFn: () => Promise<T>): Promise<T> {
    const validation = await SessionValidator.validateSession();
    const userId = validation.user?.id ? String(validation.user.id) : "guest";
    const cacheKey = `user:${userId}`;
    return PersistentCacheService.getCached(cacheKey, PersistentCacheService.menuCache, fetchFn, PersistentCacheService.TTL.MENU);
  }

  static async bumpCachedShopsCounts(
    deltas: Record<string, number>,
    categoriesByStore?: Record<string, string[]>,
  ): Promise<void> {
    const validation = await SessionValidator.validateSession().catch(() => null);
    const userId = validation?.user?.id ? String(validation.user.id) : "guest";
    const cacheKey = `user:${userId}`;
    const envelope = PersistentCacheService.shopsCache.getEnvelope<any[]>(cacheKey, false);
    if (!envelope || !Array.isArray(envelope.data)) return;

    const cats = categoriesByStore || {};
    const next = envelope.data.map((s: any) => {
      const id = s?.id != null ? String(s.id) : "";
      if (!id) return s;

      const delta = Number(deltas?.[id] ?? 0) || 0;
      const hasCats = Object.prototype.hasOwnProperty.call(cats, id);
      if (!delta && !hasCats) return s;

      const prevProducts = Math.max(0, Number(s?.productsCount ?? 0) || 0);
      const nextProducts = Math.max(0, prevProducts + delta);
      const nextCategories = hasCats
        ? (Array.isArray(cats[id]) ? cats[id].length : 0)
        : nextProducts === 0
          ? 0
          : Math.max(0, Number(s?.categoriesCount ?? 0) || 0);

      return { ...s, productsCount: nextProducts, categoriesCount: nextCategories };
    });

    PersistentCacheService.shopsCache.set(cacheKey, next, PersistentCacheService.TTL.SHOPS);
  }

  static invalidateAuthMe(): void {
    PersistentCacheService.authMeCache.clearAll();
  }

  static invalidateShops(): void {
    PersistentCacheService.shopsCache.clearAll();
  }

  static invalidateTariffs(): void {
    PersistentCacheService.tariffsCache.clearAll();
  }

  static invalidateSuppliers(): void {
    PersistentCacheService.suppliersCache.clearAll();
  }

  static invalidateCurrencies(): void {
    PersistentCacheService.currenciesCache.clearAll();
  }

  static invalidateMenu(): void {
    PersistentCacheService.menuCache.clearAll();
  }

  static clearAll(): void {
    PersistentCacheService.authMeCache.clearAll();
    PersistentCacheService.shopsCache.clearAll();
    PersistentCacheService.tariffsCache.clearAll();
    PersistentCacheService.suppliersCache.clearAll();
    PersistentCacheService.currenciesCache.clearAll();
    PersistentCacheService.menuCache.clearAll();
  }
}
