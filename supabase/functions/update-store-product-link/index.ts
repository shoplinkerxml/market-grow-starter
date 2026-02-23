import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js"
import { applyExternalRefsToDesiredMap, dedupeDesiredCategoriesByName, diffStoreCategoryRows, extractCategoryRefsFromLinks } from "../_shared/store-category-sync.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
}

const base64UrlToBase64 = (input: string) =>
  input.replace(/-/g, "+").replace(/_/g, "/")

const decodeJwtSub = (authHeader: string | null) => {
  try {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim()
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(base64UrlToBase64(parts[1])), (c) =>
          c.charCodeAt(0),
        ),
      ),
    )
    return String(payload?.sub || payload?.user_id || "")
  } catch {
    return null
  }
}

type Patch = {
  is_active?: boolean
  custom_price?: number | null
  custom_price_old?: number | null
  custom_price_promo?: number | null
  custom_stock_quantity?: number | null
  custom_available?: boolean | null
  custom_name?: string | null
  custom_description?: string | null
  custom_category_id?: string | null
}

type Body = {
  product_id: string
  store_id: string
  patch: Patch
}

// ENV и клиент один раз
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const REDIS_REST_URL =
  Deno.env.get("UPSTASH_REDIS_REST_URL") || Deno.env.get("REDIS_REST_URL") || "";
const REDIS_REST_TOKEN =
  Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || Deno.env.get("REDIS_REST_TOKEN") || "";

const SHOP_COUNTS_TTL_SECONDS = Math.max(
  5,
  Number(Deno.env.get("SHOP_COUNTS_TTL_SECONDS") || "30") || 30,
);

const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get("SHOP_COUNTS_KEY_PREFIX") || "shop:counts:";
const SHOP_LIST_KEY_PREFIX = Deno.env.get("SHOP_LIST_KEY_PREFIX") || "shop:list:";
const PRODUCT_STORES_KEY_PREFIX =
  Deno.env.get("PRODUCT_STORES_KEY_PREFIX") || "product:stores:";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null;
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, "");
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`;
}

function buildShopsListKey(userId: string): string {
  return `${SHOP_LIST_KEY_PREFIX}${userId}`;
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`;
}

type ShopCounts = { productsCount: number; categoriesCount: number };

function normalizeCounts(input: any): ShopCounts {
  const productsCount = Math.max(0, Number(input?.productsCount ?? input?.products_count ?? 0) || 0);
  const categoriesRaw = Math.max(0, Number(input?.categoriesCount ?? input?.categories_count ?? 0) || 0);
  return { productsCount, categoriesCount: productsCount === 0 ? 0 : categoriesRaw };
}

async function syncStoreCategoriesForStore(storeId: string): Promise<void> {
  const sid = String(storeId || "").trim();
  if (!sid) return;

  const { data: links, error: linksErr } = await supabase
    .from("store_product_links")
    .select("store_id, is_active, custom_category_id, store_products!inner(category_id,category_external_id,supplier_id)")
    .eq("store_id", sid)
    .eq("is_active", true);
  if (linksErr) return;

  const { desiredByStore, externalRefs, externalIdList } = extractCategoryRefsFromLinks((links || []) as any[]);

  let categories: any[] = [];
  if (externalIdList.length > 0) {
    const supplierIds = Array.from(
      new Set((externalRefs || []).map((r) => Number((r as any)?.supplierId)).filter((v) => Number.isFinite(v))),
    );
    const [{ data: storeCats }, { data: supplierCats }] = await Promise.all([
      supabase
        .from("store_categories")
        .select("id, external_id, supplier_id, store_id")
        .in("external_id", externalIdList)
        .eq("store_id", sid),
      supplierIds.length > 0
        ? supabase
            .from("store_categories")
            .select("id, external_id, supplier_id, store_id")
            .in("external_id", externalIdList)
            .in("supplier_id", supplierIds)
        : Promise.resolve({ data: [] }),
    ]);
    categories = [...(storeCats || []), ...(supplierCats || [])];
  }

  applyExternalRefsToDesiredMap(desiredByStore, externalRefs, categories as any[]);

  const { data: existingRows, error: existingErr } = await supabase
    .from("store_store_categories")
    .select("id, store_id, category_id")
    .eq("store_id", sid);
  if (existingErr) return;

  const allCategoryIds = new Set<number>();
  for (const set of desiredByStore.values()) {
    for (const id of set) allCategoryIds.add(Number(id));
  }
  for (const row of existingRows || []) {
    const id = Number((row as any)?.category_id);
    if (Number.isFinite(id)) allCategoryIds.add(id);
  }

  let finalDesired = desiredByStore;
  if (allCategoryIds.size > 0) {
    const { data: nameRows } = await supabase
      .from("store_categories")
      .select("id, name, store_id")
      .in("id", Array.from(allCategoryIds));
    finalDesired = dedupeDesiredCategoriesByName(
      desiredByStore,
      (nameRows || []) as any[],
      (existingRows || []) as any[],
    );
  }

  const { toInsert, toDeleteIds } = diffStoreCategoryRows(finalDesired, (existingRows || []) as any[]);
  if (toInsert.length > 0) {
    await supabase.from("store_store_categories").insert(toInsert);
  }
  if (toDeleteIds.length > 0) {
    await supabase.from("store_store_categories").delete().in("id", toDeleteIds);
  }
}

