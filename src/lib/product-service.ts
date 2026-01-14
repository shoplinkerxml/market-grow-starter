import { ApiError } from "./user-service";
import { SessionValidator } from "./session-validation";
import { ProductCoreService } from "@/lib/product/product-core-service";
import { ProductLinkService } from "@/lib/product/product-link-service";
import { ProductImageService } from "@/lib/product/product-image-service";
import { ProductCategoryService } from "@/lib/product/product-category-service";
import { ProductLimitService } from "@/lib/product/product-limit-service";

// New services
import { ProductAggregatorService } from "@/lib/product/product-aggregator-service";
import { ProductParamsService } from "@/lib/product/product-params-service";
import { ProductStoreService } from "@/lib/product/product-store-service";
import { ProductListService } from "@/lib/product/product-list-service";
import { invokeEdge } from "@/lib/product/product-utils";

// Re-export types
import * as Types from "@/lib/product/types";

export type Product = Types.Product;
export type ProductParam = Types.ProductParam;
export type ProductImage = Types.ProductImage;
export type ProductAggregated = Types.ProductAggregated;
export type CreateProductData = Types.CreateProductData;
export type UpdateProductData = Types.UpdateProductData;
export type ProductLimitInfo = Types.ProductLimitInfo;
export type ProductListPage = Types.ProductListPage;
export type ProductListResponseObj = Types.ProductListResponseObj;
export type StoreProductLink = Types.StoreProductLink;
export type StoreProductLinkPatchInput = Types.StoreProductLinkPatchInput;

export class ProductService {
  
