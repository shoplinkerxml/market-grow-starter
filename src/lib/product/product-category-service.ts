import { invokeEdgeWithAuth, SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import { RequestDeduplicatorFactory } from "@/lib/request-deduplicator";

export class ProductCategoryService {
  private static recomputeDeduplicator = RequestDeduplicatorFactory.create<void>("product-category-service:recompute", {
    ttl: 30_000,
    maxSize: 50,
    enableMetrics: true,
    errorStrategy: "remove",
  });

  private static edgeError(
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

  private static async invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
    try {
      return await invokeEdgeWithAuth<T>(name, body);
    } catch (error) {
      ProductCategoryService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  private static async ensureValidSession(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  static async recomputeStoreCategoryFilterCache(storeId: string): Promise<void> {
    try {
      await ProductCategoryService.getStoreCategoryFilterOptions(storeId);
    } catch (error) {
      console.error("ProductCategoryService.recomputeStoreCategoryFilterCache failed", error);
    }
  }

  static async recomputeStoreCategoryFilterCacheBatch(storeIds: string[]): Promise<void> {
    const unique = Array.from(new Set((storeIds || []).map(String).filter(Boolean)));
    const tasks = unique.map((sid) =>
      ProductCategoryService.recomputeDeduplicator.dedupe(sid, () => ProductCategoryService.recomputeStoreCategoryFilterCache(sid)),
    );
    await Promise.all(tasks);
  }

  static async getStoreCategoryFilterOptions(storeId: string): Promise<string[]> {
    await ProductCategoryService.ensureValidSession();
    const resp = await ProductCategoryService.invokeEdge<{ names?: string[] }>("store-category-filter-options", {
      store_id: storeId,
    });
    const names = (resp?.names || []).filter((v) => typeof v === "string");
    return names;
  }

  static async refreshStoreCategoryFilterOptions(storeIds: string[]): Promise<Record<string, string[]>> {
    await ProductCategoryService.ensureValidSession();
    const unique = Array.from(new Set((storeIds || []).map(String).filter(Boolean)));
    if (unique.length === 0) return {};
    const resp = await ProductCategoryService.invokeEdge<{ results?: Record<string, string[]>; names?: string[] }>(
      "store-category-filter-options",
      { store_ids: unique },
    );
    const results: Record<string, string[]> = resp?.results || {};
    return results;
  }
}
