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
const SHOP_CONFIG_TTL_SECONDS = Math.max(
  60,
  Number(Deno.env.get("SHOP_CONFIG_TTL_SECONDS") || "3600") || 3600
)
const SHOP_CONFIG_KEY_PREFIX =
  Deno.env.get("SHOP_CONFIG_KEY_PREFIX") || "shop:config:"

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

function normalizeConfig(input: any): { xml_config: unknown; custom_mapping: unknown } {
  return { xml_config: input?.xml_config ?? null, custom_mapping: input?.custom_mapping ?? null }
}

async function setConfigToRedis(
  storeId: string,
  config: { xml_config: unknown; custom_mapping: unknown }
): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const sid = String(storeId || "").trim()
  if (!sid) return
  const now = Date.now()
  const normalized = normalizeConfig(config)
  await redisPipeline([
    [
      "SET",
      buildConfigKey(sid),
      JSON.stringify({ ...normalized, ts: now }),
      "EX",
      SHOP_CONFIG_TTL_SECONDS,
    ],
  ])
}

async function deleteConfigFromRedis(storeId: string): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const sid = String(storeId || "").trim()
  if (!sid) return
  await redisPipeline([["DEL", buildConfigKey(sid)]])
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
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", apiKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })
    }
    const userId = String(userRes.user.id)

    const body = await req.json().catch(() => ({}))
    const id = String((body as any)?.id || "")
    const patch = ((body as any)?.patch || {}) as Record<string, unknown>
    if (!id) {
      return new Response(JSON.stringify({ error: "validation_failed", message: "id required" }), {
        status: 422,
        headers: corsHeaders,
      })
    }

    const { data: shop, error: selErr } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", id)
      .maybeSingle()
    if (selErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }
    if (!shop || String(shop.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    }
    if ((shop as any)?.is_active === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from("user_stores")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle()
    if (error) {
      return new Response(JSON.stringify({ error: "db_error", message: (error as any)?.message || "" }), { status: 500, headers: corsHeaders })
    }

    try {
      const sid = String((data as any)?.id || id || "").trim()
      if (sid) {
        if ((data as any)?.is_active === false) {
          await deleteConfigFromRedis(sid)
        } else {
          await setConfigToRedis(sid, normalizeConfig(data))
        }
      }
    } catch {
      void 0
    }

    return new Response(JSON.stringify({ shop: data }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
