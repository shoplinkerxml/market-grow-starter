import { invokeEdgeWithAuth, SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import type { ProductLimitInfo } from "@/lib/product-service";

export class ProductLimitService {
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
      ProductLimitService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  private static async ensureValidSession(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  static async getProductLimitOnly(): Promise<number> {
    await ProductLimitService.ensureValidSession();
    try {
      const resp = await ProductLimitService.invokeEdge<{ value?: number }>("get-product-limit-only", {});
      const v = Number(resp?.value ?? 0) || 0;
      return v;
    } catch {
      return 0;
    }
  }

  static async getProductLimit(): Promise<ProductLimitInfo> {
    const maxProducts = await ProductLimitService.getProductLimitOnly();
    const currentCount = await ProductLimitService.getProductsCount();
    return { current: currentCount, max: maxProducts, canCreate: currentCount < maxProducts };
  }

  static invalidateProductLimitCache() {
    void 0;
  }

  static async getProductsCount(): Promise<number> {
    try {
      await ProductLimitService.ensureValidSession();
      const resp = await ProductLimitService.invokeEdge<{
        products?: unknown[];
        page?: { total?: number };
      }>("user-products-list", { store_id: null, limit: 1, offset: 0 });
      const totalFromPage = resp?.page?.total;
      const total =
        typeof totalFromPage === "number"
          ? totalFromPage
          : Array.isArray(resp?.products)
          ? resp.products.length
          : 0;
      return total || 0;
    } catch (error) {
      console.error("Get products count error:", error);
      return 0;
    }
  }

  static async getProductsCountCached(): Promise<number> {
    return await ProductLimitService.getProductsCount();
  }
}

