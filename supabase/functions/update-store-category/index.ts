import { createClient } from "npm:@supabase/supabase-js"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function decodeJwtSub(h: string): string | null {
  try {
    const t = h.replace(/^Bearer\s+/i, "").trim()
    const p = t.split(".")
    if (p.length < 2) return null
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(p[1].replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    )
    return String(payload?.sub || payload?.user_id || "")
  } catch {
    return null
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || ""

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "misconfigured_supabase" }), { status: 500, headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const userId = decodeJwtSub(authHeader)
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json().catch(() => ({}))
    const idRaw = (body as any)?.id
    const patchRaw = ((body as any)?.patch ?? {}) as Record<string, unknown>
    const id = Number(idRaw ?? NaN)
    if (!Number.isFinite(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: CORS_HEADERS })
    }

    // Normalize patch: only allow specific keys
    const patch: Record<string, unknown> = {}
    if ("custom_name" in patchRaw) {
      const v = patchRaw.custom_name
      patch.custom_name = v == null ? null : String(v)
    }
    if ("external_id" in patchRaw) {
      const v = patchRaw.external_id
      patch.external_id = v == null ? null : String(v)
    }
    if ("rz_id_value" in patchRaw) {
      const v = patchRaw.rz_id_value
      patch.rz_id_value = v == null ? null : String(v)
    }
    if ("is_active" in patchRaw) {
      const v = patchRaw.is_active
      patch.is_active = v === true
    }

    const supabase = (createClient as any)(SUPABASE_URL, SERVICE_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    })

    // Find store/category by local ID and verify access
    const { data: catRow, error: catErr } = await supabase
      .from("store_store_categories")
      .select("id, store_id, category_id")
      .eq("id", id)
      .maybeSingle()
    if (catErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }
    if (!catRow) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: CORS_HEADERS })
    }
    const storeId = String((catRow as any).store_id || "")

    const { data: store, error: storeErr } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", storeId)
      .maybeSingle()
    if (storeErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }
    if (!store || String((store as any).user_id) !== userId || (store as any).is_active === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS_HEADERS })
    }

    // Apply update
    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ ok: true, item: catRow }), { headers: CORS_HEADERS })
    }

    const { data: updated, error: updErr } = await supabase
      .from("store_store_categories")
      .update(patch)
      .eq("id", id)
      .select("id, store_id, category_id, custom_name, external_id, rz_id_value, is_active")
      .maybeSingle()
    if (updErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ ok: true, item: updated || catRow }), { headers: CORS_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: CORS_HEADERS })
  }
})
