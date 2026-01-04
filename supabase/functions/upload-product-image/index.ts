// supabase/functions/upload-product-image/index.ts
import { createClient } from "npm:@supabase/supabase-js"
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3"

function buildCorsHeadersFromRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")
  const allowOrigin = origin && origin !== "null" ? origin : "*"
  const requested = req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type, accept"
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": requested,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "Content-Type, Content-Length, ETag",
    "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
  }
  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true"
  }
  return headers
}

type Body = {
  productId?: string
  product_id?: string
  fileData?: string
  fileName?: string
  fileType?: string
  url?: string
}

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

function decodeBase64ToBytes(b64: string): Uint8Array {
  const commaIdx = b64.indexOf(",")
  const pureBase64 = commaIdx >= 0 ? b64.slice(commaIdx + 1) : b64
  const binary = atob(pureBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ENV
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? ""
const bucket = Deno.env.get("R2_BUCKET_NAME") ?? ""
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? ""
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

function resolvePublicBase(): string {
  const host = Deno.env.get("R2_PUBLIC_HOST") || ""
  if (host) {
    const h = host.startsWith("http") ? host : `https://${host}`
    try {
      const u = new URL(h)
      // Убираем trailing slash
      return `${u.protocol}//${u.host}`.replace(/\/+$/, "")
    } catch {
      return h.replace(/\/+$/, "")
    }
  }
  const raw = Deno.env.get("R2_PUBLIC_BASE_URL") || Deno.env.get("IMAGE_BASE_URL") || "https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev"
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const origin = `${u.protocol}//${u.host}`
    const path = (u.pathname || "/").replace(/^\/+/, "").replace(/\/+$/, "")
    // Убираем trailing slash из финального URL
    return path ? `${origin}/${path}`.replace(/\/+$/, "") : origin
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

const IMAGE_BASE_URL = resolvePublicBase()
console.log("[upload-product-image] version v11-url-fix")
console.log(`[upload-product-image] Using IMAGE_BASE_URL: ${IMAGE_BASE_URL}`)

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

Deno.serve(async (req) => {
  console.log("[upload-product-image] === NEW REQUEST ===")
  console.log("[upload-product-image] Method:", req.method)
  console.log("[upload-product-image] URL:", req.url)
  
  const corsHeaders = buildCorsHeadersFromRequest(req)
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" }
  
  if (req.method === "OPTIONS") {
    console.log("[upload-product-image] OPTIONS request - returning CORS headers")
    return new Response("ok", { headers: corsHeaders })
  }

  console.log("[upload-product-image] Request received")

  try {
    console.log("[upload-product-image] Entering try block")
    
    // Auth check
    const auth = req.headers.get("authorization")
    console.log("[upload-product-image] Auth header exists:", !!auth)
    
    if (!auth) {
      console.log("[upload-product-image] No auth header")
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders })
    }

    const userId = decodeJwtSub(auth)
    if (!userId) {
      console.log("[upload-product-image] Invalid auth token")
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders })
    }

    console.log("[upload-product-image] User authenticated:", userId)

    // Parse body
    const body = (await req.json().catch((e) => {
      console.error("[upload-product-image] JSON parse error:", e)
      return {}
    })) as Body
    
    const productId = (body.productId || body.product_id || "").trim()

    if (!productId || !uuidRegex.test(productId)) {
      console.log("[upload-product-image] Invalid product_id:", productId)
      return new Response(
        JSON.stringify({ error: "invalid_body", message: "product_id must be valid UUID" }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // Check env config
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[upload-product-image] Missing Supabase config")
      return new Response(
        JSON.stringify({ error: "server_misconfig", message: "Missing Supabase config" }), 
        { status: 500, headers: jsonHeaders }
      )
    }

    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      console.error("[upload-product-image] Missing R2 config")
      return new Response(
        JSON.stringify({ error: "server_misconfig", message: "Missing R2 config" }), 
        { status: 500, headers: jsonHeaders }
      )
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    
    // Проверяем R2 endpoint
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    console.log(`[upload-product-image] R2 endpoint: ${r2Endpoint}`)
    console.log(`[upload-product-image] R2 bucket: ${bucket}`)
    
    const s3 = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestHandler: {
        requestTimeout: 25000, // 25 секунд максимум
      }
    })

    // Verify user owns this product
    const { data: product, error: prodErr } = await supabase
      .from("store_products")
      .select("id, store_id")
      .eq("id", productId)
      .single()

    if (prodErr || !product) {
      console.log("[upload-product-image] Product not found:", productId)
      return new Response(
        JSON.stringify({ error: "product_not_found" }), 
        { status: 404, headers: jsonHeaders }
      )
    }

    const { data: store } = await supabase
      .from("user_stores")
      .select("id, user_id")
      .eq("id", (product as any).store_id)
      .single()

    if (!store || (store as any).user_id !== userId) {
      console.log("[upload-product-image] User doesn't own product")
      return new Response(
        JSON.stringify({ error: "forbidden" }), 
        { status: 403, headers: jsonHeaders }
      )
    }

    // Get image data
    let imageBytes: Uint8Array
    let inputMime: string | undefined

    if (body.fileData) {
      console.log("[upload-product-image] Processing base64 upload")
      imageBytes = decodeBase64ToBytes(body.fileData)
      inputMime = body.fileType
    } else if (body.url) {
      console.log("[upload-product-image] Fetching from URL:", body.url)
      const imgRes = await fetch(body.url)
      if (!imgRes.ok) {
        console.error("[upload-product-image] URL fetch failed:", imgRes.status)
        return new Response(
          JSON.stringify({ error: "fetch_url_failed" }), 
          { status: 400, headers: jsonHeaders }
        )
      }
      imageBytes = new Uint8Array(await imgRes.arrayBuffer())
      inputMime = imgRes.headers.get('content-type') || undefined
    } else {
      console.log("[upload-product-image] No fileData or url provided")
      return new Response(
        JSON.stringify({ error: "invalid_body", message: "fileData or url required" }),
        { status: 400, headers: jsonHeaders }
      )
    }

    console.log(`[upload-product-image] Image size: ${imageBytes.length} bytes`)

    // Determine next order_index
    let nextOrder = 0
    const { data: lastRow } = await supabase
      .from("store_product_images")
      .select("order_index")
      .eq("product_id", productId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastRow && typeof (lastRow as any).order_index === "number") {
      nextOrder = Number((lastRow as any).order_index) + 1
    }

    // Check if first image
    const { count } = await supabase
      .from("store_product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)

    const isFirstImage = (count || 0) === 0

    // Create DB row
    const { data: inserted, error: insertErr } = await supabase
      .from("store_product_images")
      .insert({
        product_id: productId,
        url: "#processing",
        order_index: nextOrder,
        is_main: isFirstImage,
      })
      .select("id")
      .single()

    if (insertErr || !inserted) {
      console.error("[upload-product-image] Insert failed:", insertErr)
      return new Response(
        JSON.stringify({ error: "insert_failed", message: insertErr?.message }),
        { status: 500, headers: jsonHeaders }
      )
    }

    const imageId = (inserted as any).id
    console.log(`[upload-product-image] Created image row: ${imageId}`)

    // Формируем ключ для R2 без начального слеша
    const originalKey = `products/${productId}/${imageId}/original.webp`
    
    // Формируем правильный URL (без двойных слешей)
    const originalUrl = `${IMAGE_BASE_URL}/${originalKey}`
    
    console.log(`[upload-product-image] R2 Key: ${originalKey}`)
    console.log(`[upload-product-image] Final URL will be: ${originalUrl}`)

    const contentType = body.fileData ? 'image/webp' : (inputMime || 'image/webp')

    try {
      // Загружаем только оригинал
      console.log(`[upload-product-image] Uploading to R2...`)
      
      // Добавляем таймаут для загрузки в R2
      const uploadPromise = s3.send(new PutObjectCommand({ 
        Bucket: bucket, 
        Key: originalKey, 
        Body: imageBytes, 
        ContentType: contentType 
      }))
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('R2 upload timeout after 30s')), 30000)
      )
      
      await Promise.race([uploadPromise, timeoutPromise])

      console.log(`[upload-product-image] Upload complete to R2`)
      console.log(`[upload-product-image] Image accessible at: ${originalUrl}`)

      // Обновляем БД
      const { error: updateErr } = await supabase
        .from("store_product_images")
        .update({
          url: originalUrl,
          r2_key_original: originalKey,
        })
        .eq("id", imageId)

      if (updateErr) {
        console.error("[upload-product-image] Update failed:", updateErr)
      }

      console.log("[upload-product-image] Success!")

      return new Response(
        JSON.stringify({
          success: true,
          image_id: imageId,
          // единый URL для всех вариантов, т.к. используем одно фото
          url: originalUrl,
          original_url: originalUrl,
          card_url: originalUrl,
          thumb_url: originalUrl,
          is_main: isFirstImage,
          order_index: nextOrder,
        }),
        { status: 200, headers: jsonHeaders }
      )
    } catch (processErr) {
      console.error("[upload-product-image] Processing error:", processErr)
      
      // Mark as failed
      await supabase
        .from("store_product_images")
        .update({ url: "#failed" })
        .eq("id", imageId)
      
      return new Response(
        JSON.stringify({ 
          error: "processing_failed", 
          message: (processErr as any)?.message || 'Failed to process image' 
        }),
        { status: 500, headers: jsonHeaders }
      )
    }
  } catch (e) {
    console.error("[upload-product-image] Unexpected error:", e)
    return new Response(
      JSON.stringify({ error: "upload_failed", message: (e as any)?.message }),
      { status: 500, headers: jsonHeaders }
    )
  }
})