// ============================================================================
// Constants & Configuration
// ============================================================================

export const CACHE_TTL = {
  productsPage: 900_000,
  shopsList: 1_800_000,
  categoryFilters: 300_000,
  productLinks: 120_000,
  marketplacesList: 900_000,
  uiPrefs: 2_592_000_000,
  tariffsList: 3_600_000,
  suppliersList: 1_800_000,
  limits: 900_000,
  supplierCategoriesMap: 600_000,
  authMe: 86_400_000,
  profilesDefault: 300_000,
  profilesExistence: 120_000,
  currencies: 3_600_000,
  menu: 1_800_000,
} as const;

const CACHE_VERSION_PREFIX = "v1:";
const MAX_GLOBAL_MEMORY_CACHE_SIZE = 1000;
const DEFAULT_PRUNE_THRESHOLD = 50;
const DEFAULT_MAX_BATCH_SIZE = 100;
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_KEYS_PER_CLEANUP = 100;
const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

// ============================================================================
// Types
// ============================================================================

export type CacheEnvelope<T> = { data: T; expiresAt: number };

export type CacheStorageMode = "auto" | "local" | "session" | "memory";

export type CacheInstanceStats = {
  reads: number;
  writes: number;
  removes: number;
  hits: number;
  misses: number;
  storageErrors: number;
  avgReadTimeMs: number;
  avgWriteTimeMs: number;
};

export type CacheManagerMetrics = {
  instances: Array<{
    namespace: string;
    mode: CacheStorageMode;
    size: number;
    stats: CacheInstanceStats;
  }>;
  memoryFallbackSize: number;
};

type CacheInstanceConfig = {
  mode?: CacheStorageMode;
  defaultTtlMs?: number;
  maxSize?: number;
  onError?: (error: Error, operation: string, key?: string) => void;
};

export type CacheGetOrFetchOptions = {
  bypassCache?: boolean;
  allowStale?: boolean;
  ttlMs?: number;
  softRefreshThresholdMs?: number;
};

export type InFlightTtlEntry<T> = { promise: Promise<T>; expiresAt: number };

export type UnifiedCacheInstance = {
  namespace: string;
  mode: CacheStorageMode;
  getEnvelope<T>(key: string, allowStale?: boolean): CacheEnvelope<T> | null;
  get<T>(key: string, allowStale?: boolean): T | null;
  getOrFetch<T>(key: string, fetchFn: () => Promise<T>, options?: CacheGetOrFetchOptions): Promise<T>;
  set<T>(key: string, data: T, ttlMs?: number): void;
  remove(key: string): void;
  clearAll(): void;
  clearWhere(predicate: (subKey: string) => boolean): void;
  updateWhere<T>(predicate: (subKey: string) => boolean, updater: (data: T) => T | null, ttlMs?: number): void;
};

// ============================================================================
// Global State
// ============================================================================

const memoryCache = new Map<string, string>();
let nextCleanupAt = 0;

// ============================================================================
// Storage Utilities
// ============================================================================

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGetStorages(): Storage[] {
  const out: Storage[] = [];
  const storage = getStorage();
  const session = getSessionStorage();
  if (storage) out.push(storage);
  if (session) out.push(session);
  return out;
}

function getPreferredStorages(mode: CacheStorageMode): {
  primary: Storage | null;
  secondary: Storage | null;
} {
  const local = getStorage();
  const session = getSessionStorage();
  if (mode === "session") return { primary: session, secondary: local };
  if (mode === "local") return { primary: local, secondary: session };
  return { primary: local, secondary: session };
}

function tryReadRawFromStorage(s: Storage | null, key: string): string | null {
  if (!s) return null;
  try {
    const versionedKey = withVersion(key);
    return s.getItem(versionedKey) ?? s.getItem(key);
  } catch (error) {
    logError(error, 'tryReadRawFromStorage', key);
    return null;
  }
}

function tryWriteRawToStorage(s: Storage | null, key: string, payload: string): boolean {
  if (!s) return false;
  try {
    s.setItem(withVersion(key), payload);
    return true;
  } catch (error) {
    logError(error, 'tryWriteRawToStorage', key);
    return false;
  }
}

