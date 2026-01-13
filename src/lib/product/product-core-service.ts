import { invokeEdgeWithAuth, SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import type { CreateProductData, Product, ProductImage, UpdateProductData } from "@/lib/product-service";
import { ProductImageService } from "@/lib/product/product-image-service";

export class ProductCoreService {
  private static castNullableNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

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
      ProductCoreService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  private static async ensureCanMutateProducts(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  private static async getUserStores(): Promise<
    Array<{
      id: string;
      store_name: string;
      store_url: string | null;
      is_active: boolean;
      productsCount: number;
      categoriesCount: number;
    }>
  > {
    try {
      const { UserAuthService } = await import("@/lib/user-auth-service");
      const authMe = await UserAuthService.fetchAuthMe();
      if (Array.isArray((authMe as any)?.userStores)) {
        return (authMe.userStores || []).map((s: any) => ({
          id: String(s.id),
          store_name: String(s.store_name || ""),
          store_url: null,
          is_active: true,
          productsCount: 0,
          categoriesCount: 0,
        }));
      }
    } catch {
      void 0;
    }

    const { ShopService } = await import("@/lib/shop-service");
    const shops = await ShopService.getShopsAggregated();
    return (shops || []).map((s) => ({
      id: String(s.id),
      store_name: String(s.store_name || ""),
      store_url: s.store_url ? String(s.store_url) : null,
      is_active: !!s.is_active,
      productsCount: Number(s.productsCount ?? 0),
      categoriesCount: Number(s.categoriesCount ?? 0),
    }));
  }

  private static async getUserStoreIds(): Promise<string[]> {
    const stores = await ProductCoreService.getUserStores();
    return stores.filter((s) => s.is_active).map((s) => s.id);
  }

  static async getProductById(id: string): Promise<Product | null> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }

    const { ProductService } = await import("@/lib/product-service");
    const edit = await ProductService.getProductEditData(id);
    return edit.product || null;
  }

  static async getProduct(id: string): Promise<Product> {
    const product = await ProductCoreService.getProductById(id);
    if (!product) throw new Error("Товар не найден");
    return product;
  }

  static async createProduct(productData: CreateProductData): Promise<Product> {
    let effectiveStoreId = productData.store_id;
    const allowedStoreIds = await ProductCoreService.getUserStoreIds();
    if (!effectiveStoreId || effectiveStoreId.trim() === "") {
      effectiveStoreId = allowedStoreIds[0];
      if (!effectiveStoreId) {
        throw new Error("Активний магазин не знайдено");
      }
    } else if (!allowedStoreIds.includes(String(effectiveStoreId))) {
      throw new Error("Store access denied");
    }

    const currencyCode =
      (productData.currency_code && String(productData.currency_code).trim()) || "UAH";

    const payload: Record<string, unknown> = {
      store_id: effectiveStoreId,
      supplier_id: ProductCoreService.castNullableNumber(productData.supplier_id),
      category_id: ProductCoreService.castNullableNumber(productData.category_id),
      category_external_id: productData.category_external_id ?? null,
      currency_code: currencyCode,
      external_id: productData.external_id ?? null,
      name: productData.name,
      name_ua: productData.name_ua ?? null,
      vendor: productData.vendor ?? null,
      article: productData.article ?? null,
      available: productData.available !== undefined ? productData.available : true,
      stock_quantity: productData.stock_quantity ?? 0,
      price: productData.price ?? null,
      price_old: productData.price_old ?? null,
      price_promo: productData.price_promo ?? null,
      description: productData.description ?? null,
      description_ua: productData.description_ua ?? null,
      docket: productData.docket ?? null,
      docket_ua: productData.docket_ua ?? null,
      state: productData.state ?? "new",
      images: ProductImageService.mapImagesForEdge((productData.images || []) as any),
      params: (productData.params || []).map((p, index) => ({
        name: p.name,
        value: p.value,
        order_index: typeof p.order_index === "number" ? p.order_index : index,
        paramid: p.paramid ?? null,
        valueid: p.valueid ?? null,
      })),
      links: productData.links || undefined,
    };

    const respCreate = await ProductCoreService.invokeEdge<{ product_id?: string }>(
      "create-product",
      payload,
    );
    const productId = respCreate?.product_id;
    if (!productId) throw new Error("create_failed");
    const product = await ProductCoreService.getProductById(productId);
    if (!product) throw new Error("create_failed");

    const { processed, changed } = await ProductImageService.uploadMissingObjectKeysFromUrls(
      String(productId),
      (productData.images || []) as any,
    );
    if (changed) {
      await ProductCoreService.updateProduct(String(productId), { images: processed as unknown as ProductImage[] });
    }

    return product;
  }

  static async updateProduct(id: string, productData: UpdateProductData): Promise<string> {
    await ProductCoreService.ensureCanMutateProducts();

    const categoryIdValue: number | null | undefined =
      productData.category_id !== undefined
        ? ProductCoreService.castNullableNumber(productData.category_id)
        : undefined;

    const payload: Record<string, unknown> = {
      product_id: id,
      supplier_id:
        productData.supplier_id !== undefined
          ? ProductCoreService.castNullableNumber(productData.supplier_id)
          : undefined,
      category_id: productData.category_id !== undefined ? categoryIdValue : undefined,
      category_external_id:
        productData.category_external_id !== undefined ? productData.category_external_id : undefined,
      currency_code: productData.currency_code !== undefined ? productData.currency_code : undefined,
      external_id: productData.external_id !== undefined ? productData.external_id : undefined,
      name: productData.name !== undefined ? productData.name : undefined,
      name_ua: productData.name_ua !== undefined ? productData.name_ua : undefined,
      vendor: productData.vendor !== undefined ? productData.vendor : undefined,
      article: productData.article !== undefined ? productData.article : undefined,
      available: productData.available !== undefined ? productData.available : undefined,
      stock_quantity: productData.stock_quantity !== undefined ? productData.stock_quantity : undefined,
      price: productData.price !== undefined ? productData.price : undefined,
      price_old: productData.price_old !== undefined ? productData.price_old : undefined,
      price_promo: productData.price_promo !== undefined ? productData.price_promo : undefined,
      description: productData.description !== undefined ? productData.description : undefined,
      description_ua: productData.description_ua !== undefined ? productData.description_ua : undefined,
      docket: productData.docket !== undefined ? productData.docket : undefined,
      docket_ua: productData.docket_ua !== undefined ? productData.docket_ua : undefined,
      state: productData.state !== undefined ? productData.state : undefined,
      images:
        productData.images !== undefined
          ? ProductImageService.mapImagesForEdge((productData.images || []) as any)
          : undefined,
      params:
        productData.params !== undefined
          ? (productData.params || []).map((p, index) => ({
              name: p.name,
              value: p.value,
              order_index: typeof p.order_index === "number" ? p.order_index : index,
              paramid: p.paramid ?? null,
              valueid: p.valueid ?? null,
            }))
          : undefined,
    };

    const respUpdate = await ProductCoreService.invokeEdge<{ product_id?: string }>(
      "update-product",
      payload,
    );
    const productId = respUpdate?.product_id || id;
    return String(productId);
  }

  static async deleteProduct(id: string): Promise<void> {
    await ProductCoreService.ensureCanMutateProducts();
    const respDel = await ProductCoreService.invokeEdge<{ success?: boolean }>(
      "delete-product",
      { product_ids: [String(id)] },
    );
    const ok = respDel?.success === true;
    if (!ok) throw new Error("delete_failed");
  }

  static async bulkDeleteProducts(ids: string[]): Promise<{ deleted: number }> {
    await ProductCoreService.ensureCanMutateProducts();
    const validIds = Array.from(new Set(ids.map(String).filter(Boolean)));
    if (validIds.length === 0) return { deleted: 0 };
    const respDel2 = await ProductCoreService.invokeEdge<{ success?: boolean }>(
      "delete-product",
      { product_ids: validIds },
    );
    const ok = respDel2?.success === true;
    if (!ok) throw new Error("delete_failed");
    return { deleted: validIds.length };
  }

  static async duplicateProduct(id: string): Promise<Product> {
    const respDup = await ProductCoreService.invokeEdge<{ product?: Product }>(
      "duplicate-product",
      { productId: id },
    );
    const product = respDup?.product as Product | undefined;
    if (!product) throw new Error("duplicate_failed");
    return product;
  }

}
