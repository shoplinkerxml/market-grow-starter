import { toast } from "sonner";

import { buildCsvFromRows, parseCsvRow } from "@/components/user/products/ProductsTable/ImportExport/csv";
import { downloadBlob, downloadText } from "@/components/user/products/ProductsTable/ImportExport/file";

import type { ProductParam } from "./ParametersDataTable";

export const PARAMS_EXPORT_COLUMNS = ["name", "value", "paramid", "valueid", "order_index"] as const;

function normalizeRows(rows: ProductParam[]) {
  return (rows || []).map((r, idx) => ({
    name: String(r?.name ?? ""),
    value: String(r?.value ?? ""),
    paramid: r?.paramid ? String(r.paramid) : "",
    valueid: r?.valueid ? String(r.valueid) : "",
    order_index: typeof r?.order_index === "number" ? r.order_index : idx,
  }));
}

export async function exportParams(args: { data: ProductParam[]; format: "csv" | "json" | "xlsx" }) {
  const rows = normalizeRows(args.data);

  if (args.format === "csv") {
    const csv = buildCsvFromRows(rows, PARAMS_EXPORT_COLUMNS);
    await downloadText(csv, "product-params.csv", "text/csv;charset=utf-8");
    return;
  }

  if (args.format === "json") {
    const json = JSON.stringify(rows, null, 2);
    await downloadText(json, "product-params.json", "application/json;charset=utf-8");
    return;
  }

  const { buildXlsxBlobFromRows } = await import("@/components/user/products/ProductsTable/ImportExport/xlsx");
  const blob = buildXlsxBlobFromRows(rows, PARAMS_EXPORT_COLUMNS, "params");
  await downloadBlob(blob, "product-params.xlsx");
}

export async function readParamsFromFile(args: { file: File; t: (k: string) => string }): Promise<ProductParam[]> {
  const name = String(args.file?.name || "").toLowerCase();
  let rows: ProductParam[] = [];

  if (name.endsWith(".xlsx")) {
    const { readXlsxToRows } = await import("@/components/user/products/ProductsTable/ImportExport/xlsx");
    const sheetRows = await readXlsxToRows(args.file);
    rows = (sheetRows || [])
      .map((r, idx) => {
        const normalized: Record<string, string> = {};
        for (const k of Object.keys(r || {})) normalized[String(k).toLowerCase().trim()] = String((r as any)[k] ?? "");
        const orderRaw = normalized["order_index"] ?? normalized["order"] ?? "";
        const orderIndex = Number(orderRaw);
        return {
          name: String(normalized["name"] ?? ""),
          value: String(normalized["value"] ?? ""),
          paramid: String(normalized["paramid"] ?? ""),
          valueid: String(normalized["valueid"] ?? ""),
          order_index: Number.isFinite(orderIndex) ? orderIndex : idx,
        };
      })
      .filter((r) => (r.name || "").trim().length > 0 || (r.value || "").trim().length > 0);
    return rows;
  }

  if (name.endsWith(".json") || name.endsWith(".jsonl") || name.endsWith(".ndjson")) {
    const text = await args.file.text();
    const trimmed = text.trim();
    try {
      if (trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rows = parsed.map((p: unknown, idx: number) => {
            const obj = p as Record<string, unknown>;
            return {
              name: String(obj?.name ?? ""),
              value: String(obj?.value ?? ""),
              paramid: obj?.paramid ? String(obj.paramid as string) : "",
              valueid: obj?.valueid ? String(obj.valueid as string) : "",
              order_index: typeof obj?.order_index === "number" ? (obj.order_index as number) : idx,
            };
          });
        }
      } else {
        const lines = trimmed
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        rows = lines
          .map((line, idx) => {
            const obj = JSON.parse(line) as Record<string, unknown>;
            return {
              name: String(obj?.name ?? ""),
              value: String(obj?.value ?? ""),
              paramid: obj?.paramid ? String(obj.paramid as string) : "",
              valueid: obj?.valueid ? String(obj.valueid as string) : "",
              order_index: typeof obj?.order_index === "number" ? (obj.order_index as number) : idx,
            };
          })
          .filter((r) => (r.name || "").trim().length > 0 || (r.value || "").trim().length > 0);
      }
    } catch {
      toast.error(args.t("validation_error"));
      return [];
    }

    return rows.filter((r) => (r.name || "").trim().length > 0 || (r.value || "").trim().length > 0);
  }

  if (name.endsWith(".csv")) {
    const text = await args.file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
    const idxName = header.indexOf("name");
    const idxValue = header.indexOf("value");
    const idxParamId = header.indexOf("paramid");
    const idxValueId = header.indexOf("valueid");
    const idxOrder = header.indexOf("order_index");

    if (idxName < 0 || idxValue < 0) {
      toast.error(args.t("validation_error"));
      return [];
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      rows.push({
        name: String(cols[idxName] || ""),
        value: String(cols[idxValue] || ""),
        paramid: idxParamId >= 0 ? String(cols[idxParamId] || "") : "",
        valueid: idxValueId >= 0 ? String(cols[idxValueId] || "") : "",
        order_index: idxOrder >= 0 ? Number(cols[idxOrder] || i - 1) || (i - 1) : i - 1,
      });
    }

    return rows.filter((r) => (r.name || "").trim().length > 0 || (r.value || "").trim().length > 0);
  }

  toast.error(args.t("invalid_file_type"));
  return [];
}
