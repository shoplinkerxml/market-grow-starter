import { createClient } from "npm:@supabase/supabase-js"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

function decodeJwtSub(h: string): string | null {
  try {
    const t = h.replace(/^Bearer\s+/i, "").trim()
    const p = t.split(".")
    if (p.length < 2) return null
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))))
    return String(payload?.sub || payload?.user_id || "")
  } catch {
    return null
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const REDIS_REST_URL =
  Deno.env.get("UPSTASH_REDIS_REST_URL") || Deno.env.get("REDIS_REST_URL") || ""
const REDIS_REST_TOKEN =
  Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || Deno.env.get("REDIS_REST_TOKEN") || ""
const SHOP_COUNTS_KEY_PREFIX = Deno.env.get("SHOP_COUNTS_KEY_PREFIX") || "shop:counts:"
const PRODUCT_STORES_KEY_PREFIX = Deno.env.get("PRODUCT_STORES_KEY_PREFIX") || "product:stores:"

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, "")
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

async function invalidateCounts(storeIds: string[]): Promise<void> {
  const ids = Array.from(new Set((storeIds || []).map((v) => String(v || "").trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((id) => ["DEL", buildCountsKey(id)]))
}

async function invalidateProductStores(productIds: string[]): Promise<void> {
  const ids = Array.from(new Set((productIds || []).map((v) => String(v || "").trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((id) => ["DEL", buildProductStoresKey(id)]))
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const userId = decodeJwtSub(authHeader)
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS_HEADERS })

    const body = await req.json().catch(() => ({}))
    const store_id = String((body as any)?.store_id || "")
    const category_id = Number((body as any)?.category_id ?? NaN)
    if (!store_id || !Number.isFinite(category_id)) {
      return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: CORS_HEADERS })
    }

    const { data: store } = await supabase
      .from("user_stores")
      .select("id,user_id")
      .eq("id", store_id)
      .maybeSingle()
    if (!store || String((store as any).user_id) !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS_HEADERS })
    }

    const { data: baseCat, error: catErr } = await supabase
      .from("store_categories")
      .select("id, external_id")
      .eq("id", category_id)
      .maybeSingle()
    if (catErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    const baseExternalId = baseCat?.external_id ? String(baseCat.external_id) : null

    const { data: prods, error: selErr } = await supabase
      .from("store_products")
      .select("id")
      .eq("store_id", store_id)
      .or(baseExternalId ? `category_id.eq.${category_id},category_external_id.eq.${baseExternalId}` : `category_id.eq.${category_id}`)
    if (selErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })

    const productIds = (prods || []).map((r: any) => String(r.id))
    let deletedLinks = 0
    let deletedProducts = 0

    if (productIds.length) {
      const { data: linksBefore, error: linksSelErr } = await supabase
        .from("store_product_links")
        .select("id,is_active")
        .eq("store_id", store_id)
        .in("product_id", productIds)
      if (linksSelErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
      deletedLinks = (linksBefore || []).filter((l: any) => l?.is_active !== false).length

      const { error: delLinksErr } = await supabase
        .from("store_product_links")
        .delete()
        .eq("store_id", store_id)
        .in("product_id", productIds)
      if (delLinksErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })

      const { data: prodsBefore, error: prodsSelErr2 } = await supabase
        .from("store_products")
        .select("id")
        .eq("store_id", store_id)
        .in("id", productIds)
      if (prodsSelErr2) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
      deletedProducts = (prodsBefore || []).length

      const { error: delProdsErr } = await supabase
        .from("store_products")
        .delete()
        .eq("store_id", store_id)
        .in("id", productIds)
      if (delProdsErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }

    const { error: delCatErr } = await supabase
      .from("store_store_categories")
      .delete()
      .eq("store_id", store_id)
      .eq("category_id", category_id)
    if (delCatErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })

    try {
      await invalidateCounts([store_id])
      await invalidateProductStores(productIds)
    } catch {
      void 0
    }

    return new Response(JSON.stringify({ ok: true, deletedProducts, deletedLinks }), { headers: CORS_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: CORS_HEADERS })
  }
})
