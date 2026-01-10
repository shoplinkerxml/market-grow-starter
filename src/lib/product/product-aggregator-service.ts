import { ApiError } from "@/lib/user-service";
import { invokeEdge } from "./product-utils";
import { 
  Product, 
  ProductImage, 
  ProductParam, 
  StoreProductLink 
} from "./types";

export class ProductAggregatorService {
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
    const resp = await invokeEdge<{
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
    const resp = await invokeEdge<{
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
      resp = await invokeEdge(
        "product-edit-data",
        storeId
          ? { product_id: String(productId), store_id: String(storeId) }
          : { product_id: String(productId) },
      );
    } catch (error) {
      // Re-throw handled errors or wrap unknown ones
      if (error instanceof ApiError) throw error;
      throw new ApiError("failed_load_product_edit", 500);
    }

    const rawImages = Array.isArray(resp?.images) ? resp.images : [];
    const images = rawImages
      .map((img: any, idx: number) => {
        const rawOrder =
          typeof img?.order_index === "number" ? img.order_index : Number(img?.order_index);
        const order_index = Number.isFinite(rawOrder) ? rawOrder : idx;
        const base = img || {};
        return {
          ...base,
          id: base.id != null ? String(base.id) : undefined,
          product_id: base.product_id != null ? String(base.product_id) : String(productId),
          url: String(base.url || ""),
          order_index,
          is_main: base.is_main === true,
          alt_text: base.alt_text == null ? undefined : String(base.alt_text),
        } as ProductImage;
      })
      .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));

    const rawParams = Array.isArray(resp?.params) ? resp.params : [];
    const normalizeId = (v: unknown): string | undefined => {
      const s = v == null ? "" : String(v).trim();
      return s ? s : undefined;
    };
    const params = rawParams
      .map((p: any, idx: number) => {
        const rawOrder =
          typeof p?.order_index === "number" ? p.order_index : Number(p?.order_index);
        const order_index = Number.isFinite(rawOrder) ? rawOrder : idx;
        const base = p || {};
        return {
          ...base,
          id: base.id != null ? String(base.id) : undefined,
          product_id: base.product_id != null ? String(base.product_id) : String(productId),
          name: String(base.name || ""),
          value: String(base.value || ""),
          order_index,
          paramid: normalizeId(base.paramid),
          valueid: normalizeId(base.valueid),
        } as ProductParam;
      })
      .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));

    return {
      product: (resp?.product || null) as Product | null,
      link: (resp?.link || null) as StoreProductLink | null,
      images,
      params,
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
}
