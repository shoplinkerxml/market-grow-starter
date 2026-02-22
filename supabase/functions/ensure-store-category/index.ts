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
    const storeId = String((body as any)?.store_id || "").trim()
    const categoryId = Number((body as any)?.category_id)
    const externalId = (body as any)?.external_id != null ? String((body as any).external_id) : null
    const customName = (body as any)?.custom_name != null ? String((body as any).custom_name) : null

    if (!storeId || !Number.isFinite(categoryId)) {
      return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: CORS_HEADERS })
    }

    const supabase = (createClient as any)(SUPABASE_URL, SERVICE_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    })

    const { data: storeRow, error: storeErr } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", storeId)
      .maybeSingle()
    if (storeErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }
    if (!storeRow || String((storeRow as any).user_id) !== userId || (storeRow as any).is_active === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS_HEADERS })
    }

    const { data: baseCategory } = await supabase
      .from("store_categories")
      .select("id, external_id")
      .eq("id", categoryId)
      .maybeSingle()
    if (!baseCategory) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: CORS_HEADERS })
    }

    const { data: existingRow, error: existingErr } = await supabase
      .from("store_store_categories")
      .select("id")
      .eq("store_id", storeId)
      .eq("category_id", categoryId)
      .maybeSingle()
    if (existingErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }
    if (existingRow?.id != null) {
      return new Response(JSON.stringify({ id: Number(existingRow.id) }), { headers: CORS_HEADERS })
    }

    const { data: links, error: linksErr } = await supabase
      .from("store_product_links")
      .select("custom_category_id, store_products(category_id,category_external_id)")
      .eq("store_id", storeId)
      .eq("is_active", true)
    if (linksErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }

    const normalizedExternal = baseCategory?.external_id != null ? String(baseCategory.external_id).trim().toLowerCase() : ""
    const normalizedCustom = externalId != null ? String(externalId).trim().toLowerCase() : ""
    let hasMatch = false
    for (const link of links || []) {
      const base = (link as any)?.store_products || {}
      const baseId = Number((base as any)?.category_id)
      const baseExternal = (base as any)?.category_external_id != null ? String(base.category_external_id).trim().toLowerCase() : ""
      const customExternal = (link as any)?.custom_category_id != null ? String((link as any).custom_category_id).trim().toLowerCase() : ""
      if (Number.isFinite(baseId) && baseId === categoryId) {
        hasMatch = true
        break
      }
      if (normalizedExternal && baseExternal && baseExternal === normalizedExternal) {
        hasMatch = true
        break
      }
      if (normalizedCustom && customExternal && customExternal === normalizedCustom) {
        hasMatch = true
        break
      }
    }

    if (!hasMatch) {
      return new Response(JSON.stringify({ id: null }), { headers: CORS_HEADERS })
    }

    const { data: inserted, error: insErr } = await supabase
      .from("store_store_categories")
      .insert([
        {
          store_id: storeId,
          category_id: categoryId,
          external_id: externalId,
          custom_name: customName,
        },
      ])
      .select("id")
      .maybeSingle()
    if (insErr) {
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ id: inserted?.id != null ? Number(inserted.id) : null }), { headers: CORS_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: CORS_HEADERS })
  }
})
