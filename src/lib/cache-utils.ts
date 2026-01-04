export const CACHE_TTL = {
  productsPage: 900_000,
  shopsList: 900_000,
  categoryFilters: 300_000,
  productLinks: 120_000,
  uiPrefs: 2_592_000_000,
  tariffsList: 900_000,
  suppliersList: 900_000,
  limits: 900_000,
  supplierCategoriesMap: 600_000,
  authMe: 86_400_000,
} as const;

export type CacheEnvelope<T> = { data: T; expiresAt: number };

const CACHE_VERSION_PREFIX = "v1:";
const memoryCache = new Map<string, string>();

function evictOldestKeys<K, V>(cache: Map<K, V>, maxSize: number): void {
  if (!(maxSize > 0)) return;
  while (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

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

export type InFlightTtlEntry<T> = { promise: Promise<T>; expiresAt: number };

export function dedupeInFlightTtl<T>(
  cache: Map<string, InFlightTtlEntry<T>>,
  key: string,
  fn: () => Promise<T>,
  options: { ttlMs: number; maxSize?: number; pruneWhenSizeOver?: number },
): Promise<T> {
  const now = Date.now();
  const pruneWhenSizeOver = options.pruneWhenSizeOver ?? 50;
  if (cache.size > pruneWhenSizeOver) {
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = fn().finally(() => {
    const cur = cache.get(key);
    if (cur?.promise === promise) cache.delete(key);
  });
  const maxSize = options.maxSize;
  if (typeof maxSize === "number") evictOldestKeys(cache, maxSize);
  cache.set(key, { promise, expiresAt: now + options.ttlMs });
  return promise;
}

export class BatchProcessor<K, V> {
  private queue: Array<{ key: K; resolve: (value: V) => void; reject: (error: unknown) => void }> = [];
  private scheduled = false;

  constructor(
    private readonly loadBatch: (keys: K[]) => Promise<V[]>,
    private readonly maxBatchSize: number = 100,
  ) {}

  load(key: K): Promise<V> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (this.queue.length >= this.maxBatchSize) {
        void this.flush();
        return;
      }
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => void this.flush());
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      this.scheduled = false;
      return;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);
    this.scheduled = false;
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

    if (this.queue.length > 0) {
      this.scheduled = true;
      queueMicrotask(() => void this.flush());
    }
  }
}

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

function withVersion(key: string): string {
  return `${CACHE_VERSION_PREFIX}${key}`;
}

function parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
  const parsed = JSON.parse(raw) as CacheEnvelope<T>;
  if (!parsed || parsed.data === undefined || parsed.data === null) return null;
  return parsed;
}

