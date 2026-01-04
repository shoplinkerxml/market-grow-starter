import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "./user-service";
import { invokeEdgeWithAuth, SessionValidator } from "./session-validation";
import { SubscriptionValidationService } from "./subscription-validation-service";
import { CategoryService } from "@/lib/category-service";
import { ProductCoreService } from "@/lib/product/product-core-service";
import { ProductLinkService } from "@/lib/product/product-link-service";
import { ProductImageService } from "@/lib/product/product-image-service";
import { ProductCategoryService } from "@/lib/product/product-category-service";
import { ProductLimitService } from "@/lib/product/product-limit-service";
import { ProductCacheManager } from "@/lib/product/product-cache-manager";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

export interface Product {
  id: string;
  store_id: string;
  supplier_id?: number | null;
  external_id: string;
  name: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | null;
  category_external_id?: string | null;
  currency_id?: string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity: number;
  available: boolean;
  state: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

export interface ProductParam {
  id?: string;
  product_id?: string;
  name: string;
  value: string;
  order_index: number;
  paramid?: string;
  valueid?: string;
}

export interface ProductImage {
  id?: string;
  product_id?: string;
  url: string;
  order_index: number;
  is_main?: boolean;
  alt_text?: string;
}

export interface ProductAggregated extends Product {
  mainImageUrl?: string;
  categoryName?: string;
  supplierName?: string;
  linkedStoreIds?: string[];
}

export interface CreateProductData {
  store_id?: string;
  external_id: string;
  name: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | string | null;
  category_external_id?: string | null;
  supplier_id?: number | string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity?: number;
  available?: boolean;
  state?: string;
  params?: ProductParam[];
  images?: ProductImage[];
  links?: Array<{
    store_id: string;
    is_active?: boolean;
    custom_price?: number | null;
    custom_price_promo?: number | null;
    custom_stock_quantity?: number | null;
    custom_available?: boolean | null;
    custom_name?: string | null;
    custom_description?: string | null;
    custom_category_id?: number | null;
  }>;
}

export interface UpdateProductData {
  store_id?: string;
  external_id?: string;
  name?: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | string | null;
  category_external_id?: string | null;
  supplier_id?: number | string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity?: number;
  available?: boolean;
  state?: string;
  params?: ProductParam[];
  images?: ProductImage[];
}

export interface ProductLimitInfo {
  current: number;
  max: number;
  canCreate: boolean;
}

type ProductListPage = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  total: number;
};

type ProductListResponseObj = {
  products?: ProductAggregated[];
  page?: ProductListPage;
};

export interface StoreProductLink {
  is_active?: boolean;
  custom_price?: number | null;
  custom_price_old?: number | null;
  custom_price_promo?: number | null;
  custom_stock_quantity?: number | null;
  custom_available?: boolean | null;
  custom_name?: string | null;
  custom_description?: string | null;
  custom_category_id?: string | null;
}

export type StoreProductLinkPatchInput = Partial<StoreProductLink>;

export class ProductService {
  private static userStoresDeduplicator = RequestDeduplicatorFactory.create<
    Array<{
      id: string;
      store_name: string;
      store_url: string | null;
      is_active: boolean;
      productsCount: number;
      categoriesCount: number;
    }>
  >("product-service:userStores", {
    ttl: 30_000,
    maxSize: 20,
    enableMetrics: true,
    errorStrategy: "remove",
  });

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
      ProductService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  static async getUserLookups(): Promise<{
    suppliers: Array<{ id: string; supplier_name: string }>;
    currencies: Array<{ id: number; name: string; code: string; status: boolean }>;
    supplierCategoriesMap: Record<
      string,
      Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>
    >;
  }> {
    const resp = await ProductService.invokeEdge<{
      suppliers?: any[];
      currencies?: any[];
      supplierCategoriesMap?: Record<string, any[]>;
    }>("get-user-lookups", {});
    const result = {
      suppliers: Array.isArray(resp.suppliers) ? resp.suppliers : [],
      currencies: Array.isArray(resp.currencies) ? resp.currencies : [],
      supplierCategoriesMap: resp.supplierCategoriesMap || {},
    };
    return result;
  }

  /** Получение store_ids текущего пользователя (через функции) */
  private static async getUserStoreIds(): Promise<string[]> {
    const stores = await ProductService.getUserStores();
    return stores.filter((s) => s.is_active).map((s) => s.id);
  }

