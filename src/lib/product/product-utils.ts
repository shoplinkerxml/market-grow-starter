import { ApiError } from "@/lib/user-service";
import { EdgeClient } from "@/lib/request-handler";

export function castNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function edgeError(
  error: { context?: { status?: number }; status?: number; statusCode?: number; message?: string } | null,
  fallbackKey: string,
): never {
  const status = (error?.context?.status ?? error?.status ?? error?.statusCode) as number | undefined;
  const message = (error?.message as string | undefined) || undefined;
  if (status === 403) throw new ApiError("permission_denied", 403, "PERMISSION_DENIED");
  if (status === 400) throw new ApiError("products_limit_reached", 400, "LIMIT_REACHED");
  if (status === 422) throw new ApiError("validation_error", 422, "VALIDATION_ERROR");
  throw new ApiError(message || fallbackKey, status || 500);
}

export async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  try {
    return await EdgeClient.invokeWithRetry<T>(name, body);
  } catch (error) {
    edgeError(error as any, name);
    throw new ApiError(name, 500);
  }
}