export function readCache<T>(key: string, allowStale = false): CacheEnvelope<T> | null {
  try {
    const storage = getStorage();
    const session = getSessionStorage();
    const raw =
      tryReadRawFromStorage(storage, key) ??
      tryReadRawFromStorage(session, key) ??
      memoryCache.get(withVersion(key)) ??
      memoryCache.get(key) ??
      null;
    if (!raw) return null;
    try {
      const parsed = parseEnvelope<T>(raw);
      if (!parsed) {
        removeCache(key);
        return null;
      }
      if (!allowStale && typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
        removeCache(key);
        return null;
      }
      return parsed;
    } catch {
      removeCache(key);
      return null;
    }
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T, ttlMs: number): void {
  try {
    const payload = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
    const storage = getStorage();
    const session = getSessionStorage();
    if (tryWriteRawToStorage(storage, key, payload)) return;
    if (tryWriteRawToStorage(session, key, payload)) return;
    memoryCache.set(withVersion(key), payload);
  } catch {
    /* ignore */
  }
}

export function removeCache(key: string): void {
  safeRemoveEverywhere(key);
}

export function cleanupExpired(prefix: string = CACHE_VERSION_PREFIX): void {
  try {
    const storages = safeGetStorages();
    const storage = getStorage();
    const session = getSessionStorage();
    const scan = (s: Storage | null) => {
      if (!s) return;
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
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
          if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
            const logical = stripVersionPrefix(k);
            safeRemoveEverywhereUsing(storages, logical);
          }
        } catch {
          s.removeItem(k);
        }
      }
    };
    scan(storage);
    scan(session);
    for (const [k, v] of memoryCache) {
      try {
        const parsed = parseEnvelope<unknown>(v);
        if (!parsed) {
          memoryCache.delete(k);
          continue;
        }
        if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
          safeRemoveEverywhereUsing(storages, stripVersionPrefix(k));
        }
      } catch {
        memoryCache.delete(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export type CacheStorageMode = "auto" | "local" | "session" | "memory";

export type CacheInstanceStats = {
  reads: number;
  writes: number;
  removes: number;
  hits: number;
  misses: number;
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
};

export type UnifiedCacheInstance = {
  namespace: string;
  mode: CacheStorageMode;
  getEnvelope<T>(key: string, allowStale?: boolean): CacheEnvelope<T> | null;
  get<T>(key: string, allowStale?: boolean): T | null;
  set<T>(key: string, data: T, ttlMs?: number): void;
  remove(key: string): void;
  clearAll(): void;
  clearWhere(predicate: (subKey: string) => boolean): void;
};

function stripVersionPrefix(key: string): string {
  return key.startsWith(CACHE_VERSION_PREFIX) ? key.slice(CACHE_VERSION_PREFIX.length) : key;
}

function safeGetStorages(): Storage[] {
  const out: Storage[] = [];
  const storage = getStorage();
  const session = getSessionStorage();
  if (storage) out.push(storage);
  if (session) out.push(session);
  return out;
}

function safeRemoveKeyFromStorage(s: Storage, key: string): void {
  try {
    s.removeItem(key);
  } catch {
    void 0;
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  } catch {
    return null;
  }
}

function tryWriteRawToStorage(s: Storage | null, key: string, payload: string): boolean {
  if (!s) return false;
  try {
    s.setItem(withVersion(key), payload);
    return true;
  } catch {
    return false;
  }
}

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

class CacheInstanceImpl implements UnifiedCacheInstance {
  readonly namespace: string;
  readonly mode: CacheStorageMode;
  private readonly defaultTtlMs: number | undefined;
  private readonly maxSize: number | undefined;
  private readonly memory = new Map<string, CacheEnvelope<unknown>>();
  private readonly stats: CacheInstanceStats = { reads: 0, writes: 0, removes: 0, hits: 0, misses: 0 };

  constructor(namespace: string, config?: CacheInstanceConfig) {
    this.namespace = namespace;
    this.mode = config?.mode ?? "auto";
    this.defaultTtlMs = config?.defaultTtlMs;
    this.maxSize = config?.maxSize;
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

  getEnvelope<T>(key: string, allowStale = false): CacheEnvelope<T> | null {
    this.stats.reads += 1;
    const fullKey = this.makeFullKey(key);
    if (this.mode === "memory") {
      const cached = this.memory.get(fullKey);
      if (!cached) {
        this.stats.misses += 1;
        return null;
      }
      if (!allowStale && typeof cached.expiresAt === "number" && cached.expiresAt <= Date.now()) {
        this.memory.delete(fullKey);
        this.stats.misses += 1;
        return null;
      }
      this.memory.delete(fullKey);
      this.memory.set(fullKey, cached);
      this.stats.hits += 1;
      return cached as CacheEnvelope<T>;
    }
    const mode = this.mode;
    const cached =
      mode === "auto"
        ? readCache<T>(fullKey, allowStale)
        : (() => {
            const { primary, secondary } = getPreferredStorages(mode);
            const raw =
              tryReadRawFromStorage(primary, fullKey) ??
              tryReadRawFromStorage(secondary, fullKey) ??
              memoryCache.get(withVersion(fullKey)) ??
              memoryCache.get(fullKey) ??
              null;
            if (!raw) return null;
            try {
              const parsed = JSON.parse(raw) as CacheEnvelope<T>;
              if (!parsed || parsed.data === undefined || parsed.data === null) return null;
              if (!allowStale && typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
                safeRemoveEverywhere(fullKey);
                return null;
              }
              return parsed;
            } catch {
              safeRemoveEverywhere(fullKey);
              return null;
            }
          })();
    if (!cached) {
      this.stats.misses += 1;
      return null;
    }
    this.stats.hits += 1;
    return cached;
  }

  get<T>(key: string, allowStale = false): T | null {
    const cached = this.getEnvelope<T>(key, allowStale);
    return cached ? cached.data : null;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs ?? 0;
    if (!(ttl > 0)) {
      this.remove(key);
      return;
    }
    this.stats.writes += 1;
    const fullKey = this.makeFullKey(key);
    if (this.mode === "memory") {
      this.memory.delete(fullKey);
      this.memory.set(fullKey, { data, expiresAt: Date.now() + ttl });
      const maxSize = this.maxSize;
      if (typeof maxSize === "number" && maxSize > 0 && this.memory.size > maxSize) {
        while (this.memory.size > maxSize) {
          const oldestKey = this.memory.keys().next().value as string | undefined;
          if (!oldestKey) break;
          this.memory.delete(oldestKey);
        }
      }
      return;
    }
    if (this.mode === "auto") {
      writeCache<T>(fullKey, data, ttl);
      return;
    }
    const payload = JSON.stringify({ data, expiresAt: Date.now() + ttl });
    const { primary, secondary } = getPreferredStorages(this.mode);
    if (tryWriteRawToStorage(primary, fullKey, payload)) return;
    if (tryWriteRawToStorage(secondary, fullKey, payload)) return;
    memoryCache.set(withVersion(fullKey), payload);
  }

  remove(key: string): void {
    this.stats.removes += 1;
    const fullKey = this.makeFullKey(key);
    if (this.mode === "memory") {
      this.memory.delete(fullKey);
      return;
    }
    safeRemoveEverywhere(fullKey);
  }

  clearAll(): void {
    if (this.mode === "memory") {
      this.memory.clear();
      return;
    }
    UnifiedCacheManager.invalidatePattern(new RegExp(`^${escapeRegExp(this.namespace)}:`));
  }

  clearWhere(predicate: (subKey: string) => boolean): void {
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
    for (const logical of keysToRemove) safeRemoveEverywhereUsing(storages, logical);
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
    for (const logical of keys) safeRemoveEverywhereUsing(storages, logical);
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
}
