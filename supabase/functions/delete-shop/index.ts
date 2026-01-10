import { createClient } from "@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

const REDIS_REST_URL =
  Deno.env.get("UPSTASH_REDIS_REST_URL") || Deno.env.get("REDIS_REST_URL") || ""
const REDIS_REST_TOKEN =
  Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || Deno.env.get("REDIS_REST_TOKEN") || ""
const SHOP_CONFIG_KEY_PREFIX =
  Deno.env.get("SHOP_CONFIG_KEY_PREFIX") || "shop:config:"
const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get("SHOP_COUNTS_KEY_PREFIX") || "shop:counts:"
const SHOP_LIST_KEY_PREFIX =
  Deno.env.get("SHOP_LIST_KEY_PREFIX") || "shop:list:"
const PRODUCT_STORES_KEY_PREFIX =
  Deno.env.get("PRODUCT_STORES_KEY_PREFIX") || "product:stores:"

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) {
    console.warn("Redis credentials missing")
    return null
  }
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
    if (!res.ok) {
      console.error(`Redis pipeline failed: ${res.status} ${res.statusText}`)
      return null
    }
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch (e) {
    console.error("Redis pipeline error:", e)
    return null
  }
}

function buildConfigKey(storeId: string): string {
  return `${SHOP_CONFIG_KEY_PREFIX}${storeId}`
}

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`
}

function buildShopListKey(userId: string): string {
  return `${SHOP_LIST_KEY_PREFIX}${userId}`
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

async function deleteShopFromRedis(storeId: string): Promise<void> {
  const sid = String(storeId || "").trim()
  if (!sid) return
  await redisPipeline([["DEL", buildConfigKey(sid)], ["DEL", buildCountsKey(sid)]])
}

async function deleteShopListFromRedis(userId: string): Promise<void> {
  const uid = String(userId || "").trim()
  if (!uid) return
  await redisPipeline([["DEL", buildShopListKey(uid)]])
}

async function invalidateProductStores(productIds: string[]): Promise<void> {
  const ids = Array.from(new Set((productIds || []).map((v) => String(v || "").trim()).filter(Boolean)))
  if (ids.length === 0) return
  const chunk_size = 50
  for (let i = 0; i < ids.length; i += chunk_size) {
    const chunk = ids.slice(i, i + chunk_size)
    await redisPipeline(chunk.map((id) => ["DEL", buildProductStoresKey(id)]))
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })
    
    function decodeJwtSub(h: string): string | null {
      try {
        const t = h.replace(/^Bearer\s+/i, "").trim()
        const p = t.split(".")
        if (p.length < 2) return null
        const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))))
        return String(payload?.sub || payload?.user_id || "")
      } catch { return null }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabaseKey = serviceRoleKey || anonKey
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase credentials missing")
        return new Response(JSON.stringify({ error: "config_error" }), { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })
    
    const userId = decodeJwtSub(authHeader)
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const id = String((body as any)?.id || "")
    if (!id) {
      return new Response(JSON.stringify({ error: "validation_failed", message: "id required" }), {
        status: 422,
        headers: corsHeaders,
      })
    }

    console.log(`Deleting shop ${id} for user ${userId}`)

    // Verify ownership
    const { data: shop, error: selErr } = await supabase
      .from("user_stores")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle()
    
    if (selErr) {
      console.error("Shop lookup error:", selErr)
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }
    
    if (!shop || String(shop.user_id) !== String(userId)) {
      // It might be already deleted or user has no access
      if (!shop) {
          // If shop not found, we consider it success (idempotency)
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    }

    // Get links to invalidate cache later
    const { data: links, error: linksErr } = await supabase
      .from("store_product_links")
      .select("product_id")
      .eq("store_id", id)

    if (linksErr) {
      console.error("Links lookup error:", linksErr)
       // We continue even if links lookup fails? No, we need to delete them.
    }

    const affectedProductIds = Array.from(
      new Set((links || []).map((r: any) => String(r?.product_id || "").trim()).filter(Boolean)),
    )

    // Delete links
    const { error: delLinksErr } = await supabase
      .from("store_product_links")
      .delete()
      .eq("store_id", id)

    if (delLinksErr) {
      console.error("Links delete error:", delLinksErr)
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }

    // Delete shop
    const { error } = await supabase.from("user_stores").delete().eq("id", id)
    if (error) {
      console.error("Shop delete error:", error)
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }

    // Cleanup Redis (non-blocking errors)
    try {
      await deleteShopFromRedis(id)
    } catch (e) { console.error("Redis shop delete error:", e) }
    
    try {
      await deleteShopListFromRedis(userId)
    } catch (e) { console.error("Redis list delete error:", e) }
    
    try {
      await invalidateProductStores(affectedProductIds)
    } catch (e) { console.error("Redis product invalidation error:", e) }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    console.error("Unexpected error:", e)
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
