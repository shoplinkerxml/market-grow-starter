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

function buildConfigKey(storeId: string): string {
  return `${SHOP_CONFIG_KEY_PREFIX}${storeId}`
}

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`
}

async function deleteShopFromRedis(storeId: string): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const sid = String(storeId || "").trim()
  if (!sid) return
  await redisPipeline([["DEL", buildConfigKey(sid)], ["DEL", buildCountsKey(sid)]])
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders })
  }

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const anonKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabaseKey = serviceRoleKey || anonKey
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

    const { data: shop, error: selErr } = await supabase
      .from("user_stores")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle()
    if (selErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }
    if (!shop || String(shop.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    }

    const { error } = await supabase.from("user_stores").delete().eq("id", id)
    if (error) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }
    try {
      await deleteShopFromRedis(id)
    } catch {
      void 0
    }
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
