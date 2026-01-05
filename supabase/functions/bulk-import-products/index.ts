import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const jsonResponse = (body: unknown, status = 200) => 
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

// Константы
const BATCH_SIZE = 50;
const MAX_ROWS = 50000;
const PROGRESS_UPDATE_INTERVAL = 50;

type Row = Record<string, string>;
type Body = {
  job_id?: string;
  store_id?: string | null;
  rows?: Row[];
};

type ImportError = {
  row: number;
  external_id?: string;
  error: string;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  try {
    const s = JSON.stringify(error);
    return typeof s === "string" && s !== "{}" ? s : "Unknown error";
  } catch {
    return "Unknown error";
  }
}

function readCell(d: Row, keys: string[]): string {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      const raw = d[k];
      if (raw != null && String(raw).trim() !== "") return String(raw);
    }
  }
  return "";
}

function normalizeStr(v: string | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

function asNullableNumber(v: string | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function asOptionalNumber(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function asOptionalBoolean(v: string | undefined): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  if (["1", "true", "yes", "y", "так", "да"].includes(s)) return true;
  if (["0", "false", "no", "n", "ні", "нет"].includes(s)) return false;
  return undefined;
}

function parseProductState(v: string | undefined): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  
  const stateMap: Record<string, string> = {
    "new": "new", "stock": "stock", "used": "used",
    "refurbished": "refurbished", "archived": "archived",
    "новий": "new", "новый": "new",
    "уцінений": "stock", "уцененный": "stock",
    "вживаний": "used", "б/у": "used", "бу": "used",
    "відновлений": "refurbished", "восстановленный": "refurbished",
    "архівний": "archived", "архивный": "archived"
  };
  
  return stateMap[s] || null;
}

function validateProductData(
  data: Record<string, unknown>,
  opts: { requireName: boolean },
): { valid: boolean; error?: string } {
  const name = data.name;
  if (opts.requireName) {
    if (!name || String(name).trim().length < 2) {
      return { valid: false, error: "Назва повинна містити мінімум 2 символи" };
    }
  } else if (name !== undefined) {
    if (!String(name).trim() || String(name).trim().length < 2) {
      return { valid: false, error: "Назва повинна містити мінімум 2 символи" };
    }
  }

  if (data.price !== undefined && data.price !== null && (Number(data.price) < 0 || !Number.isFinite(Number(data.price)))) {
    return { valid: false, error: "Некоректна ціна" };
  }

  if (data.stock_quantity !== undefined && data.stock_quantity !== null && Number(data.stock_quantity) < 0) {
    return { valid: false, error: "Некоректна кількість на складі" };
  }

  return { valid: true };
}

async function preloadReferences(supabase: any, userId: string, storeIds: string[]) {
  try {
    const [suppliersResult, categoriesResult] = await Promise.all([
      supabase
        .from("user_suppliers")
        .select("id,supplier_name")
        .eq("user_id", userId),
      supabase
        .from("store_categories")
        .select("id,name,supplier_id")
        .in("store_id", storeIds)
    ]);

    if (suppliersResult.error) {
      console.error("Error loading suppliers:", suppliersResult.error);
    }
    if (categoriesResult.error) {
      console.error("Error loading categories:", categoriesResult.error);
    }

    const supplierByName = new Map<string, number>();
    for (const s of suppliersResult.data || []) {
      const name = normalizeStr(s.supplier_name);
      if (name) supplierByName.set(name, s.id);
    }

    const categoriesBySupplierId = new Map<number, Map<string, number>>();
    const categoriesGlobal = new Map<string, number>();
    
    for (const c of categoriesResult.data || []) {
      const name = normalizeStr(c.name);
      if (!name) continue;
      
      if (c.supplier_id) {
        const m = categoriesBySupplierId.get(c.supplier_id) || new Map();
        m.set(name, c.id);
        categoriesBySupplierId.set(c.supplier_id, m);
      }
      
      if (!categoriesGlobal.has(name)) {
        categoriesGlobal.set(name, c.id);
      }
    }

    return { supplierByName, categoriesBySupplierId, categoriesGlobal };
  } catch (error) {
    console.error("Error in preloadReferences:", error);
    throw error;
  }
}

async function preloadExistingProducts(
  supabase: any, 
  storeIds: string[], 
  productIds: string[]
): Promise<Map<string, { id: string; store_id: string }>> {
  const existingProducts = new Map();
  
  try {
    for (let i = 0; i < productIds.length; i += 100) {
      const batch = productIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("store_products")
        .select("id,store_id")
        .in("id", batch)
        .in("store_id", storeIds);
      
      if (error) {
        console.error("Error loading existing products:", error);
        continue;
      }
      
      for (const p of data || []) {
        if (p?.id) {
          existingProducts.set(String(p.id), { 
            id: String(p.id), 
            store_id: String(p.store_id) 
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in preloadExistingProducts:", error);
  }
  
  return existingProducts;
}

async function preloadExistingProductsByExternalId(
  supabase: any,
  storeId: string,
  externalIds: string[],
): Promise<Map<string, { id: string; store_id: string }>> {
  const byExternalId = new Map<string, { id: string; store_id: string }>();

  try {
    for (let i = 0; i < externalIds.length; i += 100) {
      const batch = externalIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from("store_products")
        .select("id,store_id,external_id")
        .eq("store_id", storeId)
        .in("external_id", batch);

      if (error) {
        console.error("Error loading products by external_id:", error);
        continue;
      }

      for (const p of data || []) {
        if (!p?.external_id || !p?.id) continue;
        const ext = String(p.external_id).trim();
        if (!ext) continue;
        byExternalId.set(ext, { 
          id: String(p.id), 
          store_id: String(p.store_id) 
        });
      }
    }
  } catch (error) {
    console.error("Error in preloadExistingProductsByExternalId:", error);
  }

  return byExternalId;
}

type ParsedParams = { 
  hasParamColumns: boolean; 
  params: Array<{ name: string; value: string; order_index: number }> 
};

function extractParamsFromProductRow(d: Row): ParsedParams {
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

  const params: Array<{ name: string; value: string; order_index: number }> = [];
  for (let i = 1; i <= maxIndex; i++) {
    const name = String(readCell(d, [`Характеристика ${i}`, `Characteristic ${i}`])).trim();
    const value = String(readCell(d, [`Значення ${i}`, `Value ${i}`, `Значение ${i}`])).trim();
    if (!name) continue;
    if (!value) continue;
    params.push({ name, value, order_index: params.length });
  }

  return { hasParamColumns: has, params };
}

async function processBatch(
  supabase: any,
  rows: Row[],
  startIndex: number,
  storeIds: string[],
  references: any,
  existingProducts: Map<string, any>,
  existingByExternalId: Map<string, { id: string; store_id: string }>,
  externalIdSeen: Set<string>
): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const toUpdate: Array<{ id: string; data: Record<string, unknown>; params: ParsedParams; row: number; external_id: string }> = [];
  const paramsToDelete: string[] = [];
  const paramsToInsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < rows.length; i++) {
    const d = rows[i];
    const rowNum = startIndex + i + 1;
    
    try {
      const productId = String(readCell(d, ["ID", "product_id", "id", "Product ID", "ProductID"])).trim();
      const externalId = String(readCell(d, ["External ID", "Зовнішній ID", "Внешний ID", "external_id"])).trim();
      
      const parsed = parseProductRow(d, references);
      const productData = parsed.data;

      let effectiveId = "";

      if (productId) {
        const existing = existingProducts.get(productId);
        if (existing && storeIds.includes(existing.store_id)) {
          effectiveId = productId;
        } else {
          result.errors.push({ row: rowNum, external_id: externalId, error: "Товар з таким ID не знайдено" });
          result.skipped++;
          continue;
        }
      } else if (externalId) {
        if (externalIdSeen.has(externalId)) {
          result.errors.push({ row: rowNum, external_id: externalId, error: "Дублікат External ID" });
          result.skipped++;
          continue;
        }
        externalIdSeen.add(externalId);

        const existingByExt = existingByExternalId.get(externalId);
        if (existingByExt && storeIds.includes(existingByExt.store_id)) {
          effectiveId = existingByExt.id;
        } else {
          result.errors.push({ row: rowNum, external_id: externalId, error: "Товар з таким External ID не знайдено" });
          result.skipped++;
          continue;
        }
      } else {
        result.errors.push({ row: rowNum, error: "Потрібен ID або External ID" });
        result.skipped++;
        continue;
      }

      const validation = validateProductData(productData, { requireName: false });
      if (!validation.valid) {
        result.errors.push({ row: rowNum, external_id: externalId, error: validation.error! });
        result.skipped++;
        continue;
      }

      toUpdate.push({ id: effectiveId, data: productData, params: parsed.params, row: rowNum, external_id: externalId });
    } catch (error) {
      result.errors.push({ 
        row: rowNum, 
        error: getErrorMessage(error),
      });
      result.skipped++;
    }
  }

  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} products...`);
    for (const { id, data, params, row, external_id } of toUpdate) {
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      const { error: updateError } = await supabase
        .from("store_products")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        result.errors.push({ row, external_id, error: getErrorMessage(updateError) });
        result.skipped++;
        continue;
      }

      result.updated++;

      if (params.hasParamColumns) {
        paramsToDelete.push(id);
        for (const p of params.params) {
          paramsToInsert.push({ product_id: id, ...p });
        }
      }
    }
  }

  if (paramsToDelete.length > 0) {
    console.log(`Deleting params for ${paramsToDelete.length} products...`);
    const { error: delErr } = await supabase
      .from("store_product_params")
      .delete()
      .in("product_id", paramsToDelete);
    if (delErr) {
      console.error("Delete params error:", delErr);
    }
  }
  
  if (paramsToInsert.length > 0) {
    console.log(`Inserting ${paramsToInsert.length} params...`);
    for (let i = 0; i < paramsToInsert.length; i += 100) {
      const batch = paramsToInsert.slice(i, i + 100);
      const { error: insErr } = await supabase
        .from("store_product_params")
        .insert(batch);
      if (insErr) {
        console.error("Insert params error:", insErr);
      }
    }
  }

  return result;
}

function parseProductRow(d: Row, references: any): { 
  data: Record<string, unknown>; 
  params: ParsedParams 
} {
  const supplierName = normalizeStr(readCell(d, ["Supplier", "Постачальник"]));
  const categoryName = normalizeStr(readCell(d, ["Category", "Категорія"]));
  
  const supplierId = supplierName ? references.supplierByName.get(supplierName) : null;
  const categoryId = categoryName ? (
    supplierId 
      ? references.categoriesBySupplierId.get(supplierId)?.get(categoryName) 
      : references.categoriesGlobal.get(categoryName)
  ) : null;

  const out: Record<string, unknown> = {};

  const externalId = readCell(d, ["External ID", "Зовнішній ID", "Внешний ID", "external_id"]);
  if (externalId) out.external_id = externalId;

  const name = readCell(d, ["Name", "Назва", "Название", "name"]);
  if (name) out.name = name;

  const nameUa = readCell(d, ["Name UA", "Назва (укр.)", "name_ua"]);
  if (nameUa) out.name_ua = nameUa;

  const vendor = readCell(d, ["Brand", "Бренд", "vendor"]);
  if (vendor) out.vendor = vendor;

  const article = readCell(d, ["Article", "Артикул", "SKU", "article"]);
  if (article) out.article = article;

  const priceRaw = readCell(d, ["Price", "Ціна", "price"]);
  if (priceRaw) out.price = asNullableNumber(priceRaw);

  const priceOldRaw = readCell(d, ["Old Price", "Стара ціна", "price_old"]);
  if (priceOldRaw) out.price_old = asNullableNumber(priceOldRaw);

  const pricePromoRaw = readCell(d, ["Promo Price", "Акційна ціна", "price_promo"]);
  if (pricePromoRaw) out.price_promo = asNullableNumber(pricePromoRaw);

  const stockRaw = readCell(d, ["Stock", "Залишок", "stock_quantity"]);
  if (stockRaw) out.stock_quantity = asNullableNumber(stockRaw);

  const availableRaw = readCell(d, ["Available", "В наявності", "available"]);
  const available = asOptionalBoolean(availableRaw);
  if (available !== undefined) out.available = available;

  const stateRaw = readCell(d, ["Status", "Стан", "state"]);
  const state = parseProductState(stateRaw);
  if (state) out.state = state;

  const activeRaw = readCell(d, ["Active", "Активний", "is_active"]);
  const isActive = asOptionalBoolean(activeRaw);
  if (isActive !== undefined) out.is_active = isActive;

  const supplierIdRaw = asOptionalNumber(readCell(d, ["supplier_id", "Supplier ID", "Постачальник ID", "Поставщик ID"]));
  const resolvedSupplierId = supplierId != null ? supplierId : supplierIdRaw ?? null;
  if (resolvedSupplierId != null) out.supplier_id = resolvedSupplierId;

  const categoryIdRaw = asOptionalNumber(readCell(d, ["category_id", "Category ID", "Категорія ID", "Категория ID"]));
  if (categoryId != null) out.category_id = categoryId;
  else if (categoryIdRaw != null) out.category_id = categoryIdRaw;

  const categoryExternalId = readCell(d, ["category_external_id", "Category External ID", "Зовнішній ID категорії", "Внешний ID категории"]);
  if (categoryExternalId) out.category_external_id = categoryExternalId;

  const currencyCode = readCell(d, ["Currency", "Валюта", "currency_code"]);
  if (currencyCode) out.currency_code = currencyCode;

  const params = extractParamsFromProductRow(d);
  return { data: out, params };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let jobId = "";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user?.id) {
      console.error("Auth error:", userError);
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const userId = String(user.id);
    const supabase = supabaseAdmin;

    const body = await req.json() as Body;
    jobId = body.job_id?.trim() || "";
    const rows = body.rows || [];
    const storeIdInput = body.store_id != null ? String(body.store_id).trim() : "";

    if (!jobId || rows.length === 0 || rows.length > MAX_ROWS) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    // Получение магазинов
    const { data: storesData, error: storesError } = await supabaseAdmin
      .from("user_stores")
      .select("id,is_active")
      .eq("user_id", userId);

    if (storesError) {
      console.error("Stores error:", storesError);
      throw new Error("Failed to load stores");
    }

    const storeIds = (storesData || [])
      .filter((s: any) => s && String(s.id || "").trim())
      .map((s: any) => ({ 
        id: String(s.id), 
        is_active: s.is_active !== false 
      }));

    const activeStoreIds = storeIds.filter((s) => s.is_active).map((s) => s.id);
    if (activeStoreIds.length === 0) {
      return jsonResponse({ error: "store_required" }, 422);
    }

    const targetStoreId = storeIdInput ? storeIdInput : activeStoreIds[0];
    if (!activeStoreIds.includes(targetStoreId)) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { error: jobError } = await supabase
      .from("product_import_jobs")
      .upsert({
        id: jobId,
        user_id: userId,
        store_id: targetStoreId,
        status: "running",
        total_rows: rows.length,
        processed_rows: 0,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        error: null,
        payload: null,
      });

    if (jobError) {
      console.error("Job upsert error:", jobError);
    }

    console.log(`Starting import: ${rows.length} rows, target store: ${targetStoreId}`);

    const references = await preloadReferences(supabase, userId, activeStoreIds);
    
    const productIds = rows
      .map(r => readCell(r, ["ID", "product_id", "id", "Product ID", "ProductID"]))
      .filter(Boolean);
    const existingProducts = await preloadExistingProducts(supabase, activeStoreIds, productIds);
    
    console.log(`Loaded ${existingProducts.size} existing products by ID`);
    
    const externalIds = Array.from(
      new Set(
        rows
          .map((r) => readCell(r, ["External ID", "Зовнішній ID", "Внешний ID", "external_id"]).trim())
          .filter(Boolean),
      ),
    );
    const existingByExternalId = await preloadExistingProductsByExternalId(
      supabase, 
      targetStoreId, 
      externalIds
    );
    
    console.log(`Loaded ${existingByExternalId.size} existing products by external_id`);
    
    const externalIdSeen = new Set<string>();

    const totalResult: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      try {
        const batchResult = await processBatch(
          supabase,
          batch,
          i,
          activeStoreIds,
          references,
          existingProducts,
          existingByExternalId,
          externalIdSeen
        );

        totalResult.created += batchResult.created;
        totalResult.updated += batchResult.updated;
        totalResult.skipped += batchResult.skipped;
        totalResult.errors.push(...batchResult.errors);

        const processed = Math.min(i + batch.length, rows.length);
        console.log(`Processed: ${processed}/${rows.length}, Created: ${totalResult.created}, Updated: ${totalResult.updated}, Skipped: ${totalResult.skipped}`);
        
        const { error: progressUpdateError } = await supabase
          .from("product_import_jobs")
          .update({
            processed_rows: processed,
            created_count: totalResult.created,
            updated_count: totalResult.updated,
            skipped_count: totalResult.skipped
          })
          .eq("id", jobId);

        if (progressUpdateError) {
          console.error("Progress update error:", progressUpdateError);
        }
          
      } catch (batchError) {
        console.error(`Batch ${i}-${i + BATCH_SIZE} error:`, batchError);
        totalResult.errors.push({
          row: i + 1,
          error: `Batch error: ${getErrorMessage(batchError)}`
        });
      }
    }

    const { error: finalJobUpdateError } = await supabase
      .from("product_import_jobs")
      .update({
        status: "done",
        processed_rows: rows.length,
        created_count: totalResult.created,
        updated_count: totalResult.updated,
        skipped_count: totalResult.skipped
      })
      .eq("id", jobId);

    if (finalJobUpdateError) {
      console.error("Final job update error:", finalJobUpdateError);
    }

    const { data: jobRow, error: jobFetchError } = await supabase
      .from("product_import_jobs")
      .select("created_count,updated_count,skipped_count,processed_rows,total_rows,status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobFetchError) {
      console.error("Job fetch error:", jobFetchError);
    }

    const responseResult: ImportResult = {
      created: Number(jobRow?.created_count ?? totalResult.created ?? 0),
      updated: Number(jobRow?.updated_count ?? totalResult.updated ?? 0),
      skipped: Number(jobRow?.skipped_count ?? totalResult.skipped ?? 0),
      errors: totalResult.errors
    };

    console.log(
      `Import completed: Created: ${responseResult.created}, Updated: ${responseResult.updated}, Skipped: ${responseResult.skipped}, Errors: ${responseResult.errors.length}`
    );

    return jsonResponse({
      job_id: jobId,
      ...responseResult,
      errors: responseResult.errors.slice(0, 10)
    });

  } catch (error) {
    console.error("Import error:", error);
    
    if (jobId) {
      await supabaseAdmin
        .from("product_import_jobs")
        .update({ 
          status: "failed", 
          error: getErrorMessage(error) 
        })
        .eq("id", jobId)
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error("Failed to update job status:", updateError);
          }
        });
    }
    
    return jsonResponse({ 
      error: "internal_error", 
      message: getErrorMessage(error),
    }, 500);
  }
});
