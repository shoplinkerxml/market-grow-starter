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

    return new Response(JSON.stringify({ ok: true, deletedProducts, deletedLinks }), { headers: CORS_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: CORS_HEADERS })
  }
})
