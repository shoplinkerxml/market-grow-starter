import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js"
import { S3Client } from "npm:@aws-sdk/client-s3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function extractObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const path = (u.pathname || "/").replace(/^\/+/, "")
    return path || null
  } catch {
    return null
  }
}

type ImageInput = {
  key?: string
  url?: string
  order_index?: number
  is_main?: boolean
}

type ParamInput = {
  name: string
  value: string
  order_index?: number
  paramid?: string | null
  valueid?: string | null
}

type Body = {
  product_id: string
  supplier_id?: number | string | null
  category_id?: string | null
  category_external_id?: string | null
  currency_code?: string | null
  external_id?: string | null
  name?: string
  name_ua?: string | null
  vendor?: string | null
  article?: string | null
  available?: boolean
  stock_quantity?: number
  price?: number | null
  price_old?: number | null
  price_promo?: number | null
  description?: string | null
  description_ua?: string | null
  docket?: string | null
  docket_ua?: string | null
  state?: string
  images?: ImageInput[]
  params?: ParamInput[]
}

const MAX_IMAGES = 20
const MAX_PARAMS = 50

// ENV и клиенты один раз
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? ""
const bucket = Deno.env.get("R2_BUCKET_NAME") ?? ""
function resolvePublicBase(): string {
  const host = Deno.env.get("R2_PUBLIC_HOST") || ""
  if (host) {
    const h = host.startsWith("http") ? host : `https://${host}`
    try {
      const u = new URL(h)
      return `${u.protocol}//${u.host}`
    } catch {
      return h
    }
  }
  const raw = Deno.env.get("R2_PUBLIC_BASE_URL") || Deno.env.get("IMAGE_BASE_URL") || ""
  if (!raw) return ""
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const origin = `${u.protocol}//${u.host}`
    const path = (u.pathname || "/").replace(/^\/+/, "").replace(/\/+$/, "")
    return path ? `${origin}/${path}` : origin
  } catch {
    return raw
  }
}
const IMAGE_BASE_URL = resolvePublicBase()
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? ""
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase configuration")
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

//

async function toPreferredUrl(img: ImageInput): Promise<{ url: string; r2_original?: string }> {
  const srcKey = (img.key && String(img.key)) || (typeof img.url === "string" ? extractObjectKeyFromUrl(img.url!) : null)
  if (!srcKey) {
    return { url: String(img.url || "").trim() }
  }
  const base = IMAGE_BASE_URL || ""
  const url = base ? `${base}/${srcKey}` : String(img.url || "").trim()
  return { url, r2_original: srcKey }
}

async function handleImages(
  productId: string,
  images: ImageInput[] | undefined,
): Promise<void> {
  if (!Array.isArray(images)) {
    return
  }
  if (images.length === 0) {
    await supabase.from("store_product_images").delete().eq("product_id", productId)
    return
  }

  let hasMain = images.some((i) => i.is_main === true)
  let assigned = false
  const normalized: Array<{ product_id: string; url: string; is_main: boolean; order_index: number; r2_key_original?: string | null }> = []

  for (let index = 0; index < images.length; index++) {
    const raw = images[index]
    const preferred = await toPreferredUrl(raw)
    let isMain = raw.is_main === true && !assigned
    if (hasMain) {
      if (raw.is_main === true && !assigned) assigned = true
      else isMain = false
    } else {
      isMain = index === 0
    }
    const oi = typeof raw.order_index === "number" ? raw.order_index : index
    if (preferred.url && preferred.url.trim() !== "") {
      normalized.push({ product_id: productId, url: preferred.url, is_main: isMain, order_index: oi, r2_key_original: preferred.r2_original ?? null })
    }
  }

  const mainIdx = normalized.findIndex((i) => i.is_main === true)
  const ordered = (() => {
    const arr = normalized.slice()
    if (mainIdx > 0) {
      const [main] = arr.splice(mainIdx, 1)
      arr.unshift(main)
    }
    return arr.map((i, idx) => ({ ...i, order_index: idx }))
  })()

  // Delete existing images first
  const { error: deleteErr } = await supabase.from("store_product_images").delete().eq("product_id", productId)
  if (deleteErr) {
    console.error(`[handleImages] Delete error:`, deleteErr)
  }
  
  if (ordered.length) {
    const { data: insertData, error: insertErr } = await supabase.from("store_product_images").insert(ordered).select()
    if (insertErr) {
      console.error(`[handleImages] Insert error:`, insertErr)
      throw new Error(`Failed to insert images: ${insertErr.message}`)
    }
  }
}