function safeRemoveKeyFromStorage(s: Storage, key: string): void {
  try {
    s.removeItem(key);
  } catch (error) {
    logError(error, 'safeRemoveKeyFromStorage', key);
  }
}

// ============================================================================
// Helper Utilities
// ============================================================================

function withVersion(key: string): string {
  return `${CACHE_VERSION_PREFIX}${key}`;
}

function stripVersionPrefix(key: string): string {
  return key.startsWith(CACHE_VERSION_PREFIX) ? key.slice(CACHE_VERSION_PREFIX.length) : key;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function logError(error: unknown, operation: string, key?: string): void {
  if (IS_DEV) {
    console.warn(`[Cache ${operation}${key ? ` key="${key}"` : ''}]:`, error);
  }
}

// ============================================================================
// Eviction & Cleanup
// ============================================================================

function evictOldestKeys<K, V>(cache: Map<K, V>, maxSize: number): void {
  if (!(maxSize > 0)) return;
  while (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || parsed.data === undefined || parsed.data === null) return null;
    return parsed;
  } catch (error) {
    logError(error, 'parseEnvelope');
    return null;
  }
}

function safeRemoveEverywhereUsing(storages: Storage[], logicalKey: string): void {
  const versionedKey = withVersion(logicalKey);
  for (const s of storages) {
    safeRemoveKeyFromStorage(s, versionedKey);
    safeRemoveKeyFromStorage(s, logicalKey);
  }
  memoryCache.delete(versionedKey);
  memoryCache.delete(logicalKey);
}

function safeRemoveEverywhere(logicalKey: string): void {
  safeRemoveEverywhereUsing(safeGetStorages(), logicalKey);
}

export function removeCache(logicalKey: string): void {
  safeRemoveEverywhere(logicalKey);
}

function cleanupExpired(prefix: string = CACHE_VERSION_PREFIX): void {
  try {
    const now = Date.now();
    if (now < nextCleanupAt) return;
    nextCleanupAt = now + CLEANUP_INTERVAL_MS;

    const storages = safeGetStorages();
    
    const scan = (s: Storage | null) => {
      if (!s) return;
      const keys: string[] = [];
      const maxKeys = Math.min(s.length, MAX_KEYS_PER_CLEANUP);
      
      for (let i = 0; i < maxKeys; i++) {
        const k = s.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      
      for (const k of keys) {
        try {
          const raw = s.getItem(k);
          if (!raw) continue;
          const parsed = parseEnvelope<unknown>(raw);
          if (!parsed) {
            safeRemoveEverywhereUsing(storages, stripVersionPrefix(k));
            continue;
          }
          if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= now) {
            const logical = stripVersionPrefix(k);
            safeRemoveEverywhereUsing(storages, logical);
          }
        } catch (error) {
          logError(error, 'cleanupExpired:scan', k);
          s.removeItem(k);
        }
      }
    };
    
    scan(getStorage());
    scan(getSessionStorage());
    
    // Cleanup memory cache
    let checked = 0;
    for (const [k, v] of memoryCache) {
      if (checked++ >= MAX_KEYS_PER_CLEANUP) break;
      try {
        const parsed = parseEnvelope<unknown>(v);
        if (!parsed) {
          memoryCache.delete(k);
          continue;
        }
        if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= now) {
          safeRemoveEverywhereUsing(storages, stripVersionPrefix(k));
        }
      } catch (error) {
        logError(error, 'cleanupExpired:memory', k);
        memoryCache.delete(k);
      }
    }
  } catch (error) {
    logError(error, 'cleanupExpired');
  }
}

// ============================================================================
// Read/Write Operations
// ============================================================================

function readFromAllStorages(key: string): string | null {
  return (
    memoryCache.get(withVersion(key)) ??
    memoryCache.get(key) ??
    tryReadRawFromStorage(getStorage(), key) ??
    tryReadRawFromStorage(getSessionStorage(), key) ??
    null
  );
}