  /** Получение полной информации о магазинах пользователя (только функции + кэш) */
  static async getUserStores(): Promise<
    Array<{
      id: string;
      store_name: string;
      store_url: string | null;
      is_active: boolean;
      productsCount: number;
      categoriesCount: number;
    }>
  > {
    const uid = await SessionValidator.validateSession()
      .then((v) => (v?.user?.id ? String(v.user.id) : "current"))
      .catch(() => "current");
    const inflightKey = `userStores:${uid}`;
    return await ProductService.userStoresDeduplicator.dedupe(inflightKey, async () => {
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
      const mapped = (shops || []).map((s) => ({
        id: String(s.id),
        store_name: String(s.store_name || ""),
        store_url: s.store_url ? String(s.store_url) : null,
        is_active: !!s.is_active,
        productsCount: Number(s.productsCount ?? 0),
        categoriesCount: Number(s.categoriesCount ?? 0),
      }));
      return mapped;
    });
  }

  static async getUserMasterProducts(): Promise<ProductAggregated[]> {
    try {
      const resp = await ProductService.invokeEdge<ProductListResponseObj>("user-products-list", {});
      const rows = Array.isArray(resp?.products) ? resp.products! : [];
      return rows;
    } catch {
      const fb = await ProductService.fetchProductsPageFallback(null, 50, 0);
      return fb.products;
    }
  }

  static async getStoreProducts(storeId: string): Promise<ProductAggregated[]> {
    if (!storeId || storeId.trim() === "") {
      throw new Error("Store ID is required");
    }
    try {
      const resp = await ProductService.invokeEdge<ProductListResponseObj>("store-products-list", {
        store_id: String(storeId),
      });
      const rows = Array.isArray(resp?.products) ? resp.products! : [];
      return rows;
    } catch {
      const fb = await ProductService.fetchProductsPageFallback(String(storeId), 50, 0);
      return fb.products;
    }
  }

  static async getUserMasterProductsPage(
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    try {
      const fresh = await ProductService.invokeEdge<ProductListResponseObj>("user-products-list", {
        limit,
        offset: 0,
        bypassCache: options?.bypassCache === true,
      });
      const products = Array.isArray(fresh?.products) ? fresh.products! : [];
      const page: ProductListPage = {
        limit,
        offset: 0,
        hasMore: !!fresh?.page?.hasMore,
        nextOffset: fresh?.page?.nextOffset ?? null,
        total: fresh?.page?.total ?? products.length,
      };
      return { products, page };
    } catch (error) {
      const fb = await ProductService.fetchProductsPageFallback(null, limit, 0);
      return fb;
    }
  }

  static async getStoreProductsPage(
    storeId: string,
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    if (!storeId || storeId.trim() === "") {
      throw new Error("Store ID is required");
    }

    try {
      const fresh = await ProductService.invokeEdge<ProductListResponseObj>("store-products-list", {
        store_id: String(storeId),
        limit,
        offset: 0,
        bypassCache: options?.bypassCache === true,
      });
      const products = Array.isArray(fresh?.products) ? fresh.products! : [];
      const page: ProductListPage = {
        limit,
        offset: 0,
        hasMore: !!fresh?.page?.hasMore,
        nextOffset: fresh?.page?.nextOffset ?? null,
        total: fresh?.page?.total ?? products.length,
      };
      return { products, page };
    } catch (error) {
      const fb = await ProductService.fetchProductsPageFallback(String(storeId), limit, 0);
      return fb;
    }
  }

  /**
   * @deprecated Використовуй getStoreProducts(storeId)
   */
  static async getProductsForStore(storeId: string): Promise<Product[]> {
    const productsAgg = await ProductService.getStoreProducts(storeId);
    return productsAgg as unknown as Product[];
  }

  /**
   * @deprecated Використовуй getUserMasterProducts() або getStoreProducts(storeId)
   */
  static async getProductsAggregated(storeId?: string | null): Promise<ProductAggregated[]> {
    if (storeId) {
      return ProductService.getStoreProducts(storeId);
    }
    return ProductService.getUserMasterProducts();
  }

  /**
   * @deprecated Використовуй getUserMasterProductsPage() або getStoreProductsPage()
   */
  static async getProductsFirstPage(
    storeId: string | null,
    limit: number,
    options?: { bypassCache?: boolean },
  ): Promise<{
    products: ProductAggregated[];
    page: ProductListPage;
  }> {
    if (storeId) {
      return ProductService.getStoreProductsPage(storeId, limit, options);
    }
    return ProductService.getUserMasterProductsPage(limit, options);
  }

