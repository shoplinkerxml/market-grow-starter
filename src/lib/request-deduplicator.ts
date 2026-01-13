export type RequestDeduplicatorErrorStrategy = "remove" | "keep" | "retry";

export type RequestDeduplicatorBackoff = "linear" | "exponential";

export type RequestDeduplicatorOptions = {
  ttl?: number;
  maxSize?: number;
  pruneWhenSizeOver?: number;
  pruneThreshold?: number;
  enableMetrics?: boolean;
  errorStrategy?: RequestDeduplicatorErrorStrategy;
  maxRetries?: number;
  retryDelayMs?: number;
  backoff?: RequestDeduplicatorBackoff;
  retainCompleted?: boolean;
};

export type RequestDeduplicatorMetrics = {
  name: string;
  size: number;
  active: number;
  calls: number;
  hits: number;
  misses: number;
  completed: number;
  evictions: number;
  prunes: number;
  retries: number;
  errors: number;
  totalDurationMs: number;
  avgDurationMs: number;
};

type Entry = {
  promise: Promise<unknown>;
  controller: AbortController;
  expiresAt: number;
  createdAt: number;
  status: "pending" | "fulfilled" | "rejected";
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortLikeError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  const name = e?.name || "";
  const message = e?.message || "";
  return (
    name === "AbortError" ||
    message.includes("AbortError") ||
    message.includes("The user aborted a request") ||
    message.includes("net::ERR_ABORTED")
  );
}

function evictOldestKeys<K, V>(cache: Map<K, V>, maxSize: number): number {
  if (!(maxSize > 0)) return 0;
  let evicted = 0;
  while (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
    evicted += 1;
  }
  return evicted;
}

export class RequestDeduplicator<T = unknown> {
  private readonly name: string;
  private readonly cache = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private readonly pruneWhenSizeOver: number;
  private readonly enableMetrics: boolean;
  private readonly errorStrategy: RequestDeduplicatorErrorStrategy;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly backoff: RequestDeduplicatorBackoff;
  private readonly retainCompleted: boolean;
  private nextPruneAt = 0;

  private metrics: Omit<RequestDeduplicatorMetrics, "name" | "size" | "active" | "avgDurationMs"> & {
    totalDurationMs: number;
  } = {
    calls: 0,
    hits: 0,
    misses: 0,
    completed: 0,
    evictions: 0,
    prunes: 0,
    retries: 0,
    errors: 0,
    totalDurationMs: 0,
  };

  constructor(name: string, options?: RequestDeduplicatorOptions) {
    this.name = name;
    this.ttlMs = Math.max(0, options?.ttl ?? 30_000);
    this.maxSize = Math.max(1, options?.maxSize ?? 200);
    const pruneRaw = options?.pruneWhenSizeOver ?? options?.pruneThreshold ?? 50;
    this.pruneWhenSizeOver = Math.max(1, pruneRaw);
    this.enableMetrics = options?.enableMetrics === true;
    this.errorStrategy = options?.errorStrategy ?? "remove";
    const maxRetriesRaw = options?.maxRetries;
    const maxRetriesDefault = 1;
    this.maxRetries = this.errorStrategy === "retry" ? Math.max(0, maxRetriesRaw ?? maxRetriesDefault) : 0;
    this.retryDelayMs = Math.max(0, options?.retryDelayMs ?? 250);
    this.backoff = options?.backoff ?? "linear";
    this.retainCompleted = options?.retainCompleted === true;
  }

