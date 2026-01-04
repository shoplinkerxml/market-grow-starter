import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { invokeEdgeWithAuth, requireValidSession } from "./session-validation";
import { UnifiedCacheManager } from "./cache-utils";
import type { RequireAtLeastOne } from "./request-handler";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

export interface Shop {
  id: string;
  user_id: string;
  store_name: string;
  store_company?: string | null;
  store_url?: string | null;
  template_id?: string | null;
  xml_config?: Json | null;
  custom_mapping?: Json | null;
  marketplace?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateShopData {
  store_name: string;
  store_company?: string | null;
  store_url?: string | null;
  template_id?: string | null;
  xml_config?: Json | null;
  custom_mapping?: Json | null;
  marketplace?: string | null;
}

export type UpdateShopData = RequireAtLeastOne<{
  store_name?: string;
  store_company?: string | null;
  store_url?: string | null;
  template_id?: string | null;
  xml_config?: Json | null;
  custom_mapping?: Json | null;
  is_active?: boolean;
}>;

export interface ShopLimitInfo {
  current: number;
  max: number;
  canCreate: boolean;
}

export interface ShopAggregated extends Shop {
  marketplace?: string;
  productsCount?: number;
  categoriesCount?: number;
}

export interface StoreCategory {
  store_category_id: number;
  store_id: string;
  category_id: number;
  name: string;
  base_external_id: string | null;
  parent_external_id: string | null;
  base_rz_id: string | null;
  store_external_id: string | null;
  store_rz_id_value: string | null;
  is_active: boolean;
}

export interface ShopSettingsAggregated {
  shop: Shop;
  productsCount: number;
  storeCurrencies: Array<{ code: string; rate: number; is_base: boolean }>;
  availableCurrencies: Array<{ code: string; rate?: number }>;
  marketplaces: string[];
  categories: StoreCategory[];
}

interface ShopsListResponse {
  shops: ShopAggregated[];
  totalShops?: number;
  limit?: number;
}

interface ShopLimitOnlyResponse {
  totalShops: number;
  limit: number;
}

interface ShopResponse {
  shop: Shop;
}

export class ShopServiceCore {
  protected static deduplicator = RequestDeduplicatorFactory.create("shop-service", {
    ttl: 30_000,
    maxSize: 200,
    enableMetrics: true,
    errorStrategy: "remove",
  });

  protected static cache = UnifiedCacheManager.create("shop-service", {
    mode: "memory",
    defaultTtlMs: 30_000,
    maxSize: 300,
  });

  protected static lastUserId: string | null = null;

  protected static isOffline(): boolean {
    return typeof navigator !== "undefined" && !navigator.onLine;
  }

  protected static async ensureSession(): Promise<void> {
    await requireValidSession({ requireAccessToken: false });
  }

  protected static handleEdgeError(error: unknown, functionName: string): never {
    console.error(`Edge function "${functionName}" failed:`, error);

    let message = `${functionName} failed`;
    let status: number | undefined;

    if (error && typeof error === "object") {
      const err = error as Record<string, any>;

      if (err.message) message = err.message;

      try {
        const context = err.context;
        if (context) {
          status = typeof context.status === "number" ? context.status : undefined;
          const body = context.body || context.error;
          if (body) {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            const serverMessage = parsed?.message || parsed?.error;
            if (serverMessage) message = `${functionName}: ${serverMessage}`;
          }
        }
      } catch (parseError) {
        console.warn("Could not parse error details:", parseError);
      }

      if (status === undefined) {
        const directStatus = err.status ?? err.statusCode;
        status = typeof directStatus === "number" ? directStatus : undefined;
      }
    }

    if (status) {
      const statusMessages: Record<number, string> = {
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
      };
      const statusText = statusMessages[status] || status;
      if (!message.includes(String(status))) {
        message = `${message} (${statusText})`;
      }
    }

    throw new Error(message);
  }

  protected static async invokeEdge<T>(functionName: string, body: Record<string, unknown> = {}): Promise<T> {
    try {
      return await invokeEdgeWithAuth<T>(functionName, body);
    } catch (error) {
      this.handleEdgeError(error, functionName);
    }
  }

  protected static async deduplicateRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
    return await this.deduplicator.dedupe(key, request);
  }

  protected static getCached<T>(key: string): T | null {
    return this.cache.get<T>(key);
  }

  protected static setCache(key: string, data: any): void {
    this.cache.set(key, data);
  }

