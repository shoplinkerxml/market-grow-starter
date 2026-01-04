import { R2Storage } from "@/lib/r2-storage";
import { invokeEdgeWithAuth } from "@/lib/session-validation";
import type {
  CreateProductData,
  Product,
  ProductAggregated,
  ProductImage,
  ProductParam,
  UpdateProductData,
} from "@/lib/product-service";

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

export class ProductImportExportService {
  private static castNullableNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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
    const resp = await invokeEdgeWithAuth<{
      suppliers?: any[];
      currencies?: any[];
      supplierCategoriesMap?: Record<string, any[]>;
    }>("get-user-lookups", {});
    return {
      suppliers: Array.isArray(resp.suppliers) ? resp.suppliers : [],
      currencies: Array.isArray(resp.currencies) ? resp.currencies : [],
      supplierCategoriesMap: resp.supplierCategoriesMap || {},
    };
  }

  static async getProductsPage(
    storeId: string | null,
    limit: number,
    offset: number,
  ): Promise<{ products: ProductAggregated[]; page: ProductListPage }> {
    const resp = await invokeEdgeWithAuth<ProductListResponseObj>(
      storeId ? "store-products-list" : "user-products-list",
      {
        ...(storeId ? { store_id: String(storeId) } : {}),
        limit,
        offset,
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
  }

  private static async getDefaultStoreId(): Promise<string> {
    const resp = await invokeEdgeWithAuth<{ shops?: Array<{ id?: string | number }> }>(
      "user-shops-list",
      {},
    );
    const shops = Array.isArray(resp?.shops) ? resp.shops : [];
    const first = shops.map((s) => String(s?.id || "").trim()).find(Boolean);
    if (!first) {
      throw new Error("store_id_required");
    }
    return first;
  }

  static async createProduct(productData: CreateProductData, options?: { effectiveStoreId: string | null }): Promise<string> {
    const storeId = String(options?.effectiveStoreId || productData.store_id || "").trim() || (await ProductImportExportService.getDefaultStoreId());
    const currencyCode = (productData.currency_code && String(productData.currency_code).trim()) || "UAH";

    const payload: Record<string, unknown> = {
      store_id: storeId,
      supplier_id: ProductImportExportService.castNullableNumber(productData.supplier_id),
      category_id: ProductImportExportService.castNullableNumber(productData.category_id),
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
      images: (productData.images || []).map((img, index) => ({
        key: (img as unknown as { object_key?: string }).object_key || undefined,
        url: img.url,
        order_index: typeof img.order_index === "number" ? img.order_index : index,
        is_main: !!img.is_main,
      })),
      params: (productData.params || []).map((p, index) => ({
        name: p.name,
        value: p.value,
        order_index: typeof p.order_index === "number" ? p.order_index : index,
        paramid: p.paramid ?? null,
        valueid: p.valueid ?? null,
      })),
      links: productData.links || undefined,
    };

    const respCreate = await invokeEdgeWithAuth<{ product_id?: string }>("create-product", payload);
    const productId = String(respCreate?.product_id || "").trim();
    if (!productId) throw new Error("create_failed");
    return productId;
  }

  static async updateProduct(id: string, productData: UpdateProductData): Promise<void> {
    const payload: Record<string, unknown> = {
      product_id: id,
    };

    if (productData.supplier_id !== undefined) payload.supplier_id = ProductImportExportService.castNullableNumber(productData.supplier_id);
    if (productData.category_id !== undefined) payload.category_id = ProductImportExportService.castNullableNumber(productData.category_id);
    if (productData.category_external_id !== undefined) payload.category_external_id = productData.category_external_id;
    if (productData.currency_code !== undefined) payload.currency_code = productData.currency_code;
    if (productData.external_id !== undefined) payload.external_id = productData.external_id;
    if (productData.name !== undefined) payload.name = productData.name;
    if (productData.name_ua !== undefined) payload.name_ua = productData.name_ua;
    if (productData.vendor !== undefined) payload.vendor = productData.vendor;
    if (productData.article !== undefined) payload.article = productData.article;
    if (productData.available !== undefined) payload.available = productData.available;
    if (productData.stock_quantity !== undefined) payload.stock_quantity = productData.stock_quantity;
    if (productData.price !== undefined) payload.price = productData.price;
    if (productData.price_old !== undefined) payload.price_old = productData.price_old;
    if (productData.price_promo !== undefined) payload.price_promo = productData.price_promo;
    if (productData.description !== undefined) payload.description = productData.description;
    if (productData.description_ua !== undefined) payload.description_ua = productData.description_ua;
    if (productData.docket !== undefined) payload.docket = productData.docket;
    if (productData.docket_ua !== undefined) payload.docket_ua = productData.docket_ua;
    if (productData.state !== undefined) payload.state = productData.state;
    if (productData.store_id !== undefined) payload.store_id = productData.store_id;

    if (productData.images !== undefined) {
      payload.images = (productData.images || []).map((img, index) => ({
        key: (img as unknown as { object_key?: string }).object_key || undefined,
        url: img.url,
        order_index: typeof img.order_index === "number" ? img.order_index : index,
        is_main: !!img.is_main,
      }));
    }
    if (productData.params !== undefined) {
      payload.params = (productData.params || []).map((p, index) => ({
        name: p.name,
        value: p.value,
        order_index: typeof p.order_index === "number" ? p.order_index : index,
        paramid: p.paramid ?? null,
        valueid: p.valueid ?? null,
      }));
    }

    await invokeEdgeWithAuth<{ product_id?: string }>("update-product", payload);
  }

  static async getProductsEditDataBatch(
    productIds: string[],
    storeId?: string,
  ): Promise<Array<{ product: Product; images: ProductImage[]; params: ProductParam[] }>> {
    const ids = Array.from(new Set((productIds || []).map(String).map((s) => s.trim()).filter(Boolean)));
    if (ids.length === 0) return [];

    const chunkSize = 100;
    const byId = new Map<string, { product: Product; images: ProductImage[]; params: ProductParam[] }>();

    const parts: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      parts.push(ids.slice(i, i + chunkSize));
    }

    const MAX_CONCURRENCY = 3;
    let cursor = 0;

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, parts.length) }, async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;
        const part = parts[currentIndex];
        if (!part) return;

        const resp = await invokeEdgeWithAuth<{
          items?: Array<{ product: Product; images?: unknown[]; params?: unknown[] }>;
        }>("product-export-data", { product_ids: part, store_id: storeId ?? null });

        const items = Array.isArray(resp?.items) ? resp.items : [];
        for (const it of items) {
          const pid = String(it?.product?.id || "");
          if (!pid) continue;

          const imagesRaw = Array.isArray(it?.images) ? it.images : [];
          const images: ProductImage[] = imagesRaw.map((img, idx) => {
            const raw = (img || {}) as Record<string, unknown>;
            const rawUrl = String(raw.url || "");
            const absolute = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
            const r2o = raw.r2_key_original != null ? String(raw.r2_key_original) : "";
            const resolved = absolute || (r2o ? R2Storage.makePublicUrl(r2o) : (rawUrl ? R2Storage.makePublicUrl(rawUrl) : ""));
            return {
              id: raw.id != null ? String(raw.id) : undefined,
              product_id: raw.product_id != null ? String(raw.product_id) : pid,
              url: resolved || rawUrl,
              order_index: typeof raw.order_index === "number" ? (raw.order_index as number) : idx,
              is_main: raw.is_main === true,
              alt_text: raw.alt_text != null ? String(raw.alt_text) : undefined,
            };
          });

          const paramsRaw = Array.isArray(it?.params) ? it.params : [];
          const params: ProductParam[] = paramsRaw.map((p, idx) => {
            const raw = (p || {}) as Record<string, unknown>;
            return {
              id: raw.id != null ? String(raw.id) : undefined,
              product_id: raw.product_id != null ? String(raw.product_id) : pid,
              name: String(raw.name || ""),
              value: String(raw.value || ""),
              order_index: typeof raw.order_index === "number" ? (raw.order_index as number) : idx,
              paramid: raw.paramid != null ? String(raw.paramid) : undefined,
              valueid: raw.valueid != null ? String(raw.valueid) : undefined,
            };
          });

          byId.set(pid, { product: it.product, images, params });
        }
      }
    });

    await Promise.all(workers);

    return ids
      .map((id) => byId.get(String(id)))
      .filter(Boolean) as Array<{ product: Product; images: ProductImage[]; params: ProductParam[] }>;
  }
}
