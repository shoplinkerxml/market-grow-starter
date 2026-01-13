import { CACHE_TTL, UnifiedCacheManager } from './cache-utils';

const SOFT_REFRESH_THRESHOLD_MS = 120000;
const cache = UnifiedCacheManager.create('rq:tariffs', { defaultTtlMs: CACHE_TTL.tariffsList });

export async function getTariffsListCached<T>(key: string, fetch: () => Promise<T[]>): Promise<T[]> {
  const cacheKey = String(key || 'list');
  const cached = cache.getEnvelope<T[]>(cacheKey);
  if (cached) {
    const timeLeft = cached.expiresAt - Date.now();
    if (timeLeft > 0) {
      if (timeLeft < SOFT_REFRESH_THRESHOLD_MS) {
        void fetch().then(rows => cache.set(cacheKey, rows)).catch(() => void 0);
      }
      return cached.data;
    }
  }
  const rows = await fetch();
  cache.set(cacheKey, rows);
  return rows;
}

export function invalidateTariffsCache(key?: string): void {
  if (key) {
    cache.remove(String(key));
    return;
  }
  cache.clearAll();
}

const TariffCache = {
  getTariffsListCached,
  invalidateTariffsCache,
  get<T>(key: string = 'list'): T | null {
    return cache.get<T>(String(key));
  },
  set<T>(key: string, data: T): void {
    cache.set(String(key), data);
  },
  clear(): void {
    cache.clearAll();
  }
};

export default TariffCache;
