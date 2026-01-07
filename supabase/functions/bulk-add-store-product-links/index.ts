import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const MAX_LINKS = 1000
const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get('SHOP_COUNTS_KEY_PREFIX') || 'shop:counts:'
const PRODUCT_STORES_KEY_PREFIX =
  Deno.env.get('PRODUCT_STORES_KEY_PREFIX') || 'product:stores:'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
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

function buildCountsKey(storeId: string): string {
  return `${SHOP_COUNTS_KEY_PREFIX}${storeId}`
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

async function invalidateCounts(storeIds: string[]): Promise<void> {
  const ids = Array.from(new Set((storeIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((id) => ['DEL', buildCountsKey(id)]))
}

async function invalidateProductStores(productIds: string[]): Promise<void> {
  const ids = Array.from(new Set((productIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((id) => ['DEL', buildProductStoresKey(id)]))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: CORS_HEADERS }
    )
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })

    const body = await req.json().catch(() => ({}))
    const links = Array.isArray(body.links) ? body.links : []

    if (links.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, invalid: 0, skipped: 0 }),
        { status: 200, headers: CORS_HEADERS }
      )
    }

    if (links.length > MAX_LINKS) {
      return new Response(
        JSON.stringify({ 
          error: 'too_many_links',
          message: `Maximum ${MAX_LINKS} links allowed`,
          received: links.length
        }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Вызов RPC функции - весь процесс в одном запросе
    const { data, error } = await supabase
      .rpc('bulk_insert_product_links', { input_links: links })

    if (error) {
      console.error('RPC error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'bulk_insert_failed',
          message: error.message 
        }),
        { status: 500, headers: CORS_HEADERS }
      )
    }

    try {
      const storeIds = Array.from(
        new Set(links.map((l: any) => String(l?.store_id || '').trim()).filter(Boolean)),
      )
      const productIds = Array.from(
        new Set(links.map((l: any) => String(l?.product_id || '').trim()).filter(Boolean)),
      )
      await invalidateCounts(storeIds)
      await invalidateProductStores(productIds)
    } catch {
      void 0
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: CORS_HEADERS }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