  private static async fetchProductsPageFallback(
    storeId: string | null,
    limit: number,
    offset: number,
  ): Promise<{ products: ProductAggregated[]; page: ProductListPage }> {
    try {
      const resp = await ProductService.invokeEdge<ProductListResponseObj>(
        storeId ? "store-products-list" : "user-products-list",
        {
          ...(storeId ? { store_id: String(storeId) } : {}),
          limit,
          offset,
          bypassCache: true,
        },
      );
      const products = Array.isArray(resp?.products) ? resp.products : [];
      const page: ProductListPage = {
        limit,
        offset,
        hasMore: !!resp?.page?.hasMore,
        nextOffset: resp?.page?.nextOffset ?? null,
        total: resp?.page?.total ?? products.length,
      };
      return { products, page };
    } catch {
      return { products: [], page: { limit, offset, hasMore: false, nextOffset: null, total: 0 } };
    }
  }

  static async getProductsPage(
    storeId: string | null,
    limit: number,
    offset: number,
  ): Promise<{
    products: ProductAggregated[];
    page: {
      limit: number;
      offset: number;
      hasMore: boolean;
      nextOffset: number | null;
      total: number;
    };
  }> {
    return await ProductCacheManager.getProductsPageCached(storeId, limit, offset, async () => {
      try {
        const resp = await ProductService.invokeEdge<ProductListResponseObj>(storeId ? "store-products-list" : "user-products-list", {
          ...(storeId ? { store_id: storeId } : {}),
          limit,
          offset,
        });
        const products = Array.isArray(resp?.products) ? resp!.products! : [];
        const page: ProductListPage = {
          limit,
          offset,
          hasMore: !!resp?.page?.hasMore,
          nextOffset: resp?.page?.nextOffset ?? null,
          total: resp?.page?.total ?? products.length,
        };
        return { products, page };
      } catch {
        return await ProductService.fetchProductsPageFallback(storeId ?? null, limit, offset);
      }
    });
  }

  static updateFirstPageCaches(
    storeId: string | null,
    mutate: (items: unknown[]) => unknown[],
  ) {
    ProductCacheManager.updateFirstPageCaches(storeId, mutate);
  }

  static patchProductCaches(
    productId: string,
    patch: Partial<ProductAggregated>,
    storeId?: string | null,
  ) {
    ProductCacheManager.patchProductCaches(productId, patch, storeId);
  }

  static async recomputeStoreCategoryFilterCache(storeId: string): Promise<void> {
    await ProductCategoryService.recomputeStoreCategoryFilterCache(storeId);
  }

  static async recomputeStoreCategoryFilterCacheBatch(storeIds: string[]): Promise<void> {
    await ProductCategoryService.recomputeStoreCategoryFilterCacheBatch(storeIds);
  }

  static async getStoreCategoryFilterOptions(storeId: string): Promise<string[]> {
    return await ProductCategoryService.getStoreCategoryFilterOptions(storeId);
  }

  static async refreshStoreCategoryFilterOptions(storeIds: string[]): Promise<Record<string, string[]>> {
    return await ProductCategoryService.refreshStoreCategoryFilterOptions(storeIds);
  }

  /** Получить и обновить переопределения для пары (product_id, store_id) через product-edit-data */
  static async getStoreProductLink(
    productId: string,
    storeId: string,
  ): Promise<StoreProductLink | null> {
    return await ProductLinkService.getStoreProductLink(productId, storeId);
  }

  static async updateStoreProductLink(
    productId: string,
    storeId: string,
    patch: Partial<StoreProductLinkPatchInput>,
  ): Promise<StoreProductLink | null> {
    return await ProductLinkService.updateStoreProductLink(productId, storeId, patch);
  }