function readEnvelopeAuto<T>(key: string, allowStale = false): CacheEnvelope<T> | null {
  try {
    const raw = readFromAllStorages(key);
    if (!raw) return null;
    
    const parsed = parseEnvelope<T>(raw);
    if (!parsed) {
      safeRemoveEverywhere(key);
      return null;
    }
    
    if (!allowStale && typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
      safeRemoveEverywhere(key);
      return null;
    }
    
    return parsed;
  } catch (error) {
    logError(error, 'readEnvelopeAuto', key);
    safeRemoveEverywhere(key);
    return null;
  }
}

function writeEnvelopeAuto<T>(key: string, data: T, ttlMs: number): void {
  try {
    const payload = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
    const storage = getStorage();
    const session = getSessionStorage();
    
    if (tryWriteRawToStorage(storage, key, payload)) return;
    if (tryWriteRawToStorage(session, key, payload)) return;
    
    // Fallback to memory with size limit
    evictOldestKeys(memoryCache, MAX_GLOBAL_MEMORY_CACHE_SIZE);
    memoryCache.set(withVersion(key), payload);
  } catch (error) {
    logError(error, 'writeEnvelopeAuto', key);
  }
}

// ============================================================================
// Collection Utilities
// ============================================================================

function countNamespaceEntries(namespace: string): number {
  const prefix = `${namespace}:`;
  const keys = new Set<string>();
  
  for (const s of safeGetStorages()) {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k) continue;
      const logical = stripVersionPrefix(k);
      if (logical.startsWith(prefix)) keys.add(logical);
    }
  }
  
  for (const k of memoryCache.keys()) {
    const logical = stripVersionPrefix(k);
    if (logical.startsWith(prefix)) keys.add(logical);
  }
  
  return keys.size;
}

function collectKeysMatchingPattern(pattern: RegExp): Set<string> {
  const keys = new Set<string>();
  
  for (const s of safeGetStorages()) {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k) continue;
      const logical = stripVersionPrefix(k);
      if (pattern.test(logical)) keys.add(logical);
    }
  }
  
  for (const k of memoryCache.keys()) {
    const logical = stripVersionPrefix(k);
    if (pattern.test(logical)) keys.add(logical);
  }
  
  return keys;
}

// ============================================================================
// Deduplication Utilities
// ============================================================================

export function dedupeInFlight<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  fn: () => Promise<T>,
  options?: { maxSize?: number },
): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  
  const promise = fn().finally(() => {
    const cur = cache.get(key);
    if (cur === promise) cache.delete(key);
  });
  
  const maxSize = options?.maxSize;
  if (typeof maxSize === "number") evictOldestKeys(cache, maxSize);
  cache.set(key, promise);
  
  return promise;
}

export function dedupeInFlightTtl<T>(
  cache: Map<string, InFlightTtlEntry<T>>,
  key: string,
  fn: () => Promise<T>,
  options: { ttlMs: number; maxSize?: number; pruneWhenSizeOver?: number },
): Promise<T> {
  const now = Date.now();
  const pruneWhenSizeOver = options.pruneWhenSizeOver ?? DEFAULT_PRUNE_THRESHOLD;
  
  // Prune expired entries
  if (cache.size > pruneWhenSizeOver) {
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }
  
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  
  // Improved race condition handling
  const promise = fn()
    .then((result) => {
      // Check if entry is still valid when promise resolves
      const cur = cache.get(key);
      if (cur?.promise === promise) {
        // If expired by the time we got here, remove it
        if (cur.expiresAt <= Date.now()) {
          cache.delete(key);
        }
      }
      return result;
    })
    .catch((error) => {
      // Always remove on error
      const cur = cache.get(key);
      if (cur?.promise === promise) cache.delete(key);
      throw error;
    });
  
  const maxSize = options.maxSize;
  if (typeof maxSize === "number") evictOldestKeys(cache, maxSize);
  
  cache.set(key, { promise, expiresAt: now + options.ttlMs });
  return promise;
}

// ============================================================================
// Batch Processor
// ============================================================================

export class BatchProcessor<K, V> {
  private queue: Array<{ key: K; resolve: (value: V) => void; reject: (error: unknown) => void }> = [];
  private scheduled = false;
  private flushing = false;

