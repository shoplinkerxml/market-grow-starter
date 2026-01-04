import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
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