import { AuthError, ValidationError, mapError, type AppErrorContext } from "./error-handler";
import { supabase } from "@/integrations/supabase/client";

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

export type EdgeAuth =
  | { type: "auto" }
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "authorization"; value: string };

export type EdgeAuthProvider = {
  getAccessToken: () => Promise<string | null>;
  refresh?: () => Promise<void>;
};

export type EdgeLogEvent =
  | {
      type: "edge_invoke";
      edgeFunction: string;
      durationMs: number;
      ok: boolean;
      status?: number;
    }
  | {
      type: "edge_retry";
      edgeFunction: string;
      attempt: number;
      delayMs?: number;
      status?: number;
    };

export type EdgeLogger = (event: EdgeLogEvent) => void;

export type EdgeMiddlewareContext = {
  fnName: string;
  init: SupabaseFunctionInvokeArgs;
  opts: RetryOptions;
  auth: EdgeAuth;
};

export type EdgeMiddleware = (
  ctx: EdgeMiddlewareContext,
) => EdgeMiddlewareContext | Promise<EdgeMiddlewareContext>;

export type EdgeInvokeOptions = RetryOptions & {
  headers?: Record<string, string>;
  auth?: EdgeAuth;
  middleware?: EdgeMiddleware[];
  log?: boolean;
};

type EdgeClientConfig = {
  invoke?: SupabaseFunctionInvoke;
  defaultTimeoutMs?: number;
  authProvider?: EdgeAuthProvider;
  logger?: EdgeLogger;
};

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
    async ({ signal, attempt }) => {
      const { data, error } = await invoke<T>(fnName, {
        body: init.body,
        headers: init.headers,
        signal,
      });
      if (error) {
        const status = (error as EdgeFunctionError | null)?.context?.status ?? 0;
        const defaultTransient = !isAbortLikeError(error) && (status === 0 || status >= 500);
        const retryDecision = opts?.shouldRetryError ? opts.shouldRetryError(error, attempt) : defaultTransient;
        const retry = !isAbortLikeError(error) && !!retryDecision;
        return { value: { data: data as T, error: error as EdgeFunctionError }, retry };
      }
      return { value: { data: data as T, error: null }, retry: false };
    },
    effectiveOpts,
  );
}

export class EdgeClient {
  private static config: Required<Pick<EdgeClientConfig, "defaultTimeoutMs">> &
    Omit<EdgeClientConfig, "defaultTimeoutMs"> = {
    defaultTimeoutMs: 20_000,
  };

  private static globalMiddleware: EdgeMiddleware[] = [];

  static configure(opts: EdgeClientConfig): void {
    if (opts.invoke) {
      this.config.invoke = opts.invoke;
    }
    if (typeof opts.defaultTimeoutMs === "number") {
      this.config.defaultTimeoutMs = Math.max(0, opts.defaultTimeoutMs);
    }
    if (opts.authProvider) {
      this.config.authProvider = opts.authProvider;
    }
    if (opts.logger) {
      this.config.logger = opts.logger;
    }
  }

  static use(middleware: EdgeMiddleware): void {
    this.globalMiddleware.push(middleware);
  }

  private static getInvoke(): SupabaseFunctionInvoke {
    return (
      this.config.invoke ??
      (supabase.functions.invoke.bind(supabase.functions) as unknown as SupabaseFunctionInvoke)
    );
  }

  private static async getAutoAccessToken(): Promise<string | null> {
    if (this.config.authProvider) {
      return await this.config.authProvider.getAccessToken();
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    return token && token.trim() ? token : null;
  }

  private static async refreshAutoAuth(): Promise<void> {
    if (this.config.authProvider?.refresh) {
      await this.config.authProvider.refresh();
      return;
    }
    try {
      await supabase.auth.refreshSession();
    } catch {
      void 0;
    }
  }

  static async invoke<T>(fnName: string, body?: unknown, opts?: EdgeInvokeOptions): Promise<T> {
    return await this.invokeInternal<T>(this.getInvoke(), fnName, body, { ...opts, maxRetries: 0 });
  }

  static async invokeWithRetry<T>(fnName: string, body?: unknown, opts?: EdgeInvokeOptions): Promise<T> {
    const effective: EdgeInvokeOptions = {
      maxRetries: 2,
      retryDelayMs: 500,
      backoff: "linear",
      ...opts,
    };
    return await this.invokeInternal<T>(this.getInvoke(), fnName, body, effective);
  }

  private readonly invokeFn: SupabaseFunctionInvoke;

  constructor(invoke: SupabaseFunctionInvoke) {
    this.invokeFn = invoke;
  }

  async invoke<T>(fnName: string, body?: unknown, opts?: EdgeInvokeOptions): Promise<T> {
    return await EdgeClient.invokeInternal<T>(this.invokeFn, fnName, body, { ...opts, maxRetries: 0 });
  }

  async invokeWithRetry<T>(fnName: string, body?: unknown, opts?: EdgeInvokeOptions): Promise<T> {
    const effective: EdgeInvokeOptions = {
      maxRetries: 2,
      retryDelayMs: 500,
      backoff: "linear",
      ...opts,
    };
    return await EdgeClient.invokeInternal<T>(this.invokeFn, fnName, body, effective);
  }

  async invokeJson<T>(
    fnName: string,
    init: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal },
    opts?: RetryOptions,
  ): Promise<T> {
    return await EdgeClient.invokeJsonInternal<T>(this.invokeFn, fnName, init.body, {
      ...opts,
      headers: init.headers,
      signal: init.signal ?? opts?.signal,
      auth: { type: "none" },
    });
  }

