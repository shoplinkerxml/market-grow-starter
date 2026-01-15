import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SessionValidator } from "@/lib/session-validation";
import type { ProductAggregated } from "@/lib/product-service";

export type ProductsWithDetailsRow = Database["public"]["Views"]["products_with_details"]["Row"];

const NO_STORE_FILTER_ID = "__no_store__";

export type ProductsWithDetailsQuery = {
  storeId?: string | null;
  storeIds?: string[];
  supplierIds?: number[];
  categoryIds?: number[];
  stockMin?: number | null;
  stockMax?: number | null;
  priceOrder?: "asc" | "desc" | null;
};

export type ProductsWithDetailsPage = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  total: number;
};

const BASE_ISO = new Date(0).toISOString();

type ProductsWithDetailsRowWithLinks = ProductsWithDetailsRow & {
  store_product_links?: Array<{ store_id: string | null; is_active: boolean }>;
};

function mapRowToProductAggregated(row: ProductsWithDetailsRowWithLinks): ProductAggregated | null {
  const id = row?.id != null ? String(row.id).trim() : "";
  if (!id) return null;

  const storeId = row?.store_id != null ? String(row.store_id) : "";
  const rawLinks = Array.isArray(row?.store_product_links) ? row.store_product_links : null;
  const linkedStoreIds =
    rawLinks == null
      ? undefined
      : Array.from(
          new Set(
            rawLinks
              .filter((l) => l?.is_active === true && l?.store_id != null)
              .map((l) => String(l.store_id))
              .filter(Boolean),
          ),
        );

  return {
    id,
    store_id: storeId,
    supplier_id: row?.supplier_id ?? null,
    external_id: row?.external_id != null ? String(row.external_id) : "",
    name: row?.name != null ? String(row.name) : "",
    name_ua: row?.name_ua != null ? String(row.name_ua) : null,
    docket: row?.docket != null ? String(row.docket) : null,
    docket_ua: row?.docket_ua != null ? String(row.docket_ua) : null,
    description: row?.description != null ? String(row.description) : null,
    description_ua: row?.description_ua != null ? String(row.description_ua) : null,
    vendor: row?.vendor != null ? String(row.vendor) : null,
    article: row?.article != null ? String(row.article) : null,
    category_id: row?.category_id ?? null,
    category_external_id: row?.category_external_id != null ? String(row.category_external_id) : null,
    currency_code: row?.currency_code != null ? String(row.currency_code) : null,
    price: row?.price ?? null,
    price_old: row?.price_old ?? null,
    price_promo: row?.price_promo ?? null,
    stock_quantity: Number.isFinite(Number(row?.stock_quantity)) ? Number(row?.stock_quantity) : 0,
    available: row?.available === true,
    state: row?.state != null ? String(row.state) : "new",
    created_at: row?.created_at != null ? String(row.created_at) : BASE_ISO,
    updated_at: row?.updated_at != null ? String(row.updated_at) : BASE_ISO,
    mainImageUrl: row?.main_image_url ? String(row.main_image_url) : undefined,
    categoryName: row?.category_name ? String(row.category_name) : undefined,
    supplierName: row?.supplier_name ? String(row.supplier_name) : undefined,
    linkedStoreIds,
  } satisfies ProductAggregated;
}

export class ProductsWithDetailsService {
  static async getProductsPage(
    query: ProductsWithDetailsQuery,
    limit: number,
    offset: number,
  ): Promise<{ products: ProductAggregated[]; page: ProductsWithDetailsPage }> {
    const v = await SessionValidator.ensureValidSession();
    if (!v.isValid || !v.user?.id) {
      throw Object.assign(new Error(v.error || "Unauthorized"), { status: 401 });
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
    const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const from = safeOffset;
    const to = safeOffset + safeLimit - 1;

    const q = query || {};
    const storeId = q.storeId ? String(q.storeId) : null;
    const requestedStoreIds: string[] = Array.isArray(q.storeIds) ? q.storeIds.map(String).filter(Boolean) : [];
    const includeNoStore = requestedStoreIds.includes(NO_STORE_FILTER_ID);
    const storeIds = Array.from(new Set(requestedStoreIds.filter((id) => id !== NO_STORE_FILTER_ID)));
    const storeFilterEnabled = !storeId && (storeIds.length > 0 || includeNoStore);
    const embedStoreLinks = !storeId;

    const storeLinksSelect = storeFilterEnabled
      ? includeNoStore
          ? "store_product_links(store_id,is_active)"
          : "store_product_links!inner(store_id,is_active)"
      : embedStoreLinks
          ? "store_product_links(store_id,is_active)"
          : null;

    const selectCols = storeLinksSelect ? `*, ${storeLinksSelect}` : "*";

    let req = supabase
      .from("products_with_details")
      .select(selectCols, { count: "exact" })
      .eq("owner_user_id", String(v.user.id));

    if (storeId) {
      req = req.eq("store_id", storeId);
    } else if (storeFilterEnabled) {
      if (includeNoStore && storeIds.length === 0) {
        req = req.is("store_product_links", null);
      } else if (includeNoStore && storeIds.length > 0) {
        const inVals = storeIds.map((id) => `"${id}"`).join(",");
        req = req.or(
          `and(store_product_links.store_id.in.(${inVals}),store_product_links.is_active.eq.true),store_product_links.is.null`,
        );
      } else {
        req = req.in("store_product_links.store_id", storeIds).eq("store_product_links.is_active", true);
      }
    }

    if (Array.isArray(q.supplierIds) && q.supplierIds.length > 0) {
      const supplierIds: number[] = Array.from(
        new Set(q.supplierIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))),
      );
      if (supplierIds.length > 0) req = req.in("supplier_id", supplierIds);
    }

    if (Array.isArray(q.categoryIds) && q.categoryIds.length > 0) {
      const categoryIds: number[] = Array.from(
        new Set(q.categoryIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))),
      );
      if (categoryIds.length > 0) req = req.in("category_id", categoryIds);
    }

    if (q.stockMin != null) {
      const n = Number(q.stockMin);
      if (Number.isFinite(n)) req = req.gte("stock_quantity", n);
    }
    if (q.stockMax != null) {
      const n = Number(q.stockMax);
      if (Number.isFinite(n)) req = req.lte("stock_quantity", n);
    }

    if (q.priceOrder === "asc") {
      req = req.order("price", { ascending: true });
    } else if (q.priceOrder === "desc") {
      req = req.order("price", { ascending: false });
    } else {
      req = req.order("updated_at", { ascending: false });
    }

    req = req.order("id", { ascending: true }).range(from, to);

    const { data, error, count } = await req;
    if (error) {
      const e = error as { message?: string; code?: string; details?: string; hint?: string };
      throw Object.assign(new Error(e?.message || "Query failed"), { code: e?.code, details: e?.details, hint: e?.hint });
    }

    const total = typeof count === "number" && Number.isFinite(count) ? Math.max(0, count) : 0;
    const nextOffset = safeOffset + safeLimit < total ? safeOffset + safeLimit : null;
    const hasMore = nextOffset != null;

    const products = (Array.isArray(data) ? data : [])
      .map((r) => mapRowToProductAggregated(r as unknown as ProductsWithDetailsRowWithLinks))
      .filter((p): p is ProductAggregated => !!p);

    return {
      products,
      page: { limit: safeLimit, offset: safeOffset, hasMore, nextOffset, total },
    };
  }
}