  private static async invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
    return await invokeEdge<T>(name, body);
  }

  private static async invalidateRelatedAfterProductMutation(): Promise<void> {
    console.info("[ProductService] invalidate_related_after_product_mutation");
    try {
      const { UserAuthService } = await import("@/lib/user-auth-service");
      UserAuthService.clearAuthMeCache();
    } catch {
      void 0;
    }

    try {
      const { ShopService } = await import("@/lib/shop-service");
      ShopService.clearAllCaches();
    } catch {
      void 0;
    }

    try {
      const { PersistentCacheService } = await import("@/lib/persistent-cache-service");
      PersistentCacheService.invalidateShops();
    } catch {
      void 0;
    }

    try {
      const { invalidateCategoriesCache } = await import("@/lib/category-service");
      invalidateCategoriesCache();
    } catch {
      void 0;
    }
  }

  static async getUserLookups() {
    return await ProductAggregatorService.getUserLookups();
  }

  /** Получение store_ids текущего пользователя (через функции) */
  private static async getUserStoreIds(): Promise<string[]> {
    return await ProductStoreService.getUserStoreIds();
  }

  /** Получение полной информации о магазинах пользователя (только функции + кэш) */
  static async getUserStores() {
    return await ProductStoreService.getUserStores();
  }

  static async getUserMasterProducts(): Promise<Types.ProductAggregated[]> {
    return await ProductListService.getUserMasterProducts();
  }

  static async getStoreProducts(storeId: string): Promise<Types.ProductAggregated[]> {
    return await ProductListService.getStoreProducts(storeId);
  }

  static async getUserMasterProductsPage(
    limit: number,
    options?: { bypassCache?: boolean },
  ) {
    return await ProductListService.getUserMasterProductsPage(limit, options);
  }

  static async getStoreProductsPage(
    storeId: string,
    limit: number,
    options?: { bypassCache?: boolean },
  ) {
    return await ProductListService.getStoreProductsPage(storeId, limit, options);
  }

  /**
   * @deprecated Використовуй getStoreProducts(storeId)
   */
  static async getProductsForStore(storeId: string): Promise<Types.Product[]> {
    const productsAgg = await ProductService.getStoreProducts(storeId);
    return productsAgg as unknown as Types.Product[];
  }

  /**
   * @deprecated Використовуй getUserMasterProducts() або getStoreProducts(storeId)
   */
  static async getProductsAggregated(storeId?: string | null): Promise<Types.ProductAggregated[]> {
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
  ) {
    if (storeId) {
      return ProductService.getStoreProductsPage(storeId, limit, options);
    }
    return ProductService.getUserMasterProductsPage(limit, options);
  }

  static async getProductsPage(
    storeId: string | null,
    limit: number,
    offset: number,
    options?: { bypassCache?: boolean; force?: boolean },
  ) {
    return await ProductListService.getProductsPage(storeId, limit, offset, options);
  }

  static updateFirstPageCaches(
    storeId: string | null,
    mutate: (items: unknown[]) => unknown[],
  ) {
    ProductListService.updateFirstPageCaches(storeId, mutate);
  }

  static patchProductCaches(
    productId: string,
    patch: Partial<Types.ProductAggregated>,
    storeId?: string | null,
  ) {
    ProductListService.patchProductCaches(productId, patch, storeId);
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
  ): Promise<Types.StoreProductLink | null> {
    return await ProductLinkService.getStoreProductLink(productId, storeId);
  }

  static async updateStoreProductLink(
    productId: string,
    storeId: string,
    patch: Partial<Types.StoreProductLinkPatchInput>,
  ): Promise<Types.StoreProductLink | null> {
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
      images?: Types.ProductImage[];
      params?: Types.ProductParam[];
      linkPatch?: Types.StoreProductLinkPatchInput;
    },
  ): Promise<{ product_id: string; link?: Types.StoreProductLink | null } | null> {
    const out = await ProductService.invokeEdge<{ product_id?: string; link?: Types.StoreProductLink | null }>(
      "save-store-product-edit",
      { product_id: productId, store_id: storeId, ...payload },
    );
    const pid = out?.product_id ? String(out.product_id) : null;
    if (pid) {
      try {
        const patch: Partial<Types.ProductAggregated> = {};
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
        ProductService.patchProductCaches(pid, patch);
      } catch (error) {
        console.error("ProductService.saveStoreProductEdit cache update failed", error);
      }
    }
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.saveStoreProductEdit invalidate related caches failed", error);
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
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.removeStoreProductLink invalidate related caches failed", error);
    }
  }

  static async bulkRemoveStoreProductLinks(
    productIds: string[],
    storeIds: string[],
  ): Promise<{ deleted: number; deletedByStore: Record<string, number>; categoryNamesByStore?: Record<string, string[]> }> {
    const out = await ProductLinkService.bulkRemoveStoreProductLinks(productIds, storeIds);
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.bulkRemoveStoreProductLinks invalidate related caches failed", error);
    }
    return out;
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
    const out = await ProductLinkService.bulkAddStoreProductLinks(payload);
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.bulkAddStoreProductLinks invalidate related caches failed", error);
    }
    return out;
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
  static async getProductLimit(): Promise<Types.ProductLimitInfo> {
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

  static clearAllProductsCaches(): void {
    try {
      ProductListService.clearAllProductsCaches();
    } catch {
      void 0;
    }
    
    try {
      ProductStoreService.clearCache();
    } catch {
      void 0;
    }

    try {
      ProductLimitService.invalidateProductLimitCache();
    } catch {
      void 0;
    }

    // Invalidate Supplier Cache
    import("@/lib/supplier-service").then(({ SupplierService }) => {
      SupplierService.clearSuppliersCache();
    }).catch(() => void 0);

    // Invalidate Dashboard Cache
    import("@/lib/dashboard-service").then(({ DashboardService }) => {
      DashboardService.clearCache();
    }).catch(() => void 0);
  }

  static clearAllCaches(): void {
    ProductService.clearAllProductsCaches();
  }

  static async getProducts(): Promise<Types.Product[]>;
  static async getProducts(options: {
    storeId?: string | null;
    limit: number;
    offset: number;
    forceRefresh?: boolean;
  }): Promise<{ items: Types.Product[]; total: number; hasMore: boolean }>;
  static async getProducts(options?: {
    storeId?: string | null;
    limit: number;
    offset: number;
    forceRefresh?: boolean;
  }): Promise<Types.Product[] | { items: Types.Product[]; total: number; hasMore: boolean }> {
    if (!options) {
      return await ProductListService.getProducts();
    }

    const storeId = options.storeId ?? null;
    const limit = Number.isFinite(options.limit) ? options.limit : 50;
    const offset = Number.isFinite(options.offset) ? options.offset : 0;

    const { products, page } = await ProductListService.getProductsPage(storeId, limit, offset, {
      bypassCache: options.forceRefresh === true,
    });

    return {
      items: products as unknown as Types.Product[],
      total: page.total,
      hasMore: page.hasMore,
    };
  }

  /** Параметры товара: через product-edit-data */
  static async getProductParams(productId: string): Promise<Types.ProductParam[]> {
    return await ProductParamsService.getProductParams(productId);
  }

  /** Изображения товара: через product-edit-data */
  static async getProductImages(productId: string): Promise<Types.ProductImage[]> {
    return await ProductImageService.getProductImages(productId);
  }

  /** Получение товара по ID: через product-edit-data */
  static async getProductById(id: string): Promise<Types.Product | null> {
    return await ProductCoreService.getProductById(id);
  }

  /** Агрегированная загрузка данных для страницы редактирования товара */
  static async getProductEditData(
    productId: string,
    storeId?: string,
  ) {
    return await ProductAggregatorService.getProductEditData(productId, storeId);
  }

  /** Один продукт по ID */
  static async getProduct(id: string): Promise<Types.Product> {
    return await ProductCoreService.getProduct(id);
  }

  /** Создание нового продукта (через функцию create-product) */
  static async createProduct(productData: Types.CreateProductData): Promise<Types.Product> {
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
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.createProduct invalidate related caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
    return product;
  }

  static async duplicateProduct(id: string): Promise<Types.Product> {
    const product = await ProductCoreService.duplicateProduct(id);
    try {
      ProductService.clearAllFirstPageCaches();
    } catch (error) {
      console.error("ProductService.duplicateProduct clearAllFirstPageCaches failed", error);
    }
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.duplicateProduct invalidate related caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
    return product;
  }

  /** Обновление товара через функцию update-product */
  static async updateProduct(id: string, productData: Types.UpdateProductData): Promise<void> {
    const productId = await ProductCoreService.updateProduct(id, productData);
    try {
      ProductService.clearMasterProductsCaches();
      ProductService.clearAllProductsCaches();
    } catch (error) {
      console.error("ProductService.updateProduct clear caches failed", error);
    }
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.updateProduct invalidate related caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
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
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.deleteProduct invalidate related caches failed", error);
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
    try {
      await ProductService.invalidateRelatedAfterProductMutation();
    } catch (error) {
      console.error("ProductService.bulkDeleteProducts invalidate related caches failed", error);
    }
    ProductService.invalidateProductLimitCache();
    return out;
  }

  static clearAllFirstPageCaches() {
    ProductListService.clearAllFirstPageCaches();
  }

  static clearMasterProductsCaches(): void {
    ProductListService.clearMasterProductsCaches();
  }

  static clearStoreProductsCaches(storeId: string): void {
    ProductListService.clearStoreProductsCaches(storeId);
  }

  /** Агрегированные справочники для страницы создания товара */
  static async getNewProductLookup() {
    return await ProductAggregatorService.getNewProductLookup();
  }
}