  protected static clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clearAll();
      return;
    }

    this.cache.clearWhere((k) => k.includes(pattern));
  }

  protected static async getSessionUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id ? String(data.session.user.id) : null;
      if (userId) this.lastUserId = userId;
      return userId;
    } catch {
      return null;
    }
  }

  protected static async clearShopsCaches(): Promise<void> {
    this.clearCache("shops");
    this.clearCache("shops-aggregated");
    this.clearCache("shop-limit");
    this.clearCache("shop-limit-info");
    try {
      const { UserAuthService } = await import("@/lib/user-auth-service");
      UserAuthService.clearAuthMeCache();
    } catch {
      void 0;
    }
  }

  static clearAllCaches(): void {
    try {
      this.deduplicator.clear();
    } catch {
      void 0;
    }
    try {
      this.lastUserId = null;
    } catch {
      void 0;
    }
    try {
      this.clearCache();
    } catch {
      void 0;
    }
  }

  protected static updateShopCounters(storeId: string, update: (shop: ShopAggregated) => Partial<ShopAggregated>): void {
    const cacheKey = "shops-aggregated";
    const cached = this.getCached<ShopAggregated[]>(cacheKey);

    if (!cached) return;

    const updated = cached.map((shop) => (shop.id === storeId ? { ...shop, ...update(shop) } : shop));

    this.setCache(cacheKey, updated);
  }

  protected static async getShopsFallback(): Promise<ShopAggregated[]> {
    try {
      const response = await this.invokeEdge<ShopsListResponse>("user-shops-list", { includeConfig: false });
      const shops = response.shops || [];
      return shops as ShopAggregated[];
    } catch {
      return [];
    }
  }

  static async getShopLimit(): Promise<ShopLimitInfo> {
    if (this.isOffline()) return { current: 0, max: 3, canCreate: true };

    const cacheKey = "shop-limit-info";
    const cached = this.getCached<ShopLimitInfo>(cacheKey);
    if (cached) return cached;

    await this.ensureSession();

    try {
      const response = await this.invokeEdge<ShopLimitOnlyResponse>("user-shops-list", { limitOnly: true });
      const current = Math.max(0, Number(response.totalShops) || 0);
      const max = Math.max(3, Number(response.limit) || 0);
      const info = { current, max, canCreate: current < max };
      this.setCache(cacheKey, info);
      this.setCache("shop-limit", max);
      return info;
    } catch {
      return { current: 0, max: 3, canCreate: true };
    }
  }

  static getShopLimitInfoCached(): ShopLimitInfo | null {
    return this.getCached<ShopLimitInfo>("shop-limit-info");
  }

  static async getShopLimitOnly(): Promise<number> {
    const cacheKey = "shop-limit";
    const cached = this.getCached<number>(cacheKey);
    if (cached) return cached;

    const info = await this.getShopLimit();
    this.setCache(cacheKey, info.max);
    return info.max;
  }

  static async getShopsCount(): Promise<number> {
    if (this.isOffline()) return 0;
    const info = await this.getShopLimit();
    return info.current;
  }

  static async getShopsCountCached(): Promise<number> {
    return this.getShopsCount();
  }

  static async getShops(): Promise<Shop[]> {
    if (this.isOffline()) return [];

    await this.ensureSession();

    const response = await this.invokeEdge<ShopsListResponse>("user-shops-list", { includeConfig: false });
    return response.shops || [];
  }

  static async getShopsAggregated(options?: { force?: boolean }): Promise<ShopAggregated[]> {
    const force = options?.force === true;
    const cacheKey = "shops-aggregated";

    if (!force) {
      const cached = this.getCached<ShopAggregated[]>(cacheKey);
      if (cached) return cached;
    }

    if (this.isOffline()) return [];

    await this.ensureSession();

    return this.deduplicateRequest(cacheKey, async () => {
      try {
        const response = await this.invokeEdge<ShopsListResponse>("user-shops-list", { includeConfig: false });
        const shops = response.shops || [];
        const limit = Number(response.limit ?? NaN);
        if (Number.isFinite(limit)) {
          const current = Math.max(0, Number(response.totalShops ?? shops.length) || 0);
          const max = Math.max(3, limit || 0);
          const info = { current, max, canCreate: current < max };
          this.setCache("shop-limit-info", info);
          this.setCache("shop-limit", info.max);
        }
        this.setCache(cacheKey, shops);
        return shops;
      } catch (error) {
        console.error("Failed to fetch aggregated shops, using fallback:", error);
        const fallback = await this.getShopsFallback();
        return fallback;
      }
    });
  }

  static async getShop(id: string): Promise<Shop> {
    if (!id) throw new Error("Shop ID is required");

    await this.ensureSession();
    const response = await this.deduplicateRequest(`shop:get:${id}`, async () => {
      return await this.invokeEdge<ShopsListResponse>("user-shops-list", {
        store_id: id,
        includeConfig: true,
      });
    });

    const shop = response.shops?.[0];
    if (!shop) throw new Error(`Shop with ID ${id} not found`);

    return shop;
  }

  static async getShopLite(id: string): Promise<ShopAggregated> {
    if (!id) throw new Error("Shop ID is required");

    const cacheKey = "shops-aggregated";
    const cachedList = this.getCached<ShopAggregated[]>(cacheKey);

    if (cachedList) {
      const found = cachedList.find((s) => String(s.id) === String(id));
      if (found) {
        return { ...found };
      }
    }

    await this.ensureSession();
    const response = await this.deduplicateRequest(`shop:lite:${id}`, async () => {
      return await this.invokeEdge<ShopsListResponse>("user-shops-list", {
        store_id: id,
        includeConfig: false,
      });
    });

    const shop = response.shops?.[0];
    if (!shop) throw new Error(`Shop with ID ${id} not found`);

    return shop;
  }

  static async getShopSettingsAggregated(storeId: string): Promise<ShopSettingsAggregated> {
    if (!storeId) throw new Error("Store ID is required");

    await this.ensureSession();
    const response = await this.deduplicateRequest(`shop:settings-agg:${storeId}`, async () => {
      return await this.invokeEdge<ShopSettingsAggregated>("shop-settings-aggregated", { store_id: storeId });
    });

    return {
      shop: response.shop,
      productsCount: Number(response.productsCount ?? 0),
      storeCurrencies: (response.storeCurrencies || []).map((r) => ({
        code: String(r.code),
        rate: Number(r.rate ?? 1),
        is_base: Boolean(r.is_base),
      })),
      availableCurrencies: (response.availableCurrencies || []).map((r) => ({
        code: String(r.code),
        rate: r.rate != null ? Number(r.rate) : undefined,
      })),
      marketplaces: (response.marketplaces || []).map(String),
      categories: (response.categories || []).map((row) => ({
        store_category_id: Number(row.store_category_id),
        store_id: String(row.store_id),
        category_id: Number(row.category_id),
        name: String(row.name || ""),
        base_external_id: row.base_external_id ?? null,
        parent_external_id: row.parent_external_id ?? null,
        base_rz_id: row.base_rz_id ?? null,
        store_external_id: row.store_external_id ?? null,
        store_rz_id_value: row.store_rz_id_value ?? null,
        is_active: Boolean(row.is_active),
      })),
    };
  }

  static async createShop(shopData: CreateShopData): Promise<Shop> {
    const storeName = shopData.store_name?.trim();
    if (!storeName) throw new Error("Назва магазину обов'язкова");

    await this.ensureSession();

    try {
      const response = await this.invokeEdge<ShopResponse>("create-shop", {
        store_name: storeName,
        template_id: shopData.template_id ?? null,
        xml_config: shopData.xml_config ?? null,
        custom_mapping: shopData.custom_mapping ?? null,
        store_company: shopData.store_company ?? null,
        store_url: shopData.store_url ?? null,
        marketplace: shopData.marketplace ?? null,
      });

      await this.clearShopsCaches();

      return response.shop;
    } catch (e) {
      const msg = String((e as { message?: string })?.message || "");
      if (/limit|400|LIMIT_REACHED/i.test(msg)) {
        const max = await this.getShopLimitOnly();
        throw new Error(`Досягнуто ліміту магазинів (${max}). Оновіть тарифний план.`);
      }
      throw e;
    }
  }

  static async updateShop(id: string, shopData: UpdateShopData): Promise<Shop> {
    if (!id) throw new Error("Shop ID is required");

    await this.ensureSession();

    const patch: Record<string, unknown> = {};

    if (shopData.store_name !== undefined) {
      const trimmed = shopData.store_name.trim();
      if (!trimmed) throw new Error("Назва магазину обов'язкова");
      patch.store_name = trimmed;
    }

    if (shopData.store_company !== undefined) {
      patch.store_company = shopData.store_company ?? null;
    }

    if (shopData.store_url !== undefined) {
      patch.store_url = shopData.store_url ?? null;
    }

    if (shopData.template_id !== undefined) {
      patch.template_id = shopData.template_id || null;
    }

    if (shopData.xml_config !== undefined) {
      patch.xml_config = shopData.xml_config || null;
    }

    if (shopData.custom_mapping !== undefined) {
      patch.custom_mapping = shopData.custom_mapping || null;
    }

    if (shopData.is_active !== undefined) {
      patch.is_active = shopData.is_active;
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("No fields to update");
    }

    patch.updated_at = new Date().toISOString();

    const response = await this.invokeEdge<ShopResponse>("update-shop", { id, patch });

    await this.clearShopsCaches();

    return response.shop;
  }

  static async deleteShop(id: string): Promise<void> {
    if (!id) throw new Error("Shop ID is required");

    await this.ensureSession();

    try {
      await this.invokeEdge<{ ok: boolean }>("delete-shop", { id });
      await this.clearShopsCaches();
    } catch (e) {
      const msg = String((e as { message?: string })?.message || "");

      if (/401|Unauthorized|403|Forbidden/i.test(msg)) throw e;

      if (/409|Conflict/i.test(msg)) {
        await this.cleanupShopDependencies(id);
        await this.invokeEdge<{ ok: boolean }>("delete-shop", { id });
        await this.clearShopsCaches();
      } else {
        throw e;
      }
    }
  }

  protected static async getStoreCategories(_storeId: string): Promise<StoreCategory[]> {
    return [];
  }

  protected static async deleteStoreCategoriesWithProducts(_storeId: string, _categoryIds: number[]): Promise<void> {
    void 0;
  }

  protected static async cleanupShopDependencies(storeId: string): Promise<void> {
    try {
      const { ProductService } = await import("@/lib/product-service");
      const products = await ProductService.getProductsAggregated(storeId);
      const productIds = products.map((p) => String(p.id)).filter(Boolean);

      if (productIds.length > 0) {
        await ProductService.bulkRemoveStoreProductLinks(productIds, [storeId]);
      }

      const categories = await this.getStoreCategories(storeId);
      const categoryIds = categories.map((c) => c.store_category_id).filter(Number.isFinite);

      if (categoryIds.length > 0) {
        await this.deleteStoreCategoriesWithProducts(storeId, categoryIds);
      }
    } catch (error) {
      console.warn("Failed to cleanup shop dependencies:", error);
    }
  }

  static bumpProductsCountInCache(storeId: string, delta: number): void {
    this.updateShopCounters(storeId, (shop) => ({
      productsCount: Math.max(0, (shop.productsCount || 0) + delta),
    }));
  }

  static bumpCategoriesCountInCache(storeId: string, delta: number): void {
    this.updateShopCounters(storeId, (shop) => ({
      categoriesCount: Math.max(0, (shop.categoriesCount || 0) + delta),
    }));
  }

  static setProductsCountInCache(storeId: string, count: number): void {
    const finalCount = Math.max(0, Number(count) || 0);
    this.updateShopCounters(storeId, (shop) => ({
      productsCount: finalCount,
      categoriesCount: finalCount === 0 ? 0 : shop.categoriesCount,
    }));
  }

  static setCategoriesCountInCache(storeId: string, count: number): void {
    this.updateShopCounters(storeId, (shop) => {
      const productsCount = shop.productsCount || 0;
      return {
        categoriesCount: productsCount === 0 ? 0 : Math.max(0, count),
      };
    });
  }

  static async recomputeStoreCounts(storeId: string): Promise<{ productsCount: number; categoriesCount: number }> {
    if (!storeId) return { productsCount: 0, categoriesCount: 0 };

    await this.ensureSession();
    const response = await this.deduplicateRequest(`shop:recompute-counts:${storeId}`, async () => {
      return await this.invokeEdge<ShopsListResponse>("user-shops-list", {
        store_id: storeId,
        includeConfig: false,
        forceCounts: true,
      });
    });

    const shop = (response.shops || []).find((s) => String(s.id) === String(storeId));

    const productsCount = Math.max(0, Number(shop?.productsCount ?? 0));
    const categoriesCount = productsCount === 0 ? 0 : Math.max(0, Number(shop?.categoriesCount ?? 0));

    this.updateShopCounters(storeId, () => ({
      productsCount,
      categoriesCount,
    }));

    return { productsCount, categoriesCount };
  }

  static async getStoreProductsCount(storeId: string): Promise<number> {
    const sid = String(storeId || "").trim();
    if (!sid) return 0;

    const cacheKey = "shops-aggregated";
    const cachedList = this.getCached<ShopAggregated[]>(cacheKey);
    const found = Array.isArray(cachedList) ? cachedList.find((s) => String(s.id) === sid) : null;
    return Math.max(0, Number(found?.productsCount ?? 0));
  }
}