  getSize(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  remove(key: string): void {
    this.cache.delete(key);
  }

  clearWhere(predicate: (key: string) => boolean): number {
    let removed = 0;
    for (const [k, v] of this.cache) {
      if (!predicate(k)) continue;
      if (v.status === "pending") {
        try {
          v.controller.abort();
        } catch {
          void 0;
        }
      }
      this.cache.delete(k);
      removed += 1;
    }
    return removed;
  }

  invalidatePrefix(prefix: string): number {
    return this.clearWhere((k) => k.startsWith(prefix));
  }

  cancel(key: string): boolean {
    const v = this.cache.get(key);
    if (!v) return false;
    if (v.status !== "pending") return false;
    try {
      v.controller.abort();
    } catch {
      void 0;
    }
    this.cache.delete(key);
    return true;
  }

  cancelPrefix(prefix: string): number {
    let cancelled = 0;
    for (const [k, v] of this.cache) {
      if (!k.startsWith(prefix)) continue;
      if (v.status !== "pending") continue;
      try {
        v.controller.abort();
      } catch {
        void 0;
      }
      this.cache.delete(k);
      cancelled += 1;
    }
    return cancelled;
  }

  cancelAll(): number {
    return this.cancelPrefix("");
  }

  getMetrics(): RequestDeduplicatorMetrics {
    const now = Date.now();
    let active = 0;
    for (const v of this.cache.values()) {
      if (v.status === "pending" && v.expiresAt > now) active += 1;
    }
    const completed = this.metrics.completed;
    const avgDurationMs = completed > 0 ? Math.round(this.metrics.totalDurationMs / completed) : 0;
    return {
      name: this.name,
      size: this.cache.size,
      active,
      ...this.metrics,
      avgDurationMs,
    };
  }

  private bump<K extends keyof typeof this.metrics>(key: K, by: number = 1): void {
    if (!this.enableMetrics) return;
    this.metrics[key] += by;
  }

  private pruneExpired(now: number): void {
    if (this.cache.size <= this.pruneWhenSizeOver && now < this.nextPruneAt) return;
    if (this.cache.size <= this.pruneWhenSizeOver) {
      const delay = Math.max(250, this.ttlMs);
      this.nextPruneAt = now + delay;
    }
    let pruned = 0;
    for (const [k, v] of this.cache) {
      if (v.expiresAt > now) continue;
      if (v.status === "pending") {
        try {
          v.controller.abort();
        } catch {
          void 0;
        }
      }
      this.cache.delete(k);
      pruned += 1;
    }
    if (pruned > 0) this.bump("prunes", pruned);
  }

  private async runWithRetries<U>(fn: (ctx: { attempt: number }) => Promise<U>): Promise<U> {
    let attempt = 0;
    while (true) {
      try {
        return await fn({ attempt });
      } catch (error) {
        if (isAbortLikeError(error)) throw error;
        if (attempt >= this.maxRetries) throw error;
        attempt += 1;
        this.bump("retries", 1);
        const factor = this.backoff === "exponential" ? Math.pow(2, attempt - 1) : attempt;
        await sleep(this.retryDelayMs * factor);
      }
    }
  }

  async dedupe<U = T>(key: string, request: (ctx: { signal: AbortSignal }) => Promise<U>): Promise<U>;
  async dedupe<U = T>(key: string, request: () => Promise<U>): Promise<U>;
  async dedupe<U = T>(key: string, request: ((ctx: { signal: AbortSignal }) => Promise<U>) | (() => Promise<U>)): Promise<U> {
    const now = Date.now();
    this.bump("calls", 1);
    this.pruneExpired(now);

    const existing = this.cache.get(key);
    if (existing) {
      if (existing.status === "pending" && existing.expiresAt > now) {
        this.bump("hits", 1);
        return existing.promise as Promise<U>;
      }
      if (this.retainCompleted && existing.expiresAt > now) {
        if (existing.status === "fulfilled") {
          this.bump("hits", 1);
          return existing.promise as Promise<U>;
        }
        if (existing.status === "rejected" && this.errorStrategy === "keep") {
          this.bump("hits", 1);
          return existing.promise as Promise<U>;
        }
      }
      if (existing.status === "pending") {
        try {
          existing.controller.abort();
        } catch {
          void 0;
        }
      }
      this.cache.delete(key);
    }

    this.bump("misses", 1);

    const controller = new AbortController();
    const startedAt = now;
    const run = () => (request as any)({ signal: controller.signal }) as Promise<U>;
    const promise = this.runWithRetries(() => run())
      .catch((error) => {
        this.bump("errors", 1);
        throw error;
      });

    const entry: Entry = {
      promise,
      controller,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      status: "pending",
    };

    const evicted = evictOldestKeys(this.cache, this.maxSize);
    if (evicted > 0) this.bump("evictions", evicted);
    this.cache.set(key, entry);

    void promise
      .then(() => {
        const finishedAt = Date.now();
        const duration = Math.max(0, finishedAt - startedAt);
        this.bump("completed", 1);
        if (this.enableMetrics) this.metrics.totalDurationMs += duration;
        const cur = this.cache.get(key);
        if (cur?.promise !== promise) return;
        if (this.retainCompleted) {
          cur.status = "fulfilled";
        } else {
          this.cache.delete(key);
        }
      })
      .catch(() => {
        const finishedAt = Date.now();
        const duration = Math.max(0, finishedAt - startedAt);
        this.bump("completed", 1);
        if (this.enableMetrics) this.metrics.totalDurationMs += duration;
        const cur = this.cache.get(key);
        if (cur?.promise !== promise) return;
        if (this.retainCompleted && this.errorStrategy === "keep") {
          cur.status = "rejected";
          return;
        }
        this.cache.delete(key);
      });

    return promise;
  }
}

function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries
    .map(([k, v]) => {
      const raw = v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `${encodeURIComponent(k)}=${encodeURIComponent(raw ?? "")}`;
    })
    .join("&");
}