  private static async invokeInternal<T>(
    invoke: SupabaseFunctionInvoke,
    fnName: string,
    body?: unknown,
    opts?: EdgeInvokeOptions,
  ): Promise<T> {
    return await this.invokeJsonInternal<T>(invoke, fnName, body, opts);
  }

  private static async invokeJsonInternal<T>(
    invoke: SupabaseFunctionInvoke,
    fnName: string,
    body?: unknown,
    opts?: EdgeInvokeOptions,
  ): Promise<T> {
    const trimmedName = String(fnName || "").trim();
    if (!trimmedName) {
      throw new ValidationError("edge_invalid_function", "Edge function name is required", {
        context: { edgeFunction: fnName } satisfies AppErrorContext,
      });
    }

    const {
      headers,
      auth,
      middleware,
      log,
      maxRetries,
      timeoutMs,
      retryDelayMs,
      backoff,
      signal,
      shouldRetryError,
      onRetry,
    } = opts ?? {};

    const effectiveAuth: EdgeAuth = auth ?? { type: "auto" };
    const baseHeaders: Record<string, string> = { ...(headers ?? {}) };
    const applyAuthHeader = async (): Promise<void> => {
      if (baseHeaders.Authorization) return;
      if (effectiveAuth.type === "none") return;
      if (effectiveAuth.type === "bearer") {
        baseHeaders.Authorization = `Bearer ${effectiveAuth.token}`;
        return;
      }
      if (effectiveAuth.type === "authorization") {
        baseHeaders.Authorization = effectiveAuth.value;
        return;
      }
      const token = await this.getAutoAccessToken();
      if (!token) {
        throw new AuthError("missing_access_token", "Missing access token", {
          status: 401,
          context: { edgeFunction: trimmedName } satisfies AppErrorContext,
        });
      }
      baseHeaders.Authorization = `Bearer ${token}`;
    };

    const effectiveRetryOpts: RetryOptions = {
      maxRetries: Math.max(0, maxRetries ?? 0),
      timeoutMs: Math.max(0, timeoutMs ?? this.config.defaultTimeoutMs),
      retryDelayMs,
      backoff,
      signal,
      shouldRetryError: (error, attempt) => {
        if (shouldRetryError) return shouldRetryError(error, attempt);
        const mapped = mapError(error, {
          code: "edge_invoke_failed",
          context: { edgeFunction: trimmedName } satisfies AppErrorContext,
        });
        return mapped.status === 0 || mapped.status >= 500;
      },
      onRetry: (attempt, errorOrValue) => {
        try {
          if (this.config.logger !== undefined && (log ?? true)) {
            const status =
              (errorOrValue as { error?: EdgeFunctionError | null } | null)?.error?.context?.status ??
              (errorOrValue as { status?: number } | null)?.status;
            this.config.logger({ type: "edge_retry", edgeFunction: trimmedName, attempt, status });
          }
        } catch {
          void 0;
        }
        onRetry?.(attempt, errorOrValue);
      },
    };

    const start = Date.now();
    const runOnce = async (): Promise<T> => {
      await applyAuthHeader();

      let ctx: EdgeMiddlewareContext = {
        fnName: trimmedName,
        init: { body, headers: baseHeaders, signal },
        opts: effectiveRetryOpts,
        auth: effectiveAuth,
      };

      for (const mw of this.globalMiddleware) {
        ctx = await mw(ctx);
      }
      for (const mw of middleware ?? []) {
        ctx = await mw(ctx);
      }

      const { data, error } = await invokeSupabaseFunctionWithRetry<T | string>(
        invoke,
        ctx.fnName,
        { body: ctx.init.body, headers: ctx.init.headers, signal: ctx.init.signal },
        ctx.opts,
      );

      if (error) {
        throw mapError(error, { code: "edge_invoke_failed", context: { edgeFunction: ctx.fnName } satisfies AppErrorContext });
      }

      if (typeof data === "string") {
        try {
          return JSON.parse(data) as T;
        } catch (e) {
          throw mapError(e, { code: "edge_invalid_json", status: 500, context: { edgeFunction: ctx.fnName } satisfies AppErrorContext });
        }
      }

      return data as T;
    };

    try {
      try {
        const out = await runOnce();
        const durationMs = Date.now() - start;
        try {
          if (this.config.logger !== undefined && (log ?? true)) {
            this.config.logger({ type: "edge_invoke", edgeFunction: trimmedName, durationMs, ok: true });
          }
        } catch {
          void 0;
        }
        return out;
      } catch (e) {
        const mapped = mapError(e, { code: "edge_invoke_failed", context: { edgeFunction: trimmedName } satisfies AppErrorContext });
        if (mapped.status === 401 && effectiveAuth.type === "auto") {
          await this.refreshAutoAuth();
          const out = await runOnce();
          const durationMs = Date.now() - start;
          try {
            if (this.config.logger !== undefined && (log ?? true)) {
              this.config.logger({ type: "edge_invoke", edgeFunction: trimmedName, durationMs, ok: true });
            }
          } catch {
            void 0;
          }
          return out;
        }
        throw mapped;
      }
    } catch (e) {
      const mapped = mapError(e, { code: "edge_invoke_failed", context: { edgeFunction: trimmedName } satisfies AppErrorContext });
      const durationMs = Date.now() - start;
      try {
        if (this.config.logger !== undefined && (log ?? true)) {
          this.config.logger({
            type: "edge_invoke",
            edgeFunction: trimmedName,
            durationMs,
            ok: false,
            status: mapped.status,
          });
        }
      } catch {
        void 0;
      }
      throw mapped;
    }
  }
}