async function handleParams(
  productId: string,
  params: ParamInput[] | undefined,
): Promise<void> {
  await supabase.from("store_product_params").delete().eq("product_id", productId)
  if (!Array.isArray(params) || params.length === 0) return

  const mapped = params.map((p, index) => ({
    product_id: productId,
    name: p.name,
    value: p.value,
    order_index:
      typeof p.order_index === "number" ? p.order_index : index,
    paramid: p.paramid ?? null,
    valueid: p.valueid ?? null,
  }))

  if (mapped.length) {
    await supabase.from("store_product_params").insert(mapped)
  }
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

    const body = (await req.json().catch(() => ({}))) as Body
    const productId = String(body?.product_id || "").trim()
    if (!productId) {
      return new Response(
        JSON.stringify({
          error: "invalid_body",
          message: "product_id required",
        }),
        { status: 400, headers: jsonHeaders },
      )
    }

    if (Array.isArray(body.images) && body.images.length > MAX_IMAGES) {
      return new Response(
        JSON.stringify({ error: "too_many_images", max: MAX_IMAGES }),
        { status: 400, headers: jsonHeaders },
      )
    }
    if (Array.isArray(body.params) && body.params.length > MAX_PARAMS) {
      return new Response(
        JSON.stringify({ error: "too_many_params", max: MAX_PARAMS }),
        { status: 400, headers: jsonHeaders },
      )
    }


    const { data: productRow } = await supabase
      .from("store_products")
      .select("id,store_id,category_id,category_external_id,user_stores!inner(id,user_id,is_active)")
      .eq("id", productId)
      .maybeSingle()

    if (!productRow) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: jsonHeaders,
      })
    }

    const storeId = String((productRow as { store_id: string }).store_id)
    const userStoreRaw: any = (productRow as any).user_stores
    const userStore = Array.isArray(userStoreRaw) ? (userStoreRaw[0] || null) : userStoreRaw
    if (!userStore || String(userStore.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    const isActive = (userStore as { is_active?: boolean }).is_active
    if (isActive === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    const updateBase: Record<string, unknown> = {}

    if (body.supplier_id !== undefined) {
      updateBase.supplier_id =
        body.supplier_id != null ? Number(body.supplier_id) : null
    }
    if (body.external_id !== undefined) updateBase.external_id = body.external_id
    if (body.name !== undefined) updateBase.name = body.name
    if (body.name_ua !== undefined) updateBase.name_ua = body.name_ua
    if (body.docket !== undefined) updateBase.docket = body.docket
    if (body.docket_ua !== undefined) updateBase.docket_ua = body.docket_ua
    if (body.description !== undefined)
      updateBase.description = body.description
    if (body.description_ua !== undefined)
      updateBase.description_ua = body.description_ua
    if (body.vendor !== undefined) updateBase.vendor = body.vendor
    if (body.article !== undefined) updateBase.article = body.article
    if (body.category_id !== undefined) {
      updateBase.category_id =
        body.category_id != null ? Number(body.category_id) : null
    }

    if (body.category_external_id !== undefined) {
      const raw = body.category_external_id
      let nextExt: string | null = null

      if (raw != null && String(raw).trim() !== "") {
        nextExt = String(raw)
      } else if (body.category_id != null) {
        const { data: catRow } = await supabase
          .from("store_categories")
          .select("external_id")
          .eq("id", Number(body.category_id))
          .maybeSingle()
        nextExt = (catRow as { external_id?: string } | null)?.external_id ?? null
      } else {
        nextExt =
          (productRow as { category_external_id?: string } | null)
            ?.category_external_id ?? null
      }

      if (nextExt != null && String(nextExt).trim() !== "") {
        updateBase.category_external_id = String(nextExt)
      } else {
        updateBase.category_external_id = null
      }
    }

    if (body.currency_code !== undefined)
      updateBase.currency_code = body.currency_code
    if (body.price !== undefined) updateBase.price = body.price
    if (body.price_old !== undefined) updateBase.price_old = body.price_old
    if (body.price_promo !== undefined)
      updateBase.price_promo = body.price_promo
    if (body.stock_quantity !== undefined)
      updateBase.stock_quantity = body.stock_quantity
    if (body.available !== undefined) updateBase.available = body.available
    if (body.state !== undefined) updateBase.state = body.state

    if (Object.keys(updateBase).length > 0) {
      const { error: updErr } = await supabase
        .from("store_products")
        .update(updateBase)
        .eq("id", productId)

      if (updErr) {
        return new Response(
          JSON.stringify({
            error: "update_failed",
            message: updErr.message || "Update failed",
          }),
          { status: 500, headers: jsonHeaders },
        )
      }
    }

    try {
      await Promise.all([
        handleImages(productId, body.images),
        handleParams(productId, body.params),
      ])
    } catch (subErr) {
      return new Response(
        JSON.stringify({
          error: "update_failed",
          message:
            (subErr as { message?: string })?.message ||
            "Update sub-ops failed",
        }),
        { status: 500, headers: jsonHeaders },
      )
    }

    return new Response(
      JSON.stringify({ product_id: String(productId) }),
      { status: 200, headers: jsonHeaders },
    )
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? "Update failed"
    return new Response(
      JSON.stringify({ error: "update_failed", message: msg }),
      { status: 500, headers: jsonHeaders },
    )
  }
})
