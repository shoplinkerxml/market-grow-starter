import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js"
import { S3Client, CopyObjectCommand } from "npm:@aws-sdk/client-s3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" }

const base64UrlToBase64 = (input: string) => input.replace(/-/g, "+").replace(/_/g, "/")

const decodeJwtSub = (authHeader: string | null) => {
  try {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim()
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(base64UrlToBase64(parts[1])), (c) => c.charCodeAt(0)),
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
    const host = u.host || ""
    const pathname = (u.pathname || "/").replace(/^\/+/, "")
    const parts = pathname.split("/").filter(Boolean)

    if (host.includes("cloudflarestorage.com")) {
      const hostParts = host.split(".")
      const isPathStyle = hostParts.length === 4
      if (isPathStyle) {
        if (parts.length >= 2) return parts.slice(1).join("/")
        return parts[0] || null
      }
      return pathname || null
    }

    if (host.includes("r2.dev")) {
      if (parts.length >= 2) return parts.slice(1).join("/")
      return parts[0] || null
    }

    return null
  } catch {
    return null
  }
}

type ImageInput = { key?: string; url?: string; order_index?: number; is_main?: boolean }
type ParamInput = { name: string; value: string; order_index?: number; paramid?: string | null; valueid?: string | null }

type LinkPatch = {
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
  store_id?: string | null

  supplier_id?: number | string | null
  category_id?: string | null
  category_external_id?: string | null
  currency_code?: string | null

  external_id?: string | null
  name?: string | null
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
  state?: string | null

  images?: ImageInput[]
  params?: ParamInput[]
  linkPatch?: LinkPatch
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? ""
const bucket = Deno.env.get("R2_BUCKET_NAME") ?? ""
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? ""
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase configuration")
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const s3 = accountId && bucket && accessKeyId && secretAccessKey
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null

function buildDatePath() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  return `${yyyy}/${mm}/${dd}`
}

async function buildFinalImageUrl(img: ImageInput, productId: string, datePath: string): Promise<string> {
  const srcRaw = img.url ?? ""
  let finalUrl = String(srcRaw || "").trim()
  if (!s3 || !bucket || !accountId) return finalUrl

  const srcKey =
    (img.key && String(img.key)) ||
    (typeof img.url === "string" ? extractObjectKeyFromUrl(img.url) : null)

  if (!srcKey) return finalUrl

  const parts = srcKey.split("/").filter(Boolean)
  const baseName = parts[parts.length - 1] || "file"
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const suffix =
    (crypto as any).randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const destKey = `uploads/products/${productId}/${datePath}/${suffix}-${cleanName}`

  try {
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: destKey,
        CopySource: `${bucket}/${srcKey}`,
      }),
    )
    finalUrl = `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${destKey}`
  } catch {
    // оставляем исходный finalUrl
  }
  return finalUrl
}

async function handleImages(productId: string, images: ImageInput[] | undefined): Promise<void> {
  if (!Array.isArray(images)) return
  if (images.length === 0) {
    await supabase.from("store_product_images").delete().eq("product_id", productId)
    return
  }

  const datePath = buildDatePath()

  const processed = await Promise.all(
    images.map(async (img, index) => {
      const url = await buildFinalImageUrl(img, productId, datePath)
      const trimmed = url.trim()
      if (!trimmed) return null
      return { raw: img, url: trimmed, index }
    }),
  )

  const valid = processed.filter(
    (x): x is { raw: ImageInput; url: string; index: number } => x !== null,
  )

  if (!valid.length) {
    await supabase.from("store_product_images").delete().eq("product_id", productId)
    return
  }

  const hasMain = valid.some((i) => i.raw.is_main === true)
  let assigned = false

  const normalized = valid.map(({ raw, url, index }) => {
    let isMain = raw.is_main === true && !assigned
    if (hasMain) {
      if (raw.is_main === true && !assigned) {
        assigned = true
      } else {
        isMain = false
      }
    } else {
      isMain = index === 0
    }
    return {
      product_id: productId,
      url,
      is_main: isMain,
      order_index:
        typeof raw.order_index === "number" ? raw.order_index : index,
    }
  })

  const mainIdx = normalized.findIndex((i) => i.is_main === true)
  const ordered = (() => {
    const arr = normalized.slice()
    if (mainIdx > 0) {
      const [main] = arr.splice(mainIdx, 1)
      arr.unshift(main)
    }
    return arr.map((i, idx) => ({ ...i, order_index: idx }))
  })()

  await supabase.from("store_product_images").delete().eq("product_id", productId)
  if (ordered.length) {
    await supabase.from("store_product_images").insert(ordered)
  }
}