export class GlobalRequestDeduplicator {
  private static readonly instance = new RequestDeduplicator("global-request-deduplicator", {
    ttl: 120_000,
    maxSize: 500,
    pruneWhenSizeOver: 250,
    enableMetrics: true,
    errorStrategy: "remove",
    maxRetries: 0,
    retainCompleted: false,
  });

  static buildKey(input: {
    service: string;
    method: string;
    params?: Record<string, unknown> | string | null;
  }): string {
    const service = String(input.service || "").trim() || "service";
    const method = String(input.method || "").trim() || "method";
    let paramsStr = "";
    if (typeof input.params === "string") {
      paramsStr = input.params;
    } else if (input.params && typeof input.params === "object") {
      paramsStr = stableParams(input.params);
    }
    const raw = paramsStr ? `${service}:${method}:${paramsStr}` : `${service}:${method}`;
    if (raw.length <= 240) return raw;
    const hash = fnv1a32Hex(raw);
    const suffix = paramsStr ? `hash=${hash}&len=${raw.length}` : `hash=${hash}&len=${raw.length}`;
    return `${service}:${method}:${suffix}`;
  }

  static dedupeExpensive<U>(
    input: { service: string; method: string; params?: Record<string, unknown> | string | null },
    request: (ctx: { signal: AbortSignal }) => Promise<U>,
  ): Promise<U> {
    const key = this.buildKey(input);
    return this.instance.dedupe<U>(key, request);
  }

  static dedupeKey<U>(service: string, rawKey: string, request: (ctx: { signal: AbortSignal }) => Promise<U>): Promise<U> {
    const key = this.buildKey({ service, method: rawKey });
    return this.instance.dedupe<U>(key, request);
  }

  static cancelAll(): number {
    return this.instance.cancelAll();
  }

  static cancelPrefix(prefix: string): number {
    return this.instance.cancelPrefix(prefix);
  }

  static remove(key: string): void {
    this.instance.remove(key);
  }

  static getMetrics(): RequestDeduplicatorMetrics {
    return this.instance.getMetrics();
  }
}

export class RequestDeduplicatorFactory {
  private static instances = new Map<string, RequestDeduplicator<any>>();

  static create<T = unknown>(name: string, options?: RequestDeduplicatorOptions): RequestDeduplicator<T> {
    const existing = this.instances.get(name) as RequestDeduplicator<T> | undefined;
    if (existing) return existing;
    const inst = new RequestDeduplicator<T>(name, options);
    this.instances.set(name, inst as RequestDeduplicator<any>);
    return inst;
  }

  static getMetrics(): RequestDeduplicatorMetrics[] {
    return Array.from(this.instances.values()).map((d) => d.getMetrics());
  }

