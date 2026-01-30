export function toDbError(error: unknown, fallback: string, context?: Record<string, unknown>): Error {
  if (!error) {
    const e = new Error(fallback);
    if (context) (e as any).context = context;
    console.error("[CategoryTemplateService]", { message: e.message, context });
    return e;
  }
  if (error instanceof Error) {
    if (context) (error as any).context = context;
    console.error("[CategoryTemplateService]", { message: error.message, context, error });
    return error;
  }
  if (typeof error === "string") {
    const e = new Error(error);
    if (context) (e as any).context = context;
    console.error("[CategoryTemplateService]", { message: e.message, context, error });
    return e;
  }
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  const normalized = Object.assign(new Error(e?.message || fallback), {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  });
  if (context) (normalized as any).context = context;
  console.error("[CategoryTemplateService]", { message: normalized.message, context, error });
  return normalized;
}
