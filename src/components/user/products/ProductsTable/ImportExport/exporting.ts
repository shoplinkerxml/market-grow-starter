import type { Product, ProductAggregated, ProductImage, ProductParam } from "@/lib/product-service";
import { ProductImportExportService } from "@/lib/product-import-export-service";
import { useI18nStore } from "@/i18n";
import type { Lang } from "@/i18n/types";
import {
  LOOKUPS_EXPORT_COLUMNS,
  LOOKUPS_SHEET_NAME,
  META_EXPORT_COLUMNS,
  META_SHEET_NAME,
  PRODUCTS_SHEET_NAME,
} from "./constants";
import { buildCsvFromRows } from "./csv";
import { buildXlsxBlobFromSheets } from "./xlsx";

type ProductExportRow = Record<string, unknown>;
type LookupsExportRow = Record<(typeof LOOKUPS_EXPORT_COLUMNS)[number], unknown>;
type MetaExportRow = Record<(typeof META_EXPORT_COLUMNS)[number], unknown>;

function asNumberOrEmpty(v: unknown): number | "" {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function asBooleanOrEmpty(v: unknown): boolean | "" {
  if (v == null || v === "") return "";
  return !!v;
}

function getStatusLabelKey(state: string): string {
  const s = String(state || "").trim().toLowerCase();
  if (s === "stock") return "status_stock";
  if (s === "used") return "status_used";
  if (s === "refurbished") return "status_refurbished";
  if (s === "archived") return "status_archived";
  return "status_new";
}

function buildProductColumns(lang: Lang, maxParams: number): string[] {
  const base =
    lang === "uk"
      ? [
          "ID",
          "Зовнішній ID",
          "Назва",
          "Бренд",
          "Артикул",
          "Короткий опис",
          "Опис",
          "Валюта",
          "Ціна",
          "Стара ціна",
          "Акційна ціна",
          "Залишок",
          "В наявності",
          "Стан",
          "Активний",
          "Категорія",
          "Постачальник",
        ]
      : [
          "ID",
          "External ID",
          "Name",
          "Brand",
          "Article",
          "Short Description",
          "Description",
          "Currency",
          "Price",
          "Old Price",
          "Promo Price",
          "Stock",
          "Available",
          "Status",
          "Active",
          "Category",
          "Supplier",
        ];

  const out = [...base];
  const charPrefix = lang === "uk" ? "Характеристика" : "Characteristic";
  const valPrefix = lang === "uk" ? "Значення" : "Value";
  for (let i = 1; i <= Math.max(0, Math.floor(maxParams)); i++) {
    out.push(`${charPrefix} ${i}`);
    out.push(`${valPrefix} ${i}`);
  }
  return out;
}

function toProductExportRow(args: {
  product: Product;
  meta?: ProductAggregated;
  categoryName?: string;
  supplierName?: string;
  lang: Lang;
  t: (k: string) => string;
  maxParams: number;
  params: ProductParam[];
}): ProductExportRow {
  const p = args.product;
  const lang = args.lang;
  const name = lang === "uk" ? p.name_ua || p.name || "" : p.name || p.name_ua || "";
  const docket = lang === "uk" ? p.docket_ua || p.docket || "" : p.docket || p.docket_ua || "";
  const description = lang === "uk" ? p.description_ua || p.description || "" : p.description || p.description_ua || "";
  const statusKey = getStatusLabelKey(String(p.state || "new"));
  const statusLabel = args.t(statusKey);

  const row: ProductExportRow =
    lang === "uk"
      ? {
          ID: String(p.id || ""),
          "Зовнішній ID": p.external_id,
          "Назва": name,
          "Бренд": p.vendor ?? "",
          "Артикул": p.article ?? "",
          "Короткий опис": docket ?? "",
          "Опис": description ?? "",
          "Валюта": p.currency_code ?? "",
          "Ціна": asNumberOrEmpty(p.price),
          "Стара ціна": asNumberOrEmpty(p.price_old),
          "Акційна ціна": asNumberOrEmpty(p.price_promo),
          "Залишок": asNumberOrEmpty(p.stock_quantity),
          "В наявності": asBooleanOrEmpty(p.available),
          "Стан": statusLabel || p.state || "",
          "Активний": asBooleanOrEmpty((p as any)?.is_active),
          "Категорія": args.meta?.categoryName || args.categoryName || "",
          "Постачальник": args.meta?.supplierName || args.supplierName || "",
        }
      : {
          ID: String(p.id || ""),
          "External ID": p.external_id,
          "Name": name,
          "Brand": p.vendor ?? "",
          "Article": p.article ?? "",
          "Short Description": docket ?? "",
          "Description": description ?? "",
          "Currency": p.currency_code ?? "",
          "Price": asNumberOrEmpty(p.price),
          "Old Price": asNumberOrEmpty(p.price_old),
          "Promo Price": asNumberOrEmpty(p.price_promo),
          "Stock": asNumberOrEmpty(p.stock_quantity),
          "Available": asBooleanOrEmpty(p.available),
          "Status": statusLabel || p.state || "",
          "Active": asBooleanOrEmpty((p as any)?.is_active),
          "Category": args.meta?.categoryName || args.categoryName || "",
          "Supplier": args.meta?.supplierName || args.supplierName || "",
        };

  const charPrefix = lang === "uk" ? "Характеристика" : "Characteristic";
  const valPrefix = lang === "uk" ? "Значення" : "Value";
  const params = Array.isArray(args.params) ? args.params : [];
  for (let i = 1; i <= Math.max(0, Math.floor(args.maxParams)); i++) {
    const prm = params[i - 1];
    row[`${charPrefix} ${i}`] = prm?.name ?? "";
    row[`${valPrefix} ${i}`] = prm?.value ?? "";
  }

  return row;
}

function indexBaseProducts(baseProducts: ProductAggregated[]): { ids: string[]; byId: Map<string, ProductAggregated> } {
  const base = Array.isArray(baseProducts) ? baseProducts : [];
  const byId = new Map<string, ProductAggregated>();
  for (const p of base) {
    if (!p?.id) continue;
    byId.set(String(p.id), p);
  }
  return { ids: Array.from(byId.keys()), byId };
}

function buildLookupsMaps(lookups: any): {
  suppliersById: Map<string, string>;
  categoriesById: Map<string, string>;
  catsMap: Record<string, unknown>;
} {
  const suppliersById = new Map<string, string>();
  for (const s of (lookups?.suppliers || []) as any[]) {
    const sid = String((s as any)?.id || "").trim();
    if (!sid) continue;
    suppliersById.set(sid, String((s as any)?.supplier_name || ""));
  }

  const categoriesById = new Map<string, string>();
  const catsMap = (lookups?.supplierCategoriesMap || {}) as Record<string, unknown>;
  for (const supplierId of Object.keys(catsMap)) {
    const arr = Array.isArray((catsMap as any)[supplierId]) ? ((catsMap as any)[supplierId] as any[]) : [];
    for (const c of arr) {
      const cid = String((c as any)?.id || "").trim();
      if (!cid) continue;
      categoriesById.set(cid, String((c as any)?.name || ""));
    }
  }

  return { suppliersById, categoriesById, catsMap };
}

async function loadDetailsById(
  ids: string[],
  storeId?: string | null,
): Promise<Map<string, { product: Product; images: ProductImage[]; params: ProductParam[] }>> {
  const items = await ProductImportExportService.getProductsEditDataBatch(ids, storeId ? String(storeId) : undefined);
  const byDetailId = new Map<string, { product: Product; images: ProductImage[]; params: ProductParam[] }>();
  for (const it of items || []) {
    const pid = String(it?.product?.id || "");
    if (!pid) continue;
    byDetailId.set(pid, { product: it.product, images: it.images || [], params: it.params || [] });
  }
  return byDetailId;
}

function getMaxParams(ids: string[], byDetailId: Map<string, { params: ProductParam[] }>): number {
  let maxParams = 0;
  for (const id of ids) {
    const d = byDetailId.get(String(id));
    const cnt = Array.isArray(d?.params) ? d.params.length : 0;
    if (cnt > maxParams) maxParams = cnt;
  }
  return maxParams;
}

function buildLookupsRows(lookups: any, catsMap: Record<string, unknown>): LookupsExportRow[] {
  const lookupsRows: LookupsExportRow[] = [];
  for (const s of (lookups?.suppliers || []) as any[]) {
    lookupsRows.push({
      type: "supplier",
      id: String((s as any)?.id || ""),
      name: String((s as any)?.supplier_name || ""),
      external_id: "",
      supplier_id: "",
    });
  }
  for (const supplierId of Object.keys(catsMap)) {
    const arr = Array.isArray((catsMap as any)[supplierId]) ? ((catsMap as any)[supplierId] as any[]) : [];
    for (const c of arr) {
      lookupsRows.push({
        type: "category",
        id: String((c as any)?.id || ""),
        name: String((c as any)?.name || ""),
        external_id: String((c as any)?.external_id || ""),
        supplier_id: String((c as any)?.supplier_id || supplierId || ""),
      });
    }
  }
  return lookupsRows;
}

function buildMetaRows(storeId?: string | null): MetaExportRow[] {
  return [
    { key: "format", value: "v2" },
    { key: "store_id", value: storeId ? String(storeId) : "" },
    { key: "exported_at", value: new Date().toISOString() },
  ];
}

export async function buildFullExportData(args: {
  baseProducts: ProductAggregated[];
  storeId?: string | null;
}): Promise<{
  productRows: ProductExportRow[];
  productsColumns: string[];
  lookupsRows: LookupsExportRow[];
  metaRows: MetaExportRow[];
}> {
  const { ids, byId } = indexBaseProducts(args.baseProducts);
  if (ids.length === 0) {
    return { productRows: [], productsColumns: [], lookupsRows: [], metaRows: [] };
  }

  const lang = useI18nStore.getState().lang;
  const t = useI18nStore.getState().t;

  const lookups = await ProductImportExportService.getUserLookups();
  const { suppliersById, categoriesById, catsMap } = buildLookupsMaps(lookups);
  const byDetailId = await loadDetailsById(ids, args.storeId);
  const maxParams = getMaxParams(ids, byDetailId);

  const productsColumns = buildProductColumns(lang, maxParams);
  const productRows: ProductExportRow[] = [];
  for (const id of ids) {
    const d = byDetailId.get(String(id));
    if (!d) continue;
    const meta = byId.get(String(id));
    const supplierName = d.product.supplier_id != null ? suppliersById.get(String(d.product.supplier_id)) || "" : "";
    const categoryName = d.product.category_id != null ? categoriesById.get(String(d.product.category_id)) || "" : "";
    productRows.push(
      toProductExportRow({
        product: d.product,
        meta,
        categoryName,
        supplierName,
        lang,
        t,
        maxParams,
        params: d.params || [],
      }),
    );
  }

  const lookupsRows = buildLookupsRows(lookups, catsMap);
  const metaRows = buildMetaRows(args.storeId);

  return { productRows, productsColumns, lookupsRows, metaRows };
}

async function fetchAllBaseProducts(storeId: string | null): Promise<ProductAggregated[]> {
  const limit = 200;
  let offset = 0;
  let all: ProductAggregated[] = [];
  while (true) {
    const resp = await ProductImportExportService.getProductsPage(storeId, limit, offset);
    const pageProducts = Array.isArray(resp?.products) ? resp.products : [];
    all = [...all, ...pageProducts];
    const nextOffset = resp?.page?.nextOffset ?? null;
    const hasMore = !!resp?.page?.hasMore && nextOffset != null;
    if (!hasMore) break;
    offset = nextOffset;
  }
  return all;
}

export async function exportProducts(args: {
  format: "csv" | "xlsx";
  storeId: string | null;
  selectedProducts?: ProductAggregated[] | null;
}): Promise<{ mime: string; data: string | Blob }> {
  const selected = Array.isArray(args.selectedProducts) ? args.selectedProducts.filter(Boolean) : [];
  const baseProducts = selected.length > 0 ? selected : await fetchAllBaseProducts(args.storeId);
  const { productRows, productsColumns, lookupsRows, metaRows } = await buildFullExportData({
    baseProducts,
    storeId: args.storeId,
  });

  if (args.format === "csv") {
    return { mime: "text/csv;charset=utf-8", data: buildCsvFromRows(productRows, productsColumns) };
  }
  return {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: buildXlsxBlobFromSheets([
      { name: PRODUCTS_SHEET_NAME, rows: productRows, columns: productsColumns },
      { name: LOOKUPS_SHEET_NAME, rows: lookupsRows, columns: LOOKUPS_EXPORT_COLUMNS },
      { name: META_SHEET_NAME, rows: metaRows, columns: META_EXPORT_COLUMNS },
    ]),
  };
}