async function handleParams(productId: string, params: ParamInput[] | undefined): Promise<void> {
  await supabase.from("store_product_params").delete().eq("product_id", productId)
  if (!Array.isArray(params) || params.length === 0) return

  const mapped = params.map((p, index) => ({
    product_id: productId,
    name: p.name,
    value: p.value,
    order_index: typeof p.order_index === "number" ? p.order_index : index,
    paramid: (() => {
      const v = p.paramid == null ? null : String(p.paramid).trim()
      return v === "" ? null : v
    })(),
    valueid: (() => {
      const v = p.valueid == null ? null : String(p.valueid).trim()
      return v === "" ? null : v
    })(),
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
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: jsonHeaders },
      )
    }
    const userId = decodeJwtSub(auth)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: jsonHeaders },
      )
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const productId = String(body?.product_id || "").trim()
    if (!productId) {
      return new Response(
        JSON.stringify({ error: "invalid_body", message: "product_id required" }),
        { status: 400, headers: jsonHeaders },
      )
    }

    // базовый продукт
    const { data: productRow, error: prodErr } = await supabase
      .from("store_products")
      .select("id,store_id,category_id,category_external_id")
      .eq("id", productId)
      .maybeSingle()

    if (prodErr) {
      return new Response(
        JSON.stringify({ error: "not_found", message: prodErr.message || "product_not_found" }),
        { status: 404, headers: jsonHeaders },
      )
    }

    if (!productRow) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 404, headers: jsonHeaders },
      )
    }

    const baseStoreId = String((productRow as any).store_id || "")
    const storeId = String(body.store_id || baseStoreId || "").trim()

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: "invalid_body", message: "store_id not determined" }),
        { status: 400, headers: jsonHeaders },
      )
    }

    // проверка магазина и владельца
    const { data: storeRow } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", storeId)
      .maybeSingle()

    if (!storeRow || String((storeRow as any).user_id) !== String(userId)) {
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: jsonHeaders },
      )
    }

    const isActive = (storeRow as { is_active?: boolean }).is_active
    if (isActive === false) {
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: jsonHeaders },
      )
    }

    // формируем updateBase: обновляем ТОЛЬКО поля, которые реально пришли
    const updateBase: Record<string, unknown> = {}

    // числа с возможностью очистки (null)
    if ("supplier_id" in body) {
      updateBase.supplier_id =
        body.supplier_id != null ? Number(body.supplier_id) : null
    }

    if ("category_id" in body) {
      updateBase.category_id =
        body.category_id != null ? Number(body.category_id) : null
    }

    // строки; если ключ есть, пишем значение (может быть null для очистки)
    if ("external_id" in body) updateBase.external_id = body.external_id ?? null
    if ("name" in body) updateBase.name = body.name ?? null
    if ("name_ua" in body) updateBase.name_ua = body.name_ua ?? null
    if ("docket" in body) updateBase.docket = body.docket ?? null
    if ("docket_ua" in body) updateBase.docket_ua = body.docket_ua ?? null
    if ("description" in body) updateBase.description = body.description ?? null
    if ("description_ua" in body) updateBase.description_ua = body.description_ua ?? null
    if ("vendor" in body) updateBase.vendor = body.vendor ?? null
    if ("article" in body) updateBase.article = body.article ?? null

    if ("currency_code" in body) {
      updateBase.currency_code = body.currency_code ?? null
    }

    // цены / количества
    if ("price" in body) updateBase.price = body.price ?? null
    if ("price_old" in body) updateBase.price_old = body.price_old ?? null
    if ("price_promo" in body) updateBase.price_promo = body.price_promo ?? null

    if ("stock_quantity" in body) {
      updateBase.stock_quantity =
        typeof body.stock_quantity === "number" ? body.stock_quantity : 0
    }

    // boolean / state
    if ("available" in body) updateBase.available = body.available
    if ("state" in body) updateBase.state = body.state ?? "new"

    // category_external_id – зависит от category_external_id / category_id
    if ("category_external_id" in body || "category_id" in body) {
      let nextExt: string | null = null

      if ("category_external_id" in body) {
        if (
          body.category_external_id != null &&
          String(body.category_external_id).trim() !== ""
        ) {
          nextExt = String(body.category_external_id)
        } else {
          nextExt = null
        }
      } else if ("category_id" in body) {
        if (body.category_id != null) {
          const { data: catRow } = await supabase
            .from("store_categories")
            .select("external_id")
            .eq("id", Number(body.category_id))
            .maybeSingle()
          nextExt =
            (catRow as { external_id?: string } | null)?.external_id ?? null
        } else {
          nextExt = null
        }
      }

      updateBase.category_external_id =
        nextExt != null && String(nextExt).trim() !== ""
          ? String(nextExt)
          : null
    }

    // UPDATE товара
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

    // изображения и параметры: считаем payload полным снимком состояния
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

    // линк на магазин: обрабатываем только если передан linkPatch
    let link: any = null
    if (body.linkPatch && storeId) {
      const patch = body.linkPatch

      const allowed: Record<string, unknown> = {}
      if ("is_active" in patch) allowed.is_active = patch.is_active
      if ("custom_price" in patch) allowed.custom_price = patch.custom_price
      if ("custom_price_old" in patch) {
        allowed.custom_price_old = patch.custom_price_old
      }
      if ("custom_price_promo" in patch) {
        allowed.custom_price_promo = patch.custom_price_promo
      }
      if ("custom_stock_quantity" in patch) {
        allowed.custom_stock_quantity = patch.custom_stock_quantity
      }
      if ("custom_available" in patch) {
        allowed.custom_available = patch.custom_available
      }
      if ("custom_name" in patch) allowed.custom_name = patch.custom_name
      if ("custom_description" in patch) {
        allowed.custom_description = patch.custom_description
      }
      if ("custom_category_id" in patch) {
        allowed.custom_category_id = patch.custom_category_id
      }

      const { data: existing } = await supabase
        .from("store_product_links")
        .select("product_id,store_id")
        .eq("product_id", productId)
        .eq("store_id", storeId)
        .maybeSingle()

      if (!existing) {
        // при создании записи можно задать дефолты
        const insertPayload = {
          product_id: productId,
          store_id: storeId,
          is_active:
            ("is_active" in patch ? patch.is_active : undefined) ?? true,
          custom_price:
            ("custom_price" in patch ? patch.custom_price : undefined) ?? null,
          custom_price_old:
            ("custom_price_old" in patch
              ? patch.custom_price_old
              : undefined) ?? null,
          custom_price_promo:
            ("custom_price_promo" in patch
              ? patch.custom_price_promo
              : undefined) ?? null,
          custom_stock_quantity:
            ("custom_stock_quantity" in patch
              ? patch.custom_stock_quantity
              : undefined) ?? null,
          custom_available:
            ("custom_available" in patch
              ? patch.custom_available
              : undefined) ?? null,
          custom_name:
            ("custom_name" in patch ? patch.custom_name : undefined) ?? null,
          custom_description:
            ("custom_description" in patch
              ? patch.custom_description
              : undefined) ?? null,
          custom_category_id:
            ("custom_category_id" in patch
              ? patch.custom_category_id
              : undefined) ?? null,
        }

        const { data: inserted, error: insErr } = await supabase
          .from("store_product_links")
          .insert([insertPayload])
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
        link = inserted
      } else if (Object.keys(allowed).length > 0) {
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
        link = updated
      }
    }

    return new Response(
      JSON.stringify({ product_id: String(productId), link }),
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
