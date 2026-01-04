import type { ProductParam } from "@/lib/product-service";
import { ProductBulkImportService } from "@/lib/product-bulk-import-service";
import { parseCsvRow } from "./csv";
import { readXlsxToSheets } from "./xlsx";
import { PRODUCTS_SHEET_NAME } from "./constants";

export type ImportRow = {
  index: number;
  data: Record<string, string>;
  ok: boolean;
  errors: string[];
};

function normalizeStr(v: string | undefined): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function parseProductStateLegacy(v: string | undefined): string | undefined {
  const s = normalizeStr(v);
  if (!s) return undefined;
  if (["new", "stock", "used", "refurbished", "archived"].includes(s)) return s;
  if (["новий", "новый"].includes(s)) return "new";
  if (["уцінений", "уцененный"].includes(s)) return "stock";
  if (["вживаний", "б/у", "бу"].includes(s)) return "used";
  if (["відновлений", "восстановленный"].includes(s)) return "refurbished";
  if (["архівний", "архивный"].includes(s)) return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  if (s === "new") return "new";
  if (s === "stock") return "stock";
  if (s === "used") return "used";
  if (s === "refurbished") return "refurbished";
  if (s === "archived") return "archived";
  return undefined;
}

function parseProductState(v: string | undefined): string | undefined {
  const s = normalizeStr(v);
  if (!s) return undefined;
  if (["new", "stock", "used", "refurbished", "archived"].includes(s)) return s;
  if (["новий", "новый"].includes(s)) return "new";
  if (["уцінений", "уцененный"].includes(s)) return "stock";
  if (["вживаний", "б/у", "бу"].includes(s)) return "used";
  if (["відновлений", "восстановленный"].includes(s)) return "refurbished";
  if (["архівний", "архивный"].includes(s)) return "archived";
  return undefined;
}

function extractParamsFromProductRow(d: Record<string, string>): { hasParamColumns: boolean; params: ProductParam[] } {
  const keys = Object.keys(d || {});
  let maxIndex = 0;
  let has = false;

  for (const k of keys) {
    const m = /^(Характеристика|Characteristic|Значення|Value|Значение)\s+(\d+)$/i.exec(String(k || "").trim());
    if (!m) continue;
    const idx = Number(m[2]);
    if (!Number.isFinite(idx) || idx <= 0) continue;
    has = true;
    if (idx > maxIndex) maxIndex = idx;
  }

  const params: ProductParam[] = [];
  for (let i = 1; i <= maxIndex; i++) {
    const name = String(readCell(d, [`Характеристика ${i}`, `Characteristic ${i}`])).trim();
    const value = String(readCell(d, [`Значення ${i}`, `Value ${i}`, `Значение ${i}`])).trim();
    if (!name) continue;
    params.push({ name, value, order_index: params.length });
  }

  return { hasParamColumns: has, params };
}

function asNullableNumber(v: string | undefined): number | null | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function asNullableString(v: string | undefined): string | null | undefined {
  if (v == null) return undefined;
  const s = String(v);
  if (!s.trim()) return undefined;
  return s;
}

function asNullableBoolean(v: string | undefined): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  if (["1", "true", "yes", "y", "так", "да"].includes(s)) return true;
  if (["0", "false", "no", "n", "ні", "нет"].includes(s)) return false;
  return undefined;
}

function readCell(d: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      const raw = d[k];
      if (raw != null && String(raw).trim() !== "") return String(raw);
    }
  }
  const k0 = keys[0];
  if (k0 && Object.prototype.hasOwnProperty.call(d, k0)) return String(d[k0] ?? "");
  return "";
}

function readProductIdCell(d: Record<string, string>): string {
  return String(readCell(d, ["ID", "Product ID", "product_id", "productId", "id"])).trim();
}

export function validateImportRows(rows: Array<Record<string, string>>, t: (k: string) => string): ImportRow[] {
  const out: ImportRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const errors: string[] = [];

    const productId = readProductIdCell(r);
    const externalId = String(readCell(r, ["Зовнішній ID", "External ID", "Внешний ID", "external_id"])).trim();
    const name = String(readCell(r, ["Name", "Назва", "Название", "name"])).trim();
    if (!productId && !externalId) errors.push(t("import_export_missing_external_id"));
    if (!productId && !name) errors.push(t("import_export_missing_name"));

    out.push({ index: i, data: r, ok: errors.length === 0, errors });
  }
  return out;
}

export async function readImportFileToRows(file: File): Promise<Array<Record<string, string>>> {
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".xlsx")) {
    const sheets = await readXlsxToSheets(file);
    const products = sheets[PRODUCTS_SHEET_NAME] || sheets[Object.keys(sheets)[0] || ""] || [];
    return products;
  }
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCsvRow(lines[0]).map((h) => h.trim());
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      const r: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const key = String(headers[j] || "").trim();
        if (!key) continue;
        r[key] = cols[j] == null ? "" : String(cols[j]);
      }
      rows.push(r);
    }
    return rows;
  }
  return [];
}

export async function readImportFile(file: File): Promise<{ products: Array<Record<string, string>> }> {
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".xlsx")) {
    const sheets = await readXlsxToSheets(file);
    const products = sheets[PRODUCTS_SHEET_NAME] || [];
    return { products };
  }
  const products = await readImportFileToRows(file);
  return { products };
}

export async function importProducts(args: {
  jobId: string;
  rows: ImportRow[];
  effectiveStoreId: string | null;
}): Promise<{ created: number; updated: number; skipped: number }> {
  const rows = (args.rows || []).map((r) => (r?.data || {})).filter(Boolean);
  const res = await ProductBulkImportService.importRows({ jobId: args.jobId, storeId: args.effectiveStoreId, rows });
  return { created: Number(res.created || 0), updated: Number(res.updated || 0), skipped: Number(res.skipped || 0) };
}
