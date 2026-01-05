export type RetryBackoff = "linear" | "exponential";

export type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepPartial<U>>
    : T extends object
      ? { [P in keyof T]?: DeepPartial<T[P]> }
      : T;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Keys extends keyof T
  ? Required<Pick<T, Keys>> & Partial<Omit<T, Keys>>
  : never;

export type EdgeFunctionError = { message?: string; context?: { status?: number; body?: unknown } };

export type EdgeFunctionResponse<T> = { data: T; error: EdgeFunctionError | null };

export type RetryOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  backoff?: RetryBackoff;
  signal?: AbortSignal;
  shouldRetryError?: (error: unknown, attempt: number) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
};

export type SupabaseFunctionInvokeArgs = {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type SupabaseFunctionInvoke = <T = unknown>(
  name: string,
  args?: SupabaseFunctionInvokeArgs,
) => Promise<{ data: T; error: any }>;

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

function createAbortError(message: string = "aborted"): Error {
  const err = new Error(message);
  (err as any).name = "AbortError";
  return err;
}

export async function withRetryResult<T>(
  operation: (ctx: { attempt: number; signal: AbortSignal }) => Promise<{ value: T; retry: boolean }>,
  opts?: RetryOptions,
): Promise<T> {
  const maxRetries = Math.max(0, opts?.maxRetries ?? 0);
  const timeoutMs = Math.max(0, opts?.timeoutMs ?? 0);
  const baseDelay = Math.max(250, opts?.retryDelayMs ?? 500);
  const backoff = opts?.backoff ?? "linear";
  const shouldRetryError = opts?.shouldRetryError ?? ((error) => !isAbortLikeError(error));
  const outerSignal = opts?.signal;

  let attempt = 0;
  while (true) {
    if (outerSignal?.aborted) {
      throw createAbortError();
    }
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const onOuterAbort = () => controller.abort();
    if (outerSignal) {
      try {
        outerSignal.addEventListener("abort", onOuterAbort, { once: true });
      } catch {
        void 0;
      }
    }
    try {
      const out = await operation({ attempt, signal: controller.signal });
      if (timer) clearTimeout(timer);
      if (outerSignal) {
        try {
          outerSignal.removeEventListener("abort", onOuterAbort);
        } catch {
          void 0;
        }
      }
      if (out.retry && attempt < maxRetries) {
        if (outerSignal?.aborted) {
          throw createAbortError();
        }
        attempt += 1;
        opts?.onRetry?.(attempt, out.value);
        const delay =
          backoff === "exponential" ? baseDelay * Math.pow(2, attempt - 1) : baseDelay * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return out.value;
    } catch (error) {
      if (timer) clearTimeout(timer);
      if (outerSignal) {
        try {
          outerSignal.removeEventListener("abort", onOuterAbort);
        } catch {
          void 0;
        }
      }
      if (outerSignal?.aborted) {
        throw createAbortError();
      }
      if (attempt < maxRetries && shouldRetryError(error, attempt)) {
        attempt += 1;
        opts?.onRetry?.(attempt, error);
        const delay =
          backoff === "exponential" ? baseDelay * Math.pow(2, attempt - 1) : baseDelay * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

export async function invokeSupabaseFunctionWithRetry<T>(
  invoke: SupabaseFunctionInvoke,
  fnName: string,
  init: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal },
  opts?: RetryOptions,
): Promise<EdgeFunctionResponse<T>> {
  const mergedSignal = init.signal ?? opts?.signal;
  const effectiveOpts: RetryOptions = {
    timeoutMs: 20_000,
    maxRetries: 0,
    ...opts,
    signal: mergedSignal,
  };
  return await withRetryResult(
    async ({ signal }) => {
      const { data, error } = await invoke<T>(fnName, {
        body: init.body,
        headers: init.headers,
        signal,
      });
      if (error) {
        const status = (error as EdgeFunctionError | null)?.context?.status ?? 0;
        const isTransient = !isAbortLikeError(error) && (status === 0 || status === 408 || status === 429 || status >= 500);
        return { value: { data: data as T, error: error as EdgeFunctionError }, retry: isTransient };
      }
      return { value: { data: data as T, error: null }, retry: false };
    },
    effectiveOpts,
  );
}
