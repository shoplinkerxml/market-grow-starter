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

export interface SupplierImportItem {
  id: string;
  run_id: string;
  external_id: string | null;
  status: string;
  error: string | null;
  payload: unknown;
  created_at: string;
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

  /** Max size of a manually uploaded XML file (50 MB). */
  static readonly MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

  /**
   * Upload an XML file and queue an import for it. Uses the very same mapping,
   * batching and per-supplier options as the scheduled auto-import job.
   */
  static async startImportFromFile(
    supplierId: number,
    file: File,
  ): Promise<StartImportResult> {
    if (!/\.(xml|yml)$/i.test(file.name)) {
      throw new Error("Only .xml files are supported");
    }
    if (file.size > XmlImportService.MAX_UPLOAD_BYTES) {
      throw new Error("File is too large");
    }

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${supplierId}/${Date.now()}-${safeName}`;

    // Upload raw bytes instead of a File/Blob. In some browser/storage-client
    // combinations a File is wrapped in multipart/form-data and the wrapper is
    // persisted as part of the object, which makes the resulting XML invalid.
    const fileBytes = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from("supplier-xml-uploads")
      .upload(path, fileBytes, {
        contentType: "application/xml",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    const { data, error } = await supabase.functions.invoke<StartImportResult>(
      "supplier-import-start",
      { body: { supplier_id: supplierId, trigger: "manual", storage_path: path } },
    );
    if (error) {
      // Don't leave orphaned uploads behind when queueing fails.
      await supabase.storage.from("supplier-xml-uploads").remove([path]);
      throw new Error(error.message);
    }
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

  /** List recent runs for the current user (across all suppliers). */
  static async listAllRuns(limit = 100): Promise<SupplierImportRun[]> {
    const { data, error } = await supabase
      .from("supplier_import_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupplierImportRun[];
  }

  /** List failed item rows for a run. */
  /** Delete a run (its item rows are removed automatically). */
  static async deleteRun(runId: string): Promise<void> {
    const { error } = await supabase
      .from("supplier_import_runs")
      .delete()
      .eq("id", runId);
    if (error) throw new Error(error.message);
  }

  static async listRunItems(runId: string, limit = 200): Promise<SupplierImportItem[]> {
    const { data, error } = await supabase
      .from("supplier_import_items")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupplierImportItem[];
  }
}