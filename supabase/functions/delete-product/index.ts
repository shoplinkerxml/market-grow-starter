import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js"
import { S3Client, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
}

type Body = {
  product_id?: string
  productId?: string
  product_ids?: string[]
  productIds?: string[]
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
  } catch (_) {
    return null
  }
}

const extractObjectKeyFromUrl = (url: string) => {
  try {
    const u = new URL(url)
    const path = u.pathname || ""
    return path.startsWith("/") ? path.slice(1) : path
  } catch (_) {
    return null
  }
}

// ENV и клиенты один раз
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase configuration")
}

const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? ""
const bucket = Deno.env.get("R2_BUCKET_NAME") ?? ""
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? ""
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const s3 =
  accountId && bucket && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null

const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
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

    const rawSingle = body?.product_id ?? body?.productId
    const rawList = body?.product_ids ?? body?.productIds

    let productIds: string[] = []

    if (Array.isArray(rawList) && rawList.length > 0) {
      productIds = rawList.map((v) => String(v || "").trim()).filter(Boolean)
    } else if (rawSingle) {
      productIds = [String(rawSingle).trim()]
    }

    if (!productIds.length) {
      return new Response(
        JSON.stringify({ error: "invalid_body", message: "product_id(s) required" }),
        { status: 400, headers: jsonHeaders },
      )
    }

    const invalid = productIds.filter((id) => !uuidRegex.test(id))
    if (invalid.length > 0) {
      return new Response(
        JSON.stringify({
          error: "invalid_body",
          message: "all product_ids must be UUID",
          invalid,
        }),
        { status: 400, headers: jsonHeaders },
      )
    }

    // Получаем товары одним запросом
    const { data: products, error: prodErr } = await supabase
      .from("store_products")
      .select("id, store_id")
      .in("id", productIds)

    if (prodErr) {
      return new Response(JSON.stringify({ error: "products_fetch_failed" }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ error: "product_not_found" }), {
        status: 404,
        headers: jsonHeaders,
      })
    }

    // Проверяем, что все товары принадлежат магазинам пользователя
    const storeIds = Array.from(
      new Set(products.map((p: any) => String(p.store_id))),
    )

    const { data: stores, error: storesErr } = await supabase
      .from("user_stores")
      .select("id,user_id")
      .in("id", storeIds)

    if (storesErr) {
      return new Response(JSON.stringify({ error: "store_fetch_failed" }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const allowedStoreIds = new Set(
      (stores || [])
        .filter((s: any) => String(s.user_id) === String(userId))
        .map((s: any) => String(s.id)),
    )

    const forbiddenProducts = products.filter(
      (p: any) => !allowedStoreIds.has(String(p.store_id)),
    )

    if (forbiddenProducts.length > 0) {
      return new Response(
        JSON.stringify({
          error: "forbidden",
          message: "some products do not belong to current user",
        }),
        { status: 403, headers: jsonHeaders },
      )
    }

    // Удаление файлов в R2 батчем
    if (s3 && accountId && bucket && accessKeyId && secretAccessKey) {
      const { data: imageRows, error: imgErr } = await supabase
        .from("store_product_images")
        .select("url, r2_key_original, r2_key_card, r2_key_thumb")
        .in("product_id", productIds)

      if (!imgErr && imageRows && imageRows.length > 0) {
        const keys: string[] = []

        for (const r of imageRows as { url?: string; r2_key_original?: string; r2_key_card?: string; r2_key_thumb?: string }[]) {
          // Собираем все r2 ключи
          if (r.r2_key_original) keys.push(r.r2_key_original)
          if (r.r2_key_card) keys.push(r.r2_key_card)
          if (r.r2_key_thumb) keys.push(r.r2_key_thumb)
          
          // Фолбэк: извлекаем ключ из URL если r2_key_* не заполнены
          const u = String(r.url || "")
          if (u && !r.r2_key_original && !r.r2_key_card && !r.r2_key_thumb) {
            let host = ""
            try {
              host = new URL(u).host
            } catch {
              host = ""
            }

            const isOurBucket =
              host === `${bucket}.${accountId}.r2.cloudflarestorage.com` ||
              host === "shop-linker.9ea53eb0cc570bc4b00e01008dee35e6.r2.cloudflarestorage.com" ||
              host === "images-service.xmlreactor.shop"

            if (isOurBucket) {
              const key = extractObjectKeyFromUrl(u)
              if (key) keys.push(key)
            }
          }
        }

        const uniqueKeys = Array.from(new Set(keys))

        if (uniqueKeys.length > 0) {
          try {
            const chunkSize = 900
            for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
              const chunk = uniqueKeys.slice(i, i + chunkSize)
              await s3.send(
                new DeleteObjectsCommand({
                  Bucket: bucket,
                  Delete: {
                    Objects: chunk.map((k) => ({ Key: k })),
                    Quiet: true,
                  },
                }),
              )
            }
          } catch (r2Err) {
            return new Response(
              JSON.stringify({
                error: "r2_delete_failed",
                message:
                  (r2Err as { message?: string })?.message ||
                  "R2 delete failed",
              }),
              { status: 500, headers: jsonHeaders },
            )
          }
        }
      }
    }

    // Удаляем связанные записи пачками
    await supabase
      .from("store_product_params")
      .delete()
      .in("product_id", productIds)

    await supabase
      .from("store_product_images")
      .delete()
      .in("product_id", productIds)

    await supabase
      .from("store_product_links")
      .delete()
      .in("product_id", productIds)

    await supabase.from("store_products").delete().in("id", productIds)

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: productIds.length,
      }),
      { status: 200, headers: jsonHeaders },
    )
  } catch (e) {
    const msg = (e as unknown as { message?: string })?.message ?? "Delete failed"
    return new Response(
      JSON.stringify({ error: "delete_failed", message: msg }),
      { status: 500, headers: jsonHeaders },
    )
  }
})