import { describe, expect, it, vi } from "vitest";
import { RequestDeduplicator } from "@/lib/request-deduplicator";

describe("RequestDeduplicator", () => {
  it("dedupes concurrent calls by key", async () => {
    const dedup = new RequestDeduplicator<number>("t", {
      ttl: 30_000,
      maxSize: 10,
      enableMetrics: true,
      errorStrategy: "remove",
    });

    let calls = 0;
    let resolve: ((v: number) => void) | null = null;
    const p1 = dedup.dedupe("k", () => {
      calls += 1;
      return new Promise<number>((r) => { resolve = r; });
    });
    const p2 = dedup.dedupe("k", async () => {
      calls += 1;
      return 2;
    });

    expect(calls).toBe(1);

    resolve?.(1);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(1);
    expect(r2).toBe(1);

    const m = dedup.getMetrics();
    expect(m.calls).toBe(2);
    expect(m.misses).toBe(1);
    expect(m.hits).toBe(1);
  });

  it("creates a new request after TTL expiry when entry is kept", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const dedup = new RequestDeduplicator<number>("t", {
      ttl: 10,
      maxSize: 10,
      enableMetrics: true,
      errorStrategy: "keep",
    });

    let n = 0;
    const fn = async () => ++n;

    await expect(dedup.dedupe("k", fn)).resolves.toBe(1);
    vi.setSystemTime(new Date(25));
    await expect(dedup.dedupe("k", fn)).resolves.toBe(2);

    const m = dedup.getMetrics();
    expect(m.misses).toBe(2);
    expect(m.hits).toBe(0);

    vi.useRealTimers();
  });

  it("cancels an in-flight request by key", async () => {
    const dedup = new RequestDeduplicator<void>("t", {
      ttl: 30_000,
      maxSize: 10,
      enableMetrics: true,
      errorStrategy: "remove",
    });

    const p = dedup.dedupe("k", ({ signal }) => new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));

    expect(dedup.cancel("k")).toBe(true);
    await expect(p).rejects.toThrow("aborted");
  });

  it("invalidates keys by prefix", async () => {
    const dedup = new RequestDeduplicator<number>("t", {
      ttl: 30_000,
      maxSize: 10,
      enableMetrics: true,
      errorStrategy: "keep",
    });

    await dedup.dedupe("a:1", async () => 1);
    await dedup.dedupe("a:2", async () => 2);
    await dedup.dedupe("b:1", async () => 3);

    expect(dedup.invalidatePrefix("a:")).toBe(2);
    expect(dedup.getSize()).toBe(1);
  });

  it("retries a failed request when configured", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const dedup = new RequestDeduplicator<number>("t", {
      ttl: 30_000,
      maxSize: 10,
      enableMetrics: true,
      errorStrategy: "retry",
      maxRetries: 2,
      retryDelayMs: 10,
      backoff: "linear",
    });

    let calls = 0;
    const p = dedup.dedupe("k", async () => {
      calls += 1;
      if (calls < 3) throw new Error("fail");
      return 42;
    });

    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(42);

    const m = dedup.getMetrics();
    expect(m.retries).toBe(2);

    vi.useRealTimers();
  });
});