async function setCountsToRedis(storeId: string, counts: ShopCounts): Promise<void> {
  const sid = String(storeId || "").trim();
  if (!sid) return;
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return;
  const now = Date.now();
  await redisPipeline([
    [
      "SET",
      buildCountsKey(sid),
      JSON.stringify({ ...normalizeCounts(counts), ts: now }),
      "EX",
      SHOP_COUNTS_TTL_SECONDS,
    ],
  ]);
}

async function invalidateAndRecomputeCounts(storeId: string): Promise<void> {
  const sid = String(storeId || "").trim();
  if (!sid) return;
  const counts = await recomputeCountsForStore(sid);
  await setCountsToRedis(sid, counts);
}

async function invalidateShopsList(userId: string | null | undefined): Promise<void> {
  const uid = String(userId || "").trim();
  if (!uid) return;
  await redisPipeline([["DEL", buildShopsListKey(uid)]]);
}

async function invalidateProductStores(productId: string): Promise<void> {
  const pid = String(productId || "").trim();
  if (!pid) return;
  await redisPipeline([["DEL", buildProductStoresKey(pid)]]);
}

async function recomputeCountsForStore(storeId: string): Promise<ShopCounts> {
  const sid = String(storeId || "").trim();
  if (!sid) return { productsCount: 0, categoriesCount: 0 };

  const { data: links } = await supabase
    .from("store_product_links")
    .select(
      "store_id, is_active, product_id, custom_category_id, store_products!inner(category_id,category_external_id)",
    )
    .eq("store_id", sid)
    .eq("is_active", true);

  const customCategoryIds = Array.from(
    new Set(
      (links || [])
        .map((l: any) => Number(l?.custom_category_id))
        .filter((id: number) => Number.isFinite(id))
    )
  );
  const customCategoryLabelById = new Map<string, string>();
  if (customCategoryIds.length > 0) {
    const { data: customRows } = await supabase
      .from("store_categories")
      .select("id, external_id, name")
      .in("id", customCategoryIds);
    for (const row of customRows || []) {
      const id = row?.id != null ? String(row.id) : "";
      if (!id || customCategoryLabelById.has(id)) continue;
      const label = row?.external_id != null ? String(row.external_id) : (row?.name != null ? String(row.name) : "");
      if (label) customCategoryLabelById.set(id, label);
    }
  }

  let productsCount = 0;
  const categories = new Set<string>();

  for (const link of links || []) {
    productsCount += 1;
    const base = (link as any)?.store_products || {};
    const customCat = (link as any)?.custom_category_id;
    const customLabel = customCat != null ? customCategoryLabelById.get(String(customCat)) : null;
    const normalizedCustom = customLabel ? String(customLabel).trim().toLowerCase() : "";
    const customKey = normalizedCustom ? `name:${normalizedCustom}` : (customCat != null ? `cat:${String(customCat)}` : null);
    const normalizedExternal = base?.category_external_id != null ? String(base.category_external_id).trim().toLowerCase() : "";
    const catKey =
      customKey ||
      (normalizedExternal ? `ext:${normalizedExternal}` : null) ||
      (base?.category_id != null ? `cat:${String(base.category_id)}` : null);
    if (catKey) categories.add(catKey);
  }

  const categoriesCount = productsCount === 0 ? 0 : categories.size;
  return normalizeCounts({ productsCount, categoriesCount });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: jsonHeaders },
    )
  }

  try {
    const auth = req.headers.get("authorization")
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const userId = decodeJwtSub(auth)
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const body = (await req.json().catch(() => ({} as Body))) as Body
    const productId = String(body?.product_id || "").trim()
    const storeId = String(body?.store_id || "").trim()

    if (!productId || !storeId) {
      return new Response(
        JSON.stringify({
          error: "invalid_body",
          message: "product_id and store_id required",
        }),
        { status: 400, headers: jsonHeaders },
      )
    }

    const patch: Patch = body.patch || {}

    // Проверка магазина и прав пользователя
    const { data: storeRow } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", storeId)
      .maybeSingle()

    if (!storeRow || String(storeRow.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    const isActive = (storeRow as { is_active?: boolean }).is_active
    if (isActive === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    // Формируем патч с нужными полями
    const allowed: Patch = {
      is_active: patch.is_active, // undefined → не обновится (Supabase отбросит undefined)
      custom_price: patch.custom_price ?? null,
      custom_price_old: patch.custom_price_old ?? null,
      custom_price_promo: patch.custom_price_promo ?? null,
      custom_stock_quantity: patch.custom_stock_quantity ?? null,
      custom_available: patch.custom_available ?? null,
      custom_name: patch.custom_name ?? null,
      custom_description: patch.custom_description ?? null,
      custom_category_id: patch.custom_category_id ?? null,
    }

    // Проверяем, есть ли уже связь
    const { data: existing } = await supabase
      .from("store_product_links")
      .select("product_id,store_id")
      .eq("product_id", productId)
      .eq("store_id", storeId)
      .maybeSingle()

    if (!existing) {
      const { data: inserted, error: insErr } = await supabase
        .from("store_product_links")
        .insert([
          {
            product_id: productId,
            store_id: storeId,
            is_active: allowed.is_active ?? true,
            custom_price: allowed.custom_price,
            custom_price_old: allowed.custom_price_old,
            custom_price_promo: allowed.custom_price_promo,
            custom_stock_quantity: allowed.custom_stock_quantity,
            custom_available: allowed.custom_available,
            custom_name: allowed.custom_name,
            custom_description: allowed.custom_description,
            custom_category_id: allowed.custom_category_id,
          },
        ])
        .select("*")
        .maybeSingle()

      if (insErr) {
        return new Response(
          JSON.stringify({
            error: "update_failed",
            message: insErr.message || "Insert link failed",
          }),
          { status: 500, headers: jsonHeaders },
        )
      }

      await invalidateAndRecomputeCounts(storeId)
      try {
        await syncStoreCategoriesForStore(storeId)
      } catch {
        void 0
      }
      await invalidateShopsList(userId)
      await invalidateProductStores(productId)
      return new Response(JSON.stringify({ link: inserted }), {
        status: 200,
        headers: jsonHeaders,
      })
    }

    const { data: updated, error: updErr } = await supabase
      .from("store_product_links")
      .update(allowed)
      .eq("product_id", productId)
      .eq("store_id", storeId)
      .select("*")
      .maybeSingle()

    if (updErr) {
      return new Response(
        JSON.stringify({
          error: "update_failed",
          message: updErr.message || "Update link failed",
        }),
        { status: 500, headers: jsonHeaders },
      )
    }

    await invalidateAndRecomputeCounts(storeId)
    try {
      await syncStoreCategoriesForStore(storeId)
    } catch {
      void 0
    }
    await invalidateShopsList(userId)
    await invalidateProductStores(productId)
    return new Response(JSON.stringify({ link: updated }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e) {
    const msg =
      (e as { message?: string })?.message ?? "Update link failed"
    return new Response(
      JSON.stringify({ error: "update_failed", message: msg }),
      { status: 500, headers: jsonHeaders },
    )
  }
})
