import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js"

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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase configuration")
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

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