  constructor(
    private readonly loadBatch: (keys: K[]) => Promise<V[]>,
    private readonly maxBatchSize: number = DEFAULT_MAX_BATCH_SIZE,
  ) {}

  load(key: K): Promise<V> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      
      if (this.queue.length >= this.maxBatchSize) {
        void this.flush();
        return;
      }
      
      if (!this.scheduled && !this.flushing) {
        this.scheduled = true;
        queueMicrotask(() => void this.flush());
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    this.scheduled = false;
    
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.maxBatchSize);
        const keys = batch.map((b) => b.key);
        
        try {
          const values = await this.loadBatch(keys);
          if (!Array.isArray(values) || values.length !== batch.length) {
            throw new Error("BatchProcessor.loadBatch returned invalid result");
          }
          for (let i = 0; i < batch.length; i++) {
            batch[i].resolve(values[i]);
          }
        } catch (error) {
          for (const item of batch) {
            item.reject(error);
          }
        }
      }
    } finally {
      this.flushing = false;
      if (this.queue.length > 0 && !this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => void this.flush());
      }
    }
  }
}

// ============================================================================
// Cache Instance Implementation
// ============================================================================

class CacheInstanceImpl implements UnifiedCacheInstance {
  readonly namespace: string;
  readonly mode: CacheStorageMode;
  private readonly defaultTtlMs: number | undefined;
  private readonly maxSize: number | undefined;
  private readonly memory = new Map<string, CacheEnvelope<unknown>>();
  private readonly stats: CacheInstanceStats = {
    reads: 0,
    writes: 0,
    removes: 0,
    hits: 0,
    misses: 0,
    storageErrors: 0,
    avgReadTimeMs: 0,
    avgWriteTimeMs: 0,
  };
  private readonly onError?: (error: Error, operation: string, key?: string) => void;
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(namespace: string, config?: CacheInstanceConfig) {
    this.namespace = namespace;
    this.mode = config?.mode ?? "auto";
    this.defaultTtlMs = config?.defaultTtlMs;
    this.maxSize = config?.maxSize;
    this.onError = config?.onError;
  }

  getStats(): CacheInstanceStats {
    return { ...this.stats };
  }

  getSize(): number {
    if (this.mode === "memory") return this.memory.size;
    return countNamespaceEntries(this.namespace);
  }

  private makeFullKey(key: string): string {
    const prefix = `${this.namespace}:`;
    if (key.startsWith(prefix)) return key;
    return `${prefix}${key}`;
  }

  private toSubKey(fullKey: string): string {
    const prefix = `${this.namespace}:`;
    return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
  }

  private handleError(error: unknown, operation: string, key?: string): void {
    this.stats.storageErrors += 1;
    const err = error instanceof Error ? error : new Error(String(error));
    
    if (this.onError) {
      this.onError(err, operation, key);
    } else {
      logError(err, `${this.namespace}:${operation}`, key);
    }
  }

  private updateReadTime(timeMs: number): void {
    this.readTimes.push(timeMs);
    if (this.readTimes.length > 100) this.readTimes.shift();
    this.stats.avgReadTimeMs = this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length;
  }

  private updateWriteTime(timeMs: number): void {
    this.writeTimes.push(timeMs);
    if (this.writeTimes.length > 100) this.writeTimes.shift();
    this.stats.avgWriteTimeMs = this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length;
  }

  getEnvelope<T>(key: string, allowStale = false): CacheEnvelope<T> | null {
    const start = performance.now();
    this.stats.reads += 1;
    const fullKey = this.makeFullKey(key);

    try {
      if (this.mode === "memory") {
        const cached = this.memory.get(fullKey);
        if (!cached) {
          this.stats.misses += 1;
          this.updateReadTime(performance.now() - start);
          return null;
        }
        
        if (!allowStale && typeof cached.expiresAt === "number" && cached.expiresAt <= Date.now()) {
          this.memory.delete(fullKey);
          this.stats.misses += 1;
          this.updateReadTime(performance.now() - start);
          return null;
        }
        
        // LRU: Move to end
        this.memory.delete(fullKey);
        this.memory.set(fullKey, cached);
        this.stats.hits += 1;
        this.updateReadTime(performance.now() - start);
        return cached as CacheEnvelope<T>;
      }

      const cached = this.mode === "auto"
        ? readEnvelopeAuto<T>(fullKey, allowStale)
        : this.readEnvelopeWithMode<T>(fullKey, allowStale);

      if (!cached) {
        this.stats.misses += 1;
        this.updateReadTime(performance.now() - start);
        return null;
      }

      this.stats.hits += 1;
      this.updateReadTime(performance.now() - start);
      return cached;
    } catch (error) {
      this.handleError(error, 'getEnvelope', fullKey);
      this.stats.misses += 1;
      this.updateReadTime(performance.now() - start);
      return null;
    }
  }