  static invalidateKeyPrefix(prefix: string): number {
    let removed = 0;
    for (const d of this.instances.values()) {
      removed += d.invalidatePrefix(prefix);
    }
    return removed;
  }

  static cancelKeyPrefix(prefix: string): number {
    let cancelled = 0;
    for (const d of this.instances.values()) {
      cancelled += d.cancelPrefix(prefix);
    }
    return cancelled;
  }

  static clearAll(): void {
    for (const d of this.instances.values()) d.clear();
  }
}

export class DedupeKeyBuilder {
  static simple(parts: Array<string | number | boolean | null | undefined>): string {
    const normalized = parts
      .map((p) => {
        if (p === null || p === undefined) return "";
        const s = String(p).trim();
        return s;
      })
      .filter((p) => p.length > 0);
    return normalized.join(":");
  }

  static withUserId(userId: string | null | undefined, ...parts: Array<string | number | boolean | null | undefined>): string {
    const uid = userId ? String(userId).trim() : "current";
    return this.simple(["user", uid, ...parts]);
  }

  static withParams(
    base: string | Array<string | number | boolean | null | undefined>,
    params: Record<string, unknown> | null | undefined,
  ): string {
    const entries = params ? Object.entries(params) : [];
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const encoded = entries.map(([k, v]) => {
      const raw = v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `${encodeURIComponent(k)}=${encodeURIComponent(raw ?? "")}`;
    });
    const prefix = typeof base === "string" ? [base] : base;
    return this.simple([...prefix, ...encoded]);
  }
}

export class DeduplicationMonitor {
  private static monitoringInterval: ReturnType<typeof setInterval> | null = null;

  static getAllMetrics(): RequestDeduplicatorMetrics[] {
    const extra = (() => {
      try {
        return [GlobalRequestDeduplicator.getMetrics()];
      } catch {
        return [];
      }
    })();
    const rest = RequestDeduplicatorFactory.getMetrics();
    return [...extra, ...rest].slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  static startMonitoring(intervalMs: number = 60_000): () => void {
    this.stopMonitoring();
    // Use requestIdleCallback for non-blocking metrics printing
    const scheduleNext = () => {
      this.monitoringInterval = setTimeout(() => {
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(() => {
            try {
              this.printReport();
            } catch {
              void 0;
            }
            scheduleNext();
          }, { timeout: 100 });
        } else {
          try {
            this.printReport();
          } catch {
            void 0;
          }
          scheduleNext();
        }
      }, Math.max(5000, intervalMs));
    };
    scheduleNext();
    return () => {
      this.stopMonitoring();
    };
  }

  static stopMonitoring(): void {
    if (!this.monitoringInterval) return;
    try {
      clearInterval(this.monitoringInterval);
    } catch {
      void 0;
    }
    this.monitoringInterval = null;
  }

  static printReport(): void {
    const rows = this.getAllMetrics();
    const header = ["Service", "Hit Rate", "Total Requests", "Active", "Errors", "Avg Duration", "Cache Size"];
    const data = rows.map((m) => {
      const calls = m.calls;
      const hitRate = calls > 0 ? (100 * (m.hits / calls)).toFixed(1) + "%" : "0.0%";
      const avg = `${m.avgDurationMs}ms`;
      return [m.name, hitRate, String(calls), String(m.active), String(m.errors), avg, String(m.size)];
    });
    const all = [header, ...data];
    const widths = header.map((_, i) => Math.max(...all.map((r) => r[i].length)));

    const line = (left: string, mid: string, right: string, fill: string) =>
      left +
      widths
        .map((w) => fill.repeat(w + 2))
        .join(mid) +
      right;

    const fmtRow = (cells: string[]) =>
      "│" +
      cells
        .map((c, i) => ` ${c.padEnd(widths[i])} `)
        .join("│") +
      "│";

    const top = line("┌", "┬", "┐", "─");
    const sep = line("├", "┼", "┤", "─");
    const bot = line("└", "┴", "┘", "─");

    const out = [top, fmtRow(header), sep, ...data.map(fmtRow), bot].join("\n");
    try {
      console.log(out);
    } catch {
      void 0;
    }
  }
}
