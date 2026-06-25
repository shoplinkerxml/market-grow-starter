import { supabase } from "@/integrations/supabase/client";

export interface StartImportResult {
  run_id: string;
  status: string;
}

export interface SupplierImportRun {
  id: string;
  user_id: string;
  supplier_id: number;
  trigger: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | string;
  xml_url: string | null;
  total_rows: number | null;
  processed_rows: number | null;
  created_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  failed_count: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export class XmlImportService {
  /**
   * Queue an XML import for a supplier. Returns the created run id.
   * Throws on validation, auth, or queueing errors.
   */
  static async startImport(
    supplierId: number,
    trigger: "manual" | "scheduled" = "manual",
  ): Promise<StartImportResult> {
    const { data, error } = await supabase.functions.invoke<StartImportResult>(
      "supplier-import-start",
      { body: { supplier_id: supplierId, trigger } },
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Empty response from supplier-import-start");
    return data;
  }

  /** Fetch the most recent import runs for a supplier (default 20). */
  static async listRuns(
    supplierId: number,
    limit = 20,
  ): Promise<SupplierImportRun[]> {
    const { data, error } = await supabase
      .from("supplier_import_runs")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupplierImportRun[];
  }

  /** Fetch a single run by id. */
  static async getRun(runId: string): Promise<SupplierImportRun | null> {
    const { data, error } = await supabase
      .from("supplier_import_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as SupplierImportRun | null) ?? null;
  }
}