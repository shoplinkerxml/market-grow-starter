import { CACHE_TTL, UnifiedCacheManager } from './cache-utils';

const SOFT_REFRESH_THRESHOLD_MS = 120000;
const cache = UnifiedCacheManager.create('rq:tariffs', { defaultTtlMs: CACHE_TTL.tariffsList });

export async function getTariffsListCached<T>(fetch: () => Promise<T[]>): Promise<T[]> {
  const cached = cache.getEnvelope<T[]>('list');
  if (cached) {
    const timeLeft = cached.expiresAt - Date.now();
    if (timeLeft > 0) {
      if (timeLeft < SOFT_REFRESH_THRESHOLD_MS) {
        void fetch().then(rows => cache.set('list', rows)).catch(() => void 0);
      }
      return cached.data;
    }
  }
  const rows = await fetch();
  cache.set('list', rows);
  return rows;
}

export function invalidateTariffsCache(): void {
  cache.remove('list');
}

const TariffCache = {
  getTariffsListCached,
  invalidateTariffsCache,
  get<T>(): T | null {
    return cache.get<T>('list');
  },
  set<T>(data: T): void {
    cache.set('list', data);
  },
  clear(): void {
    cache.remove('list');
  }
};

export default TariffCache;
