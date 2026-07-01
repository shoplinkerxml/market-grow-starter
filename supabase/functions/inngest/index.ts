import { Inngest, NonRetriableError } from "npm:inngest@^3";
import { serve } from "npm:inngest@^3/deno";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SaxesParser } from "npm:saxes@6";

// ---------------------------------------------------------------------------
// Inngest client + serve endpoint
// ---------------------------------------------------------------------------

export const inngest = new Inngest({ id: "marketgrow" });

const BATCH_SIZE = 500;
const MAX_XML_BYTES = 100 * 1024 * 1024; // 100 MB
const FETCH_TIMEOUT_MS = 60_000;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// YML / generic XML row normaliser
// ---------------------------------------------------------------------------

interface OfferRow {
  external_id: string;
  name: string | null;
  name_ua: string | null;
  description: string | null;
  price: number | null;
  price_old: number | null;
  currency_code: string | null;
  available: boolean;
  stock_quantity: number | null;
  vendor: string | null;
  article: string | null;
  category_external_id: string | null;
  pictures: string[];
  params: Array<{ name: string; value: string; unit: string | null }>;
}

function emptyOffer(externalId: string, availableAttr: string | null): OfferRow {
  return {
    external_id: externalId,
    name: null,
    name_ua: null,
    description: null,
    price: null,
    price_old: null,
    currency_code: null,
    available: availableAttr == null ? true : availableAttr !== "false",
    stock_quantity: null,
    vendor: null,
    article: null,
    category_external_id: null,
    pictures: [],
    params: [],
  };
}

function num(v: string | null): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Streaming XML parse — yields OfferRow batches via callback
// ---------------------------------------------------------------------------

async function streamParseYml(
  body: ReadableStream<Uint8Array>,
  onBatch: (rows: OfferRow[]) => Promise<void>,
  onProgress?: (totalSeen: number) => void,
): Promise<{ total: number }> {
  const parser = new SaxesParser({ xmlns: false });
  const decoder = new TextDecoder("utf-8");

  let current: OfferRow | null = null;
  let path: string[] = [];
  let textBuf = "";
  let currentParam: { name: string; unit: string | null } | null = null;
  const batch: OfferRow[] = [];
  let total = 0;
  let bytes = 0;

  let parseError: Error | null = null;
  parser.on("error", (e) => {
    parseError = e instanceof Error ? e : new Error(String(e));
  });

  parser.on("opentag", (node: { name: string; attributes: Record<string, string> }) => {
    const name = node.name.toLowerCase();
    path.push(name);
    textBuf = "";
    if (name === "offer") {
      current = emptyOffer(
        node.attributes["id"] ?? node.attributes["ID"] ?? "",
        node.attributes["available"] ?? null,
      );
    } else if (current && name === "param") {
      currentParam = {
        name: node.attributes["name"] ?? "",
        unit: node.attributes["unit"] ?? null,
      };
    }
  });

  parser.on("text", (t: string) => {
    textBuf += t;
  });
  parser.on("cdata", (t: string) => {
    textBuf += t;
  });

  const flush = async () => {
    if (!batch.length) return;
    const copy = batch.splice(0, batch.length);
    await onBatch(copy);
  };

  parser.on("closetag", (node: { name: string }) => {
    const name = node.name.toLowerCase();
    const value = textBuf.trim();
    textBuf = "";
    path.pop();

    if (current) {
      switch (name) {
        case "name":
          current.name = value || current.name;
          break;
        case "name_ua":
          current.name_ua = value || null;
          break;
        case "description":
          current.description = value || null;
          break;
        case "price":
          current.price = num(value);
          break;
        case "oldprice":
          current.price_old = num(value);
          break;
        case "currencyid":
          current.currency_code = value || null;
          break;
        case "vendor":
          current.vendor = value || null;
          break;
        case "vendorcode":
        case "article":
          current.article = value || null;
          break;
        case "categoryid":
          current.category_external_id = value || null;
          break;
        case "picture":
          if (value) current.pictures.push(value);
          break;
        case "stock_quantity":
        case "quantity_in_stock":
          current.stock_quantity = num(value);
          break;
        case "param":
          if (currentParam && value) {
            current.params.push({
              name: currentParam.name,
              value,
              unit: currentParam.unit,
            });
          }
          currentParam = null;
          break;
        case "offer":
          if (current.external_id) {
            batch.push(current);
            total += 1;
            if (onProgress && total % 500 === 0) onProgress(total);
          }
          current = null;
          break;
      }
    }
  });

  const reader = body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_XML_BYTES) {
      throw new NonRetriableError(`XML feed exceeds ${MAX_XML_BYTES} bytes`);
    }
    parser.write(decoder.decode(value, { stream: true }));
    if (parseError) throw parseError;
    while (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }
  parser.write(decoder.decode());
  parser.close();
  if (parseError) throw parseError;
  await flush();
  if (onProgress) onProgress(total);
  return { total };
}

// ---------------------------------------------------------------------------
// Inngest function: supplier-import
// ---------------------------------------------------------------------------

interface ImportEvent {
  data: {
    run_id: string;
    user_id: string;
    supplier_id: number;
    xml_url: string;
    trigger: "manual" | "scheduled";
  };
}

const supplierImport = inngest.createFunction(
  {
    id: "supplier-import",
    name: "Supplier XML import",
    concurrency: [{ key: "event.data.supplier_id", limit: 1 }],
    throttle: { limit: 10, period: "1m", key: "event.data.user_id" },
    retries: 3,
  },
  { event: "supplier/import.requested" },
  async ({ event, step, logger }: { event: ImportEvent; step: any; logger: any }) => {
    const { run_id, user_id, supplier_id, xml_url } = event.data;
    const sb = adminClient();

    // --- 1. acquire-lock: mark run as running ------------------------------
    await step.run("acquire-lock", async () => {
      const { data, error } = await sb
        .from("supplier_import_runs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", run_id)
        .in("status", ["queued"])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new NonRetriableError(`Run ${run_id} is not queued`);
      return { ok: true };
    });

    // --- 2. fetch-xml ------------------------------------------------------
    const fetchMeta = await step.run("fetch-headers", async () => {
      const { data: sup } = await sb
        .from("user_suppliers")
        .select("xml_etag, xml_last_modified")
        .eq("id", supplier_id)
        .maybeSingle();
      return {
        etag: sup?.xml_etag ?? null,
        lastModified: sup?.xml_last_modified ?? null,
      };
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(xml_url, {
          headers: {
            ...(fetchMeta.etag ? { "If-None-Match": fetchMeta.etag } : {}),
            ...(fetchMeta.lastModified
              ? { "If-Modified-Since": fetchMeta.lastModified }
              : {}),
            "User-Agent": "MarketGrowImport/1.0",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 304) {
        await sb
          .from("supplier_import_runs")
          .update({
            status: "succeeded",
            finished_at: new Date().toISOString(),
            skipped_count: 0,
            total_rows: 0,
            error: "not-modified",
          })
          .eq("id", run_id);
        return { skipped: true };
      }
      if (!res.ok || !res.body) {
        throw new NonRetriableError(
          `Fetch failed [${res.status}] ${res.statusText}`,
        );
      }

      const newEtag = res.headers.get("etag");
      const newLastModified = res.headers.get("last-modified");

      // --- 3. stream-parse + upsert batches --------------------------------
      let processed = 0;
      let created = 0;
      let updated = 0;
      let failed = 0;
      let batchIndex = 0;

      const { total } = await streamParseYml(
        res.body,
        async (rows) => {
          const idx = batchIndex++;
          const result = await step.run(`upsert-batch-${idx}`, async () => {
            const { data, error } = await sb.rpc(
              "supplier_import_upsert_batch",
              {
                p_run_id: run_id,
                p_user_id: user_id,
                p_supplier_id: supplier_id,
                p_rows: rows,
              },
            );
            if (error) {
              // RPC missing (step 5 not deployed yet) → soft-fail this run.
              if ((error as any).code === "PGRST202" || /not find the function/i.test(error.message)) {
                throw new NonRetriableError(
                  "RPC supplier_import_upsert_batch is not deployed yet (step 5).",
                );
              }
              throw error;
            }
            return data as {
              created: number;
              updated: number;
              failed: number;
            };
          });
          processed += rows.length;
          created += result?.created ?? 0;
          updated += result?.updated ?? 0;
          failed += result?.failed ?? 0;

          await sb
            .from("supplier_import_runs")
            .update({
              processed_rows: processed,
              created_count: created,
              updated_count: updated,
              failed_count: failed,
            })
            .eq("id", run_id);
        },
        (seen) => logger?.info?.("import.progress", { run_id, seen }),
      );

      // --- 4. finalize -----------------------------------------------------
      await step.run("finalize", async () => {
        const finishedAt = new Date().toISOString();
        await sb
          .from("supplier_import_runs")
          .update({
            status: failed > 0 && processed === 0 ? "failed" : "succeeded",
            finished_at: finishedAt,
            total_rows: total,
            processed_rows: processed,
            created_count: created,
            updated_count: updated,
            failed_count: failed,
          })
          .eq("id", run_id);

        await sb
          .from("user_suppliers")
          .update({
            last_import_at: finishedAt,
            last_import_run_id: run_id,
            xml_etag: newEtag,
            xml_last_modified: newLastModified,
          })
          .eq("id", supplier_id);
      });

      return { total, created, updated, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await sb
        .from("supplier_import_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", run_id);
      throw err;
    }
  },
);

// ---------------------------------------------------------------------------
// Inngest function: supplier-import-scheduler
// ---------------------------------------------------------------------------

interface SupplierImportDue {
  id: number;
  user_id: string;
  xml_feed_url: string;
}

async function queueSupplierImport(
  supplier: SupplierImportDue,
  trigger: "manual" | "scheduled",
): Promise<{ run_id: string } | null> {
  const sb = adminClient();

  const { data: activeRun } = await sb
    .from("supplier_import_runs")
    .select("id")
    .eq("supplier_id", supplier.id)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  if (activeRun) return null;

  const { data: run, error } = await sb
    .from("supplier_import_runs")
    .insert({
      user_id: supplier.user_id,
      supplier_id: supplier.id,
      trigger,
      status: "queued",
      xml_url: supplier.xml_feed_url,
    })
    .select("id")
    .single();
  if (error || !run) throw error;

  const minuteIso = new Date().toISOString().slice(0, 16);
  await inngest.send({
    id: `import:${supplier.id}:${minuteIso}`,
    name: "supplier/import.requested",
    data: {
      run_id: run.id,
      user_id: supplier.user_id,
      supplier_id: supplier.id,
      xml_url: supplier.xml_feed_url,
      trigger,
    },
  });

  return { run_id: run.id };
}

const supplierImportScheduler = inngest.createFunction(
  { id: "supplier-import-scheduler", name: "Supplier import scheduler" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const due = await step.run("scan-suppliers", async () => {
      const sb = adminClient();
      const { data, error } = await sb.rpc("supplier_import_due_suppliers");
      if (error) throw error;
      return (data ?? []) as SupplierImportDue[];
    });

    const results = await step.run("queue-imports", async () => {
      const queued: Array<{ supplier_id: number; run_id: string }> = [];
      for (const supplier of due) {
        try {
          const result = await queueSupplierImport(supplier, "scheduled");
          if (result) {
            queued.push({ supplier_id: supplier.id, run_id: result.run_id });
          }
        } catch (err) {
          logger?.error?.("scheduler.queue-failed", {
            supplier_id: supplier.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return queued;
    });

    return { queued: results.length };
  },
);

// ---------------------------------------------------------------------------
// Inngest function: supplier-import-cleanup
// ---------------------------------------------------------------------------

const supplierImportCleanup = inngest.createFunction(
  { id: "supplier-import-cleanup", name: "Supplier import cleanup" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const cutoffItems = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cutoffRuns = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { deletedItems } = await step.run("cleanup-items", async () => {
      const sb = adminClient();
      const { error } = await sb
        .from("supplier_import_items")
        .delete()
        .lt("created_at", cutoffItems);
      if (error) throw error;
      // No RETURNING count via JS client; report by re-querying.
      const { count } = await sb
        .from("supplier_import_items")
        .select("*", { count: "exact", head: true });
      return { deletedItems: count };
    });

    const { deletedRuns } = await step.run("cleanup-runs", async () => {
      const sb = adminClient();
      const { error } = await sb
        .from("supplier_import_runs")
        .delete()
        .lt("created_at", cutoffRuns);
      if (error) throw error;
      const { count } = await sb
        .from("supplier_import_runs")
        .select("*", { count: "exact", head: true });
      return { deletedRuns: count };
    });

    return { deletedItems, deletedRuns };
  },
);

export default serve({
  client: inngest,
  functions: [supplierImport, supplierImportScheduler, supplierImportCleanup],
});