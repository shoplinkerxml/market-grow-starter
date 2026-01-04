import * as XLSX from "xlsx";

export async function readXlsxToRows(file: File): Promise<Array<Record<string, string>>> {
  const sheets = await readXlsxToSheets(file);
  const firstName = Object.keys(sheets)[0] || "";
  return firstName ? sheets[firstName] : [];
}

export async function readXlsxToSheets(file: File): Promise<Record<string, Array<Record<string, string>>>> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const out: Record<string, Array<Record<string, string>>> = {};
  for (const name of workbook.SheetNames || []) {
    const sheet = name ? workbook.Sheets?.[name] : null;
    const parsed = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }) : [];
    out[name] = (parsed || []).map((obj) => {
      const r: Record<string, string> = {};
      for (const k of Object.keys(obj || {})) {
        r[k] = (obj as any)[k] == null ? "" : String((obj as any)[k]);
      }
      return r;
    });
  }
  return out;
}

export function buildXlsxBlobFromRows(rows: Array<Record<string, unknown>>, columns: readonly string[], sheetName: string): Blob {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...columns] });
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function buildXlsxBlobFromSheets(sheets: Array<{ name: string; rows: Array<Record<string, unknown>>; columns?: readonly string[] }>): Blob {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const cols = Array.isArray(s.columns) ? [...s.columns] : undefined;
    const ws = XLSX.utils.json_to_sheet(s.rows, cols ? { header: cols } : undefined);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