  static async saveStoreProductEdit(
    productId: string,
    storeId: string,
    payload: {
      supplier_id?: number | string | null;
      category_id?: number | string | null;
      category_external_id?: string | null;
      currency_code?: string | null;
      external_id?: string | null;
      name?: string;
      name_ua?: string | null;
      vendor?: string | null;
      article?: string | null;
      available?: boolean;
      stock_quantity?: number;
      price?: number | null;
      price_old?: number | null;
      price_promo?: number | null;
      description?: string | null;
      description_ua?: string | null;
      docket?: string | null;
      docket_ua?: string | null;
      state?: string;
      images?: ProductImage[];
      params?: ProductParam[];
      linkPatch?: StoreProductLinkPatchInput;
    },
  ): Promise<{ product_id: string; link?: StoreProductLink | null } | null> {
    const out = await ProductService.invokeEdge<{ product_id?: string; link?: StoreProductLink | null }>(
      "save-store-product-edit",
      { product_id: productId, store_id: storeId, ...payload },
    );
    const pid = out?.product_id ? String(out.product_id) : null;
    if (pid) {
      try {
        const patch: Partial<ProductAggregated> = {};
        if (payload.name !== undefined) patch.name = payload.name as string;
        if (payload.name_ua !== undefined) patch.name_ua = payload.name_ua ?? null;
        if (payload.price !== undefined) patch.price = payload.price ?? null;
        if (payload.price_old !== undefined) patch.price_old = payload.price_old ?? null;
        if (payload.price_promo !== undefined) patch.price_promo = payload.price_promo ?? null;
        if (payload.available !== undefined) patch.available = !!payload.available;
        if (payload.stock_quantity !== undefined) patch.stock_quantity = Number(payload.stock_quantity || 0);
        if (payload.category_id !== undefined) patch.category_id = (payload.category_id as number | null) ?? null;
        if (payload.category_external_id !== undefined) patch.category_external_id = payload.category_external_id ?? null;
        if (Array.isArray(payload.images)) {
          const main = (payload.images || []).find((i) => !!i.is_main) || (payload.images || [])[0];
          if (main?.url) patch.mainImageUrl = String(main.url);
        }
        ProductService.patchProductCaches(pid, patch, storeId);
      } catch (error) {
        console.error("ProductService.saveStoreProductEdit cache update failed", error);
      }
    }
    return pid ? { product_id: pid, link: out.link } : null;
  }

  static async removeStoreProductLink(
    productId: string,
    storeId: string,
  ): Promise<void> {
    await ProductLinkService.removeStoreProductLink(productId, storeId);
    try {
      ProductService.clearStoreProductsCaches(String(storeId));
    } catch (e) {
      console.error("ProductService.removeStoreProductLink clearStoreProductsCaches failed", e);
    }
  }

  static async bulkRemoveStoreProductLinks(
    productIds: string[],
    storeIds: string[],
  ): Promise<{ deleted: number; deletedByStore: Record<string, number>; categoryNamesByStore?: Record<string, string[]> }> {
    return await ProductLinkService.bulkRemoveStoreProductLinks(productIds, storeIds);
  }

  static async bulkAddStoreProductLinks(payload: Array<{
    product_id: string;
    store_id: string;
    is_active?: boolean;
    custom_price?: number | null;
    custom_price_old?: number | null;
    custom_price_promo?: number | null;
    custom_stock_quantity?: number | null;
    custom_available?: boolean | null;
  }>): Promise<{ inserted: number; addedByStore: Record<string, number>; categoryNamesByStore?: Record<string, string[]> }> {
    return await ProductLinkService.bulkAddStoreProductLinks(payload);
  }

  static async getStoreLinksForProduct(productId: string): Promise<string[]> {
    return await ProductLinkService.getStoreLinksForProduct(productId);
  }

  static invalidateStoreLinksCache(productId: string) {
    ProductLinkService.invalidateStoreLinksCache(productId);
  }

  /** Максимальный лимит продуктов: через отдельную функцию get-product-limit-only */
  static async getProductLimitOnly(): Promise<number> {
    return await ProductLimitService.getProductLimitOnly();
  }

  /** Лимит продуктов для текущего пользователя */
  static async getProductLimit(): Promise<ProductLimitInfo> {
    return await ProductLimitService.getProductLimit();
  }

  static invalidateProductLimitCache() {
    ProductLimitService.invalidateProductLimitCache();
  }

  /** Количество продуктов текущего пользователя: только функция user-products-list */
  static async getProductsCount(): Promise<number> {
    return await ProductLimitService.getProductsCount();
  }

  static async getProductsCountCached(): Promise<number> {
    return await ProductLimitService.getProductsCountCached();
  }

