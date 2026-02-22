import { createClient } from '@supabase/supabase-js'
import { S3Client, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SUPPLIERS_LIST_KEY_PREFIX =
  Deno.env.get('SUPPLIERS_LIST_KEY_PREFIX') || 'suppliers:list:'
const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get('SHOP_COUNTS_KEY_PREFIX') || 'shop:counts:'
const SHOP_LIST_KEY_PREFIX =
  Deno.env.get('SHOP_LIST_KEY_PREFIX') || 'shop:list:'
const PRODUCT_STORES_KEY_PREFIX =
  Deno.env.get('PRODUCT_STORES_KEY_PREFIX') || 'product:stores:'

const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? ""
const bucket = Deno.env.get("R2_BUCKET_NAME") ?? ""
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? ""
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

const s3 =
  accountId && bucket && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null

function extractObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const path = u.pathname || ""
    return path.startsWith("/") ? path.slice(1) : path
  } catch {
    return null
  }
}

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, '')
    const res = await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
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

function buildSuppliersKey(userId: string): string {
  return `${SUPPLIERS_LIST_KEY_PREFIX}${userId}`
}

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`
}

function buildShopsListKey(userId: string): string {
  return `${SHOP_LIST_KEY_PREFIX}${userId}`
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

async function invalidateSuppliersList(userId: string): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const uid = String(userId || '').trim()
  if (!uid) return
  await redisPipeline([['DEL', buildSuppliersKey(uid)]])
}

async function invalidateShopsList(userId: string): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const uid = String(userId || '').trim()
  if (!uid) return
  await redisPipeline([['DEL', buildShopsListKey(uid)]])
}

async function invalidateCounts(storeIds: string[]): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const ids = Array.from(new Set((storeIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((sid) => ['DEL', buildCountsKey(sid)]))
}

async function invalidateProductStores(productIds: string[]): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const ids = Array.from(new Set((productIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((pid) => ['DEL', buildProductStoresKey(pid)]))
}

/**
 * Delete R2 objects for all images belonging to the given product IDs.
 * Uses service-role supabase client to bypass RLS.
 */
async function deleteR2ImagesForProducts(productIds: string[]): Promise<void> {
  if (!s3 || productIds.length === 0) return

  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: imageRows, error: imgErr } = await serviceClient
    .from('store_product_images')
    .select('url, r2_key_original, r2_key_card, r2_key_thumb')
    .in('product_id', productIds)

  if (imgErr || !imageRows || imageRows.length === 0) {
    console.log('[suppliers-delete] No images to clean up from R2', imgErr?.message)
    return
  }

  const keys: string[] = []

  for (const r of imageRows as { url?: string; r2_key_original?: string; r2_key_card?: string; r2_key_thumb?: string }[]) {
    if (r.r2_key_original) keys.push(r.r2_key_original)
    if (r.r2_key_card) keys.push(r.r2_key_card)
    if (r.r2_key_thumb) keys.push(r.r2_key_thumb)

    const u = String(r.url || "")
    if (u && !r.r2_key_original && !r.r2_key_card && !r.r2_key_thumb) {
      let host = ""
      try { host = new URL(u).host } catch { host = "" }
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
  if (uniqueKeys.length === 0) return

  console.log(`[suppliers-delete] Deleting ${uniqueKeys.length} R2 objects for ${productIds.length} products`)

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
    console.log(`[suppliers-delete] R2 cleanup done`)
  } catch (e) {
    console.warn('[suppliers-delete] R2 cleanup failed:', (e as any)?.message)
  }
}

type Body = { id?: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body: Body = await req.json().catch(() => ({} as Body))
    const id = Number(body?.id ?? NaN)
    if (!Number.isFinite(id)) {
      return new Response(JSON.stringify({ error: 'validation_failed', message: 'id required' }), { status: 422, headers: corsHeaders })
    }

    const { data: existing } = await supabase
      .from('user_suppliers')
      .select('id,user_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing || String((existing as any).user_id) !== String(user.id)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Fetch products BEFORE cascade delete to get their IDs and store_ids
    const { data: products } = await supabase
      .from('store_products')
      .select('id, store_id')
      .eq('supplier_id', id)

    const productIds = Array.from(
      new Set((products || []).map((p: any) => String(p?.id || '').trim()).filter(Boolean))
    )
    const storeIds = Array.from(
      new Set((products || []).map((p: any) => String(p?.store_id || '').trim()).filter(Boolean))
    )

    // Clean up R2 images BEFORE the cascade delete removes DB records
    if (productIds.length > 0) {
      await deleteR2ImagesForProducts(productIds)
    }

    const { error } = await supabase
      .from('user_suppliers')
      .delete()
      .eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: 'delete_failed', message: (error as any)?.message }), { status: 500, headers: corsHeaders })
    }

    try { await invalidateSuppliersList(user.id) } catch { void 0 }
    try { await invalidateShopsList(user.id) } catch { void 0 }
    try { await invalidateCounts(storeIds) } catch { void 0 }
    try { await invalidateProductStores(productIds) } catch { void 0 }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
