import { describe, expect, it, vi } from "vitest";
import { AuthError, NetworkError, ValidationError, mapError } from "@/lib/error-handler";
import { EdgeClient } from "@/lib/request-handler";

describe("mapError", () => {
  it("maps 401/403 to AuthError", () => {
    const err = mapError({ status: 401, message: "unauthorized" }, { code: "auth_error" });
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("auth_error");
  });

  it("maps 400/422 to ValidationError", () => {
    const err = mapError({ context: { status: 422 }, message: "bad input" }, { code: "validation_error" });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(422);
  });

  it("maps network-like errors to NetworkError", () => {
    const err = mapError({ context: { status: 0 }, message: "Failed to fetch" }, { code: "network_error" });
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.retryable).toBe(true);
  });
});

describe("EdgeClient retry", () => {
  it("retries for 5xx errors and eventually succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let calls = 0;
    const invoke = async () => {
      calls += 1;
      if (calls < 3) {
        return { data: null, error: { message: "server error", context: { status: 503 } } };
      }
      return { data: { ok: true }, error: null };
    };

    const edge = new EdgeClient(invoke as any);
    const p = edge.invokeJson<{ ok: boolean }>("fn", { body: {} }, { maxRetries: 2, retryDelayMs: 10, backoff: "linear", timeoutMs: 0 });
    const assertion = expect(p).resolves.toEqual({ ok: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(3);

    vi.useRealTimers();
  });

  it("does not retry for 429 by default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let calls = 0;
    const invoke = async () => {
      calls += 1;
      return { data: null, error: { message: "rate limited", context: { status: 429 } } };
    };

    const edge = new EdgeClient(invoke as any);
    const p = edge.invokeJson("fn", { body: {} }, { maxRetries: 2, retryDelayMs: 10, backoff: "linear", timeoutMs: 0 });
    const assertion = expect(p).rejects.toMatchObject({ status: 429 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(1);

    vi.useRealTimers();
  });
});