  /** Полный список продуктов текущего пользователя (по функциям с пагинацией + кэш) */
  static async getProducts(): Promise<Product[]> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }

    const limit = 50;
    let offset = 0;
    const all: ProductAggregated[] = [];

    while (true) {
      const { products, page } = await ProductService.getProductsPage(null, limit, offset);
      all.push(...products);
      if (!page.hasMore) break;
      if (page.nextOffset == null) break;
      if (page.nextOffset <= offset) break;
      offset = page.nextOffset;
      if (all.length >= 1000) break;
    }

    return all as unknown as Product[];
  }

  /** Параметры товара: через product-edit-data */
  static async getProductParams(productId: string): Promise<ProductParam[]> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }

    try {
      const { data, error } = await supabase
        .from("store_product_params")
        .select("id,name,value,order_index,paramid,valueid")
        .eq("product_id", String(productId))
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []).map((p) => ({
        id: String(p.id),
        product_id: String(productId),
        name: String(p.name || ""),
        value: String(p.value || ""),
        order_index: Number(p.order_index || 0),
        paramid: p.paramid == null ? undefined : String(p.paramid),
        valueid: p.valueid == null ? undefined : String(p.valueid),
      }));
    } catch {
      const edit = await ProductService.getProductEditData(productId);
      return edit.params || [];
    }
  }

  /** Изображения товара: через product-edit-data */
  static async getProductImages(productId: string): Promise<ProductImage[]> {
    return await ProductImageService.getProductImages(productId);
  }

  /** Получение товара по ID: через product-edit-data */
  static async getProductById(id: string): Promise<Product | null> {
    return await ProductCoreService.getProductById(id);
  }

  /** Агрегированная загрузка данных для страницы редактирования товара */
  static async getProductEditData(
    productId: string,
    storeId?: string,
  ): Promise<{
    product: Product | null;
    link: StoreProductLink | null;
    images: ProductImage[];
    params: ProductParam[];
    supplier?: { id: number; supplier_name: string } | null;
    categoryName?: string | null;
    shop?: { id: string; store_name: string } | null;
    storeCategories?: Array<{
      store_category_id: number;
      category_id: number;
      name: string;
      store_external_id: string | null;
      is_active: boolean;
    }>;
    suppliers?: Array<{ id: string; supplier_name: string }>;
    currencies?: Array<{
      id: number;
      name: string;
      code: string;
      status: boolean | null;
    }>;
    categories?: Array<{
      id: string;
      name: string;
      external_id: string;
      supplier_id: string;
      parent_external_id: string | null;
    }>;
    supplierCategoriesMap?: Record<
      string,
      Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>
    >;
  }> {
    if (!String(productId || "").trim()) {
      throw new Error("product_id_required");
    }
    let resp: {
      product?: Product | null;
      link?: StoreProductLink | null;
      images?: ProductImage[];
      params?: ProductParam[];
      supplier?: { id: number; supplier_name: string } | null;
      categoryName?: string | null;
      shop?: { id: string; store_name: string } | null;
      storeCategories?: Array<{
        store_category_id: number;
        category_id: number;
        name: string;
        store_external_id: string | null;
        is_active: boolean;
      }>;
      suppliers?: Array<{ id: string; supplier_name: string }>;
      currencies?: Array<{ id: number; name: string; code: string; status: boolean | null }>;
      categories?: Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>;
      supplierCategoriesMap?: Record<string, Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>>;
    };
    try {
      resp = await invokeEdgeWithAuth(
        "product-edit-data",
        storeId
          ? { product_id: String(productId), store_id: String(storeId) }
          : { product_id: String(productId) },
      );
    } catch (error) {
      this.edgeError(error as any, "failed_load_product_edit");
      throw new ApiError("failed_load_product_edit", 500);
    }
    return {
      product: (resp?.product || null) as Product | null,
      link: (resp?.link || null) as StoreProductLink | null,
      images: (resp?.images || []) as ProductImage[],
      params: (resp?.params || []) as ProductParam[],
      supplier: (resp?.supplier || null) as {
        id: number;
        supplier_name: string;
      } | null,
      categoryName: (resp?.categoryName ?? null) as string | null,
      shop: (resp?.shop ?? null) as { id: string; store_name: string } | null,
      storeCategories: (resp?.storeCategories || []) as Array<{
        store_category_id: number;
        category_id: number;
        name: string;
        store_external_id: string | null;
        is_active: boolean;
      }>,
      suppliers: (resp?.suppliers || []) as Array<{
        id: string;
        supplier_name: string;
      }>,
      currencies: (resp?.currencies || []) as Array<{
        id: number;
        name: string;
        code: string;
        status: boolean | null;
      }>,
      categories: (resp?.categories || []) as Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>,
      supplierCategoriesMap: (resp?.supplierCategoriesMap ||
        {}) as Record<
        string,
        Array<{
          id: string;
          name: string;
          external_id: string;
          supplier_id: string;
          parent_external_id: string | null;
        }>
      >,
    };
  }

  /** Один продукт по ID */
  static async getProduct(id: string): Promise<Product> {
    return await ProductCoreService.getProduct(id);
  }

  /** Создание нового продукта (через функцию create-product) */
  static async createProduct(productData: CreateProductData): Promise<Product> {
    const product = await ProductCoreService.createProduct(productData);
    try {
      ProductService.clearMasterProductsCaches();
      if (productData.links) {
        for (const link of productData.links) {
          if (link.store_id) {
            ProductService.clearStoreProductsCaches(String(link.store_id));
          }
        }
      }
    } catch (error) {
      console.error("ProductService.createProduct clear caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
    return product;
  }

  static async duplicateProduct(id: string): Promise<Product> {
    const product = await ProductCoreService.duplicateProduct(id);
    try {
      ProductService.clearAllFirstPageCaches();
    } catch (error) {
      console.error("ProductService.duplicateProduct clearAllFirstPageCaches failed", error);
    }
    return product;
  }

  /** Обновление товара через функцию update-product */
  static async updateProduct(id: string, productData: UpdateProductData): Promise<void> {
    const productId = await ProductCoreService.updateProduct(id, productData);
    void productId;
    return;
  }

  /** Удаление товара */
  static async deleteProduct(id: string): Promise<void> {
    await ProductCoreService.deleteProduct(id);
    try {
      ProductService.clearMasterProductsCaches();
      ProductService.clearAllProductsCaches();
    } catch (error) {
      console.error("ProductService.deleteProduct clear caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
  }

  static async bulkDeleteProducts(ids: string[]): Promise<{ deleted: number }> {
    const out = await ProductCoreService.bulkDeleteProducts(ids);
    try {
      ProductService.clearMasterProductsCaches();
      ProductService.clearAllProductsCaches();
    } catch (error) {
      console.error("ProductService.bulkDeleteProducts clear caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
    return out;
  }

  static clearAllFirstPageCaches() {
    ProductCacheManager.clearAllFirstPageCaches();
  }

  static clearMasterProductsCaches(): void {
    ProductCacheManager.clearMasterProductsCaches();
  }

  static clearStoreProductsCaches(storeId: string): void {
    ProductCacheManager.clearStoreProductsCaches(storeId);
  }

  static clearAllProductsCaches(): void {
    ProductCacheManager.clearAllProductsCaches();
  }

  /** Проверка только валидности сессии (без дополнительных запросов) */
  private static async ensureCanMutateProducts(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  /** Проверка права на создание (сессия + актуальная подписка) */
  private static async ensureCanCreateProduct(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid || !sessionValidation.user?.id) {
      throw new Error("Invalid session");
    }
    const subscription = await SubscriptionValidationService.getValidSubscription(sessionValidation.user.id);
    if (!subscription) throw new Error("No valid subscription");
  }

  /** Батчевое обновление/вставка товаров напрямую через upsert */
  static async bulkUpsertProducts(rows: Array<UpdateProductData & { id: string; store_id?: string }>): Promise<{ upserted: number }>{
    const out = await ProductCoreService.bulkUpsertProducts(rows);
    try {
      ProductService.clearAllProductsCaches();
    } catch (e) {
      console.error("ProductService.bulkUpsertProducts clearAllProductsCaches failed", e);
    }
    ProductService.invalidateProductLimitCache();
    return out;
  }
  /** Агрегированные справочники для страницы создания товара */
  static async getNewProductLookup(): Promise<{
    suppliers: Array<{ id: string; supplier_name: string }>;
    currencies: Array<{ id: number; name: string; code: string; status: boolean | null }>;
    supplierCategoriesMap: Record<string, Array<{
      id: string;
      name: string;
      external_id: string;
      supplier_id: string;
      parent_external_id: string | null;
    }>>;
  }> {
    const resp = await ProductService.invokeEdge<{
      suppliers?: Array<{ id: string; supplier_name: string }>;
      currencies?: Array<{ id: number; name: string; code: string; status: boolean | null }>;
      supplierCategoriesMap?: Record<string, Array<{
        id: string;
        name: string;
        external_id: string;
        supplier_id: string;
        parent_external_id: string | null;
      }>>;
    }>("new-product-lookup", {});
    return {
      suppliers: Array.isArray(resp.suppliers) ? resp.suppliers : [],
      currencies: Array.isArray(resp.currencies) ? resp.currencies : [],
      supplierCategoriesMap: resp.supplierCategoriesMap || {},
    };
  }
}
