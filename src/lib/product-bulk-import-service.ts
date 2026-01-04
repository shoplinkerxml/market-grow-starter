import { supabase } from "@/integrations/supabase/client";
import { invokeSupabaseFunctionWithRetry } from "@/lib/request-handler";
import { withValidSession } from "@/lib/session-validation";

export type BulkImportResult = { job_id: string; created: number; updated: number; skipped: number };

export class ProductBulkImportService {
  static async importRows(args: { jobId: string; storeId: string | null; rows: Array<Record<string, string>> }): Promise<BulkImportResult> {
    const jobId = String(args.jobId || "").trim();
    if (!jobId) throw new Error("job_id_required");

    const rows = Array.isArray(args.rows) ? args.rows : [];
    if (rows.length === 0) throw new Error("rows_required");

    return await withValidSession(async ({ accessToken }) => {
      const { data, error } = await invokeSupabaseFunctionWithRetry<BulkImportResult | string>(
        supabase.functions.invoke.bind(supabase.functions) as any,
        "bulk-import-products",
        {
          body: {
            job_id: jobId,
            store_id: args.storeId != null ? String(args.storeId) : null,
            rows,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        { timeoutMs: 240_000, maxRetries: 0 },
      );

      if (error) throw error;
      return typeof data === "string" ? (JSON.parse(data) as BulkImportResult) : (data as BulkImportResult);
    });
  }
}

