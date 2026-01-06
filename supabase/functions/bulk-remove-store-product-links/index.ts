import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get('SHOP_COUNTS_KEY_PREFIX') || 'shop:counts:'

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

async function invalidateCounts(storeIds: string[]): Promise<void> {
  const ids = Array.from(new Set((storeIds || []).map(String).filter(Boolean)))
  if (ids.length === 0) return
  await redisPipeline(ids.map((id) => ['DEL', buildCountsKey(id)]))
}

type RequestBody = {
  product_ids?: string[]
  store_ids?: string[]
  include_categories?: boolean
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })

    const body: RequestBody = await req.json().catch(() => ({}))

    // ✅ НЕ конвертируем в String - оставляем как есть для UUID
    const storeIds = Array.isArray(body.store_ids)
      ? body.store_ids.filter(Boolean)
      : []

    if (!storeIds.length) {
      return new Response(
        JSON.stringify({ deleted: 0, deletedByStore: {}, categoryNamesByStore: {} }),
        { status: 200, headers: CORS_HEADERS }
      )
    }

    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids.filter(Boolean)
      : []

    // ✅ ОДИН вызов RPC функции - передаем UUID массивы
    const { data, error } = await supabase.rpc('bulk_delete_store_links', {
      p_store_ids: storeIds,  // Supabase автоматически обработает как UUID[]
      p_product_ids: productIds.length ? productIds : null,
      p_include_categories: body.include_categories !== false
    })

    if (error) {
      throw new Error(`RPC call failed: ${error.message}`)
    }

    await invalidateCounts(storeIds)
    return new Response(
      JSON.stringify(data || { deleted: 0, deletedByStore: {}, categoryNamesByStore: {} }),
      { status: 200, headers: CORS_HEADERS }
    )

  } catch (error) {
    console.error('Delete operation failed:', error)
    
    return new Response(
      JSON.stringify({
        error: 'bulk_delete_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