  private readEnvelopeWithMode<T>(fullKey: string, allowStale: boolean): CacheEnvelope<T> | null {
    const { primary, secondary } = getPreferredStorages(this.mode);
    const raw = readFromAllStorages(fullKey);
    
    if (!raw) return null;
    
    const parsed = parseEnvelope<T>(raw);
    if (!parsed) {
      safeRemoveEverywhere(fullKey);
      return null;
    }
    
    if (!allowStale && typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
      safeRemoveEverywhere(fullKey);
      return null;
    }
    
    return parsed;
  }

  get<T>(key: string, allowStale = false): T | null {
    const cached = this.getEnvelope<T>(key, allowStale);
    return cached ? cached.data : null;
  }

  async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, options?: CacheGetOrFetchOptions): Promise<T> {
    const bypassCache = options?.bypassCache === true;
    const allowStale = options?.allowStale === true;
    const softRefreshThresholdMs = options?.softRefreshThresholdMs;
    const ttlMs = options?.ttlMs;

    if (!bypassCache) {
      const env = this.getEnvelope<T>(key, allowStale);
      if (env) {
        const timeLeft = env.expiresAt - Date.now();
        if (timeLeft > 0) {
          // Soft refresh in background
          if (typeof softRefreshThresholdMs === "number" && softRefreshThresholdMs > 0 && timeLeft < softRefreshThresholdMs) {
            void fetchFn()
              .then((fresh) => this.set(key, fresh, ttlMs))
              .catch((error) => this.handleError(error, 'softRefresh', key));
          }
          return env.data;
        }
      }
    }

    const fresh = await fetchFn();
    this.set(key, fresh, ttlMs);
    return fresh;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const start = performance.now();
    const ttl = ttlMs ?? this.defaultTtlMs;
    
    if (ttl === undefined || ttl === null) {
      this.handleError(new Error('TTL must be specified'), 'set', key);
      return;
    }
    
    if (!(ttl > 0)) {
      this.remove(key);
      return;
    }
    
    this.stats.writes += 1;
    const fullKey = this.makeFullKey(key);

    try {
      if (this.mode === "memory") {
        this.memory.delete(fullKey);
        this.memory.set(fullKey, { data, expiresAt: Date.now() + ttl });
        
        const maxSize = this.maxSize;
        if (typeof maxSize === "number" && maxSize > 0) {
          evictOldestKeys(this.memory, maxSize);
        }
        
        this.updateWriteTime(performance.now() - start);
        return;
      }

      if (this.mode === "auto") {
        writeEnvelopeAuto<T>(fullKey, data, ttl);
        this.updateWriteTime(performance.now() - start);
        return;
      }

      const payload = JSON.stringify({ data, expiresAt: Date.now() + ttl });
      const { primary, secondary } = getPreferredStorages(this.mode);
      
      if (tryWriteRawToStorage(primary, fullKey, payload)) {
        this.updateWriteTime(performance.now() - start);
        return;
      }
      if (tryWriteRawToStorage(secondary, fullKey, payload)) {
        this.updateWriteTime(performance.now() - start);
        return;
      }
      
      evictOldestKeys(memoryCache, MAX_GLOBAL_MEMORY_CACHE_SIZE);
      memoryCache.set(withVersion(fullKey), payload);
      this.updateWriteTime(performance.now() - start);
    } catch (error) {
      this.handleError(error, 'set', fullKey);
      this.updateWriteTime(performance.now() - start);
    }
  }

  remove(key: string): void {
    this.stats.removes += 1;
    const fullKey = this.makeFullKey(key);
    
    try {
      if (this.mode === "memory") {
        this.memory.delete(fullKey);
        return;
      }
      safeRemoveEverywhere(fullKey);
    } catch (error) {
      this.handleError(error, 'remove', fullKey);
    }
  }

  clearAll(): void {
    try {
      if (this.mode === "memory") {
        this.memory.clear();
        return;
      }
      UnifiedCacheManager.invalidatePattern(new RegExp(`^${escapeRegExp(this.namespace)}:`));
    } catch (error) {
      this.handleError(error, 'clearAll');
    }
  }

  clearWhere(predicate: (subKey: string) => boolean): void {
    try {
      if (this.mode === "memory") {
        for (const fullKey of Array.from(this.memory.keys())) {
          const sub = this.toSubKey(fullKey);
          if (predicate(sub)) this.memory.delete(fullKey);
        }
        return;
      }

      const prefix = `${this.namespace}:`;
      const keysToRemove = new Set<string>();
      const storages = safeGetStorages();
      
      for (const s of storages) {
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (!k) continue;
          const logical = stripVersionPrefix(k);
          if (!logical.startsWith(prefix)) continue;
          const sub = logical.slice(prefix.length);
          if (predicate(sub)) keysToRemove.add(logical);
        }
      }
      
      for (const k of memoryCache.keys()) {
        const logical = stripVersionPrefix(k);
        if (!logical.startsWith(prefix)) continue;
        const sub = logical.slice(prefix.length);
        if (predicate(sub)) keysToRemove.add(logical);
      }
      
      for (const logical of keysToRemove) {
        safeRemoveEverywhereUsing(storages, logical);
      }
    } catch (error) {
      this.handleError(error, 'clearWhere');
    }
  }

  updateWhere<T>(predicate: (subKey: string) => boolean, updater: (data: T) => T | null, ttlMs?: number): void {
    try {
      const subKeysWithData = new Map<string, T>();

      if (this.mode === "memory") {
        for (const [fullKey, envelope] of this.memory) {
          const sub = this.toSubKey(fullKey);
          if (predicate(sub)) {
            subKeysWithData.set(sub, envelope.data as T);
          }
        }
      } else {
        const prefix = `${this.namespace}:`;
        const subKeys = new Set<string>();
        
        for (const s of safeGetStorages()) {
          for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (!k) continue;
            const logical = stripVersionPrefix(k);
            if (!logical.startsWith(prefix)) continue;
            const sub = logical.slice(prefix.length);
            if (predicate(sub)) subKeys.add(sub);
          }
        }
        
        for (const k of memoryCache.keys()) {
          const logical = stripVersionPrefix(k);
          if (!logical.startsWith(prefix)) continue;
          const sub = logical.slice(prefix.length);
          if (predicate(sub)) subKeys.add(sub);
        }
        
        // Read data for each matching key
        for (const subKey of subKeys) {
          const current = this.get<T>(subKey, false);
          if (current !== null) {
            subKeysWithData.set(subKey, current);
          }
        }
      }

      // Apply updates
      for (const [subKey, current] of subKeysWithData) {
        const next = updater(current);
        if (next === null) {
          this.remove(subKey);
        } else {
          this.set(subKey, next, ttlMs);
        }
      }
    } catch (error) {
      this.handleError(error, 'updateWhere');
    }
  }

  invalidateFullKey(pattern: RegExp): number {
    if (this.mode !== "memory") return 0;
    let removed = 0;
    for (const key of Array.from(this.memory.keys())) {
      if (pattern.test(key)) {
        this.memory.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

// ============================================================================
// Cache Manager
// ============================================================================

export class UnifiedCacheManager {
  private static instances = new Map<string, CacheInstanceImpl>();

  static create(namespace: string, config?: CacheInstanceConfig): UnifiedCacheInstance {
    const key = `${namespace}::${config?.mode ?? "auto"}`;
    const existing = UnifiedCacheManager.instances.get(key);
    if (existing) return existing;
    
    const inst = new CacheInstanceImpl(namespace, config);
    UnifiedCacheManager.instances.set(key, inst);
    return inst;
  }

  static invalidatePattern(pattern: RegExp): void {
    for (const inst of UnifiedCacheManager.instances.values()) {
      inst.invalidateFullKey(pattern);
    }
    const storages = safeGetStorages();
    const keys = collectKeysMatchingPattern(pattern);
    for (const logical of keys) {
      safeRemoveEverywhereUsing(storages, logical);
    }
  }

  static getMetrics(): CacheManagerMetrics {
    const instances = Array.from(UnifiedCacheManager.instances.values()).map((inst) => ({
      namespace: inst.namespace,
      mode: inst.mode,
      size: inst.getSize(),
      stats: inst.getStats(),
    }));
    return { instances, memoryFallbackSize: memoryCache.size };
  }

  static cleanup(): void {
    cleanupExpired();
  }
}

// ============================================================================
// Cache Monitor
// ============================================================================

export class UnifiedCacheMonitor {
  private static monitoringTimer: ReturnType<typeof setTimeout> | null = null;

  static startMonitoring(intervalMs: number = CLEANUP_INTERVAL_MS): () => void {
    this.stopMonitoring();
    
    const scheduleNext = () => {
      this.monitoringTimer = setTimeout(() => {
        try {
          // Run cleanup
          UnifiedCacheManager.cleanup();
          // Print report
          this.printReport();
        } catch (error) {
          logError(error, 'monitoring');
        }
        scheduleNext();
      }, Math.max(5_000, intervalMs));
    };
    
    scheduleNext();
    return () => this.stopMonitoring();
  }

  static stopMonitoring(): void {
    if (!this.monitoringTimer) return;
    try {
      clearTimeout(this.monitoringTimer);
    } catch (error) {
      logError(error, 'stopMonitoring');
    }
    this.monitoringTimer = null;
  }

  static printReport(): void {
    try {
      const m = UnifiedCacheManager.getMetrics();
      const rows = (m.instances || [])
        .slice()
        .sort((a, b) => (a.namespace < b.namespace ? -1 : a.namespace > b.namespace ? 1 : 0));
      
      const header = [
        "Namespace",
        "Mode",
        "Size",
        "Reads",
        "Hits",
        "Misses",
        "Hit%",
        "Writes",
        "Removes",
        "Errors",
        "AvgRead(ms)",
        "AvgWrite(ms)",
      ];
      
      const data = rows.map((r) => {
        const hitRate = r.stats.reads > 0 ? ((r.stats.hits / r.stats.reads) * 100).toFixed(1) : "0.0";
        return [
          r.namespace,
          r.mode,
          String(r.size),
          String(r.stats.reads),
          String(r.stats.hits),
          String(r.stats.misses),
          hitRate,
          String(r.stats.writes),
          String(r.stats.removes),
          String(r.stats.storageErrors),
          r.stats.avgReadTimeMs.toFixed(2),
          r.stats.avgWriteTimeMs.toFixed(2),
        ];
      });
      
      const all = [header, ...data];
      const widths = header.map((_, i) => Math.max(...all.map((row) => row[i].length)));
      
      const fmtRow = (cells: string[]) =>
        "│" + cells.map((c, i) => ` ${c.padEnd(widths[i])} `).join("│") + "│";
      
      const line = (left: string, mid: string, right: string, fill: string) =>
        left + widths.map((w) => fill.repeat(w + 2)).join(mid) + right;
      
      const top = line("┌", "┬", "┐", "─");
      const sep = line("├", "┼", "┤", "─");
      const bot = line("└", "┴", "┘", "─");
      
      const out = [
        "",
        "=".repeat(80),
        "CACHE METRICS",
        "=".repeat(80),
        top,
        fmtRow(header),
        sep,
        ...data.map(fmtRow),
        bot,
        `Memory fallback size: ${m.memoryFallbackSize}`,
        "=".repeat(80),
        "",
      ].join("\n");
      
      console.log(out);
    } catch (error) {
      logError(error, 'printReport');
    }
  }
}