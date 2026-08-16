import { Inngest, NonRetriableError } from "npm:inngest@^3";
import { serve } from "npm:inngest@^3/deno/fresh";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SaxesParser } from "npm:saxes@6";

// ---------------------------------------------------------------------------
// Mapping types (mirror of src/lib/xml-mapping-defaults.ts)
// ---------------------------------------------------------------------------

type FieldMap = string | string[];
interface XmlMapping {
  xpath_item: string;
  fields: Record<string, FieldMap | undefined>;
  images: { tag: string };
  params: { tag: string; name_attr: string; unit_attr?: string };
  category: Record<string, unknown>;
  currency: string | null;
}

const DEFAULT_MAPPING: XmlMapping = {
  xpath_item: "offer",
  fields: {
    name: "name",
    name_ua: "name_ua",
    description: "description",
    price: "price",
    price_old: "oldprice",
    currency_code: "currencyid",
    vendor: "vendor",
    article: ["vendorcode", "article"],
    category_external_id: "categoryid",
    stock_quantity: ["stock_quantity", "quantity_in_stock"],
  },
  images: { tag: "picture" },
  params: { tag: "param", name_attr: "name", unit_attr: "unit" },
  category: {},
  currency: null,
};

// Build a lowercase XML-tag -> target-field lookup from mapping.fields.
function buildTagIndex(mapping: XmlMapping): Map<string, keyof OfferRow> {
  const idx = new Map<string, keyof OfferRow>();
  for (const [target, tags] of Object.entries(mapping.fields)) {
    if (!tags) continue;
    const list = Array.isArray(tags) ? tags : [tags];
    for (const tag of list) {
      if (!tag) continue;
      idx.set(String(tag).toLowerCase(), target as keyof OfferRow);
    }
  }
  return idx;
}

async function loadMapping(
  sb: ReturnType<typeof adminClient>,
  supplierId: number,
): Promise<XmlMapping> {
  const { data } = await sb
    .from("supplier_xml_mappings")
    .select("xpath_item, fields, images, params, category, currency")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_MAPPING;
  return {
    xpath_item: data.xpath_item || DEFAULT_MAPPING.xpath_item,
    fields: (data.fields as XmlMapping["fields"]) || DEFAULT_MAPPING.fields,
    images: (data.images as XmlMapping["images"]) || DEFAULT_MAPPING.images,
    params: (data.params as XmlMapping["params"]) || DEFAULT_MAPPING.params,
    category: (data.category as Record<string, unknown>) || {},
    currency: (data.currency as string | null) ?? null,
  };
}

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
  mapping: XmlMapping = DEFAULT_MAPPING,
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

  const itemTag = (mapping.xpath_item || "offer").toLowerCase();
  const imageTag = (mapping.images?.tag || "picture").toLowerCase();
  const paramTag = (mapping.params?.tag || "param").toLowerCase();
  const paramNameAttr = mapping.params?.name_attr || "name";
  const paramUnitAttr = mapping.params?.unit_attr || "unit";
  const tagIndex = buildTagIndex(mapping);
  const defaultCurrency = mapping.currency || null;

  let parseError: Error | null = null;
  parser.on("error", (e) => {
    parseError = e instanceof Error ? e : new Error(String(e));
  });

  parser.on("opentag", (node: { name: string; attributes: Record<string, string> }) => {
    const name = node.name.toLowerCase();
    path.push(name);
    textBuf = "";
    if (name === itemTag) {
      current = emptyOffer(
        node.attributes["id"] ?? node.attributes["ID"] ?? "",
        node.attributes["available"] ?? null,
      );
      if (current && defaultCurrency) current.currency_code = defaultCurrency;
    } else if (current && name === paramTag) {
      currentParam = {
        name: node.attributes[paramNameAttr] ?? "",
        unit: node.attributes[paramUnitAttr] ?? null,
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
      if (name === itemTag) {
        if (current.external_id) {
          batch.push(current);
          total += 1;
          if (onProgress && total % 500 === 0) onProgress(total);
        }
        current = null;
      } else if (name === imageTag) {
        if (value) current.pictures.push(value);
      } else if (name === paramTag) {
        if (currentParam && value) {
          current.params.push({
            name: currentParam.name,
            value,
            unit: currentParam.unit,
          });
        }
        currentParam = null;
      } else {
        const target = tagIndex.get(name);
        if (target) {
          switch (target) {
            case "price":
            case "price_old":
            case "stock_quantity":
              (current as unknown as Record<string, unknown>)[target] = num(value);
              break;
            case "available":
              current.available = value !== "false";
              break;
            default:
              (current as unknown as Record<string, unknown>)[target] = value || null;
              break;
          }
        }
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
    /** "upload" when the XML came from a user-uploaded file instead of the feed URL. */
    source?: "url" | "upload";
    storage_path?: string | null;
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
    const isUpload = event.data.source === "upload";
    const storagePath = event.data.storage_path ?? null;
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
        .select("xml_etag, xml_last_modified, mark_missing_unavailable")
        .eq("id", supplier_id)
        .maybeSingle();
      return {
        etag: sup?.xml_etag ?? null,
        lastModified: sup?.xml_last_modified ?? null,
        markMissingUnavailable: !!sup?.mark_missing_unavailable,
      };
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(xml_url, {
          headers: {
            ...(!isUpload && fetchMeta.etag
              ? { "If-None-Match": fetchMeta.etag }
              : {}),
            ...(!isUpload && fetchMeta.lastModified
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
        await loadMapping(sb, supplier_id),
      );

      // --- 4. finalize -----------------------------------------------------
      await step.run("finalize", async () => {
        const finishedAt = new Date().toISOString();
        // Mark products missing from the feed as unavailable (opt-in per supplier).
        // Guard: only when we actually processed rows and at least one succeeded.
        if (
          fetchMeta.markMissingUnavailable &&
          processed > 0 &&
          created + updated > 0
        ) {
          const { data: runRow } = await sb
            .from("supplier_import_runs")
            .select("started_at")
            .eq("id", run_id)
            .maybeSingle();
          const startedAt = runRow?.started_at;
          if (startedAt) {
            await sb
              .from("store_products")
              .update({ available: false, updated_at: new Date().toISOString() })
              .eq("user_id", user_id)
              .eq("supplier_id", supplier_id)
              .eq("available", true)
              .lt("updated_at", startedAt);
          }
        }
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
            // Uploaded files must not overwrite the feed URL's cache validators.
            ...(isUpload
              ? {}
              : { xml_etag: newEtag, xml_last_modified: newLastModified }),
          })
          .eq("id", supplier_id);

        // Housekeeping: remove the uploaded file once it has been processed.
        if (isUpload && storagePath) {
          try {
            await sb.storage.from("supplier-xml-uploads").remove([storagePath]);
          } catch (_e) { /* non-fatal */ }
        }
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
      const { data, error } = await sb
        .from("user_suppliers")
        .select("id, user_id, xml_feed_url, last_import_at, import_frequency_hours")
        .eq("import_enabled", true)
        .gt("import_frequency_hours", 0)
        .order("last_import_at", { ascending: true, nullsFirst: true })
        .limit(100);
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((s) => {
        if (!s.last_import_at) return true;
        const elapsed = now - new Date(s.last_import_at).getTime();
        return elapsed >= (s.import_frequency_hours ?? 0) * 3600000;
      }) as SupplierImportDue[];
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
          console.error("scheduler queue failed", supplier.id, err);
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

const handler = serve({
  client: inngest,
  functions: [supplierImport, supplierImportScheduler, supplierImportCleanup],
  serveHost: `https://${Deno.env.get("SUPABASE_URL")?.replace(/^https?:\/\//, "")}`,
  servePath: "/functions/v1/inngest",
});

Deno.serve((req) => handler(req));