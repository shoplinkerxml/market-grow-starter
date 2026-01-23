import { describe, expect, it, vi } from "vitest";

type CounterRecord = { value: number; rev: number };

type Db = {
  get: (key: string) => Promise<CounterRecord | null>;
  set: (key: string, next: CounterRecord) => Promise<void>;
};

type Redis = {
  get: (key: string) => Promise<CounterRecord | null>;
  set: (key: string, next: CounterRecord) => Promise<void>;
};

type LocalCacheEntry = CounterRecord & { expiresAt: number };

type LocalCache = {
  get: (key: string, nowMs: number) => CounterRecord | null;
  set: (key: string, next: CounterRecord, nowMs: number, ttlMs: number) => void;
};

function createLocalCache(): { cache: LocalCache; peek: (key: string) => LocalCacheEntry | null } {
  const m = new Map<string, LocalCacheEntry>();
  return {
    cache: {
      get: (key, nowMs) => {
        const v = m.get(key) || null;
        if (!v) return null;
        if (v.expiresAt <= nowMs) return null;
        return { value: v.value, rev: v.rev };
      },
      set: (key, next, nowMs, ttlMs) => {
        m.set(key, { ...next, expiresAt: nowMs + ttlMs });
      },
    },
    peek: (key) => m.get(key) || null,
  };
}

function createCounterPipeline(deps: {
  db: Db;
  redis: Redis;
  cache: LocalCache;
  ttlMs: number;
  now: () => number;
  onStep?: (name: string) => void;
}) {
  const { db, redis, cache, ttlMs, now, onStep } = deps;

  const read = async (key: string): Promise<number> => {
    const nowMs = now();
    const cached = cache.get(key, nowMs);
    if (cached) return cached.value;

    onStep?.("redis.get");
    const fromRedis = await redis.get(key);
    if (fromRedis) {
      onStep?.("cache.set");
      cache.set(key, fromRedis, nowMs, ttlMs);
      return fromRedis.value;
    }

    onStep?.("db.get");
    const fromDb = await db.get(key);
    if (!fromDb) {
      const init = { value: 0, rev: 0 };
      onStep?.("redis.set");
      await redis.set(key, init);
      onStep?.("cache.set");
      cache.set(key, init, nowMs, ttlMs);
      return 0;
    }

    onStep?.("redis.set");
    await redis.set(key, fromDb);
    onStep?.("cache.set");
    cache.set(key, fromDb, nowMs, ttlMs);
    return fromDb.value;
  };

  const update = async (key: string, delta: number): Promise<number> => {
    const nowMs = now();
    onStep?.("db.get");
    const prev = (await db.get(key)) || { value: 0, rev: 0 };
    const next: CounterRecord = { value: prev.value + delta, rev: prev.rev + 1 };

    onStep?.("db.set");
    await db.set(key, next);

    try {
      onStep?.("redis.set");
      await redis.set(key, next);
    } catch (e) {
      onStep?.("db.rollback");
      await db.set(key, prev);
      throw e;
    }

    onStep?.("cache.set");
    cache.set(key, next, nowMs, ttlMs);
    return next.value;
  };

  return { read, update };
}

function createInMemoryDb(initial?: Record<string, CounterRecord>) {
  const m = new Map<string, CounterRecord>(Object.entries(initial || {}));
  return {
    get: vi.fn(async (key: string) => {
      const v = m.get(key) || null;
      return v ? { ...v } : null;
    }),
    set: vi.fn(async (key: string, next: CounterRecord) => {
      m.set(key, { ...next });
    }),
    peek: (key: string) => m.get(key) || null,
  };
}

function createInMemoryRedis(initial?: Record<string, CounterRecord>) {
  const m = new Map<string, CounterRecord>(Object.entries(initial || {}));
  return {
    get: vi.fn(async (key: string) => {
      const v = m.get(key) || null;
      return v ? { ...v } : null;
    }),
    set: vi.fn(async (key: string, next: CounterRecord) => {
      m.set(key, { ...next });
    }),
    peek: (key: string) => m.get(key) || null,
  };
}

describe("Counters DB → Redis → local cache pipeline", () => {
  it("Test 1: атомарное обновление пишет DB, затем Redis, затем локальный кеш", async () => {
    const steps: string[] = [];
    const nowMs = 1_000;
    const db = createInMemoryDb({ c1: { value: 10, rev: 1 } });
    const redis = createInMemoryRedis({ c1: { value: 10, rev: 1 } });
    const local = createLocalCache();

    const pipeline = createCounterPipeline({
      db,
      redis,
      cache: local.cache,
      ttlMs: 10_000,
      now: () => nowMs,
      onStep: (s) => steps.push(s),
    });

    const nextValue = await pipeline.update("c1", +1);
    expect(nextValue).toBe(11);

    expect(steps).toEqual(["db.get", "db.set", "redis.set", "cache.set"]);
    expect(db.peek("c1")).toEqual({ value: 11, rev: 2 });
    expect(redis.peek("c1")).toEqual({ value: 11, rev: 2 });
    expect(local.peek("c1")?.value).toBe(11);
    expect(local.peek("c1")?.rev).toBe(2);
  });

  it("Test 2: чтение без изменений использует локальный кеш и не дергает Redis/DB", async () => {
    const nowMs = 1_000;
    const db = createInMemoryDb({ c1: { value: 10, rev: 1 } });
    const redis = createInMemoryRedis({ c1: { value: 10, rev: 1 } });
    const local = createLocalCache();

    const pipeline = createCounterPipeline({
      db,
      redis,
      cache: local.cache,
      ttlMs: 10_000,
      now: () => nowMs,
    });

    const v1 = await pipeline.read("c1");
    expect(v1).toBe(10);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(db.get).toHaveBeenCalledTimes(0);

    const v2 = await pipeline.read("c1");
    expect(v2).toBe(10);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(db.get).toHaveBeenCalledTimes(0);
  });

  it("Test 3: при обновлении значения в Redis локальный кеш обновляется на следующем чтении после TTL", async () => {
    let nowMs = 1_000;
    const db = createInMemoryDb({ c1: { value: 10, rev: 1 } });
    const redis = createInMemoryRedis({ c1: { value: 10, rev: 1 } });
    const local = createLocalCache();

    const pipeline = createCounterPipeline({
      db,
      redis,
      cache: local.cache,
      ttlMs: 100,
      now: () => nowMs,
    });

    expect(await pipeline.read("c1")).toBe(10);
    expect(local.peek("c1")?.value).toBe(10);

    await redis.set("c1", { value: 99, rev: 2 });

    nowMs += 150;
    expect(await pipeline.read("c1")).toBe(99);
    expect(local.peek("c1")?.value).toBe(99);
    expect(db.get).toHaveBeenCalledTimes(0);
  });

  it("Test 4: сбой записи в Redis приводит к откату DB и кеш не становится неконсистентным", async () => {
    const steps: string[] = [];
    const nowMs = 1_000;
    const db = createInMemoryDb({ c1: { value: 10, rev: 1 } });
    const redis = createInMemoryRedis({ c1: { value: 10, rev: 1 } });
    const local = createLocalCache();
    local.cache.set("c1", { value: 10, rev: 1 }, nowMs, 10_000);

    redis.set.mockImplementationOnce(async () => {
      throw new Error("redis_down");
    });

    const pipeline = createCounterPipeline({
      db,
      redis,
      cache: local.cache,
      ttlMs: 10_000,
      now: () => nowMs,
      onStep: (s) => steps.push(s),
    });

    await expect(pipeline.update("c1", +1)).rejects.toThrow("redis_down");
    expect(steps).toEqual(["db.get", "db.set", "redis.set", "db.rollback"]);

    expect(db.peek("c1")).toEqual({ value: 10, rev: 1 });
    expect(redis.peek("c1")).toEqual({ value: 10, rev: 1 });
    expect(local.peek("c1")?.value).toBe(10);
  });
});
