import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const DASHBOARD_STATS_TTL = 60

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

function uniqStrings(list: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of list || []) {
    const s = String(v || '').trim()
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function counterKey(counterType: unknown, entityId: unknown): string {
  return `${String(counterType || '')}:${String(entityId || '')}`
}

function toCount(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    if (!SUPABASE_URL || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      serviceKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    const [
      { data: suppliers, error: suppliersError },
      { data: shops, error: shopsError }
    ] = await Promise.all([
      supabaseClient
        .from('user_suppliers')
        .select('id, supplier_name')
        .eq('user_id', userId),
      
      supabaseClient
        .from('user_stores')
        .select('id, store_name, is_active')
        .eq('user_id', userId)
        .or('is_active.is.null,is_active.eq.true')
    ])

    if (suppliersError) console.error('Suppliers fetch error:', suppliersError)
    if (shopsError) console.error('Shops fetch error:', shopsError)

    const storeIds = shops?.map(s => s.id) || []

    let totalProducts = 0
    let totalCategories = 0
    let productsData: any[] = []
    let storeLinksData: any[] = []

    if (storeIds.length > 0) {
      const [
        { count: pCount, error: pError },
        { count: cCount, error: cError },
        { data: pData, error: pDataError },
        { data: lData, error: lError }
      ] = await Promise.all([
        supabaseClient
          .from('store_products')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds),
        
        supabaseClient
          .from('store_categories')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds),
        
        supabaseClient
          .from('store_products')
          .select('id, supplier_id')
          .in('store_id', storeIds),

        supabaseClient
          .from('store_product_links')
          .select('store_id')
          .in('store_id', storeIds)
          .eq('is_active', true)
      ])

      if (pError) console.error('Products count error:', pError)
      if (cError) console.error('Categories count error:', cError)
      if (pDataError) console.error('Products data error:', pDataError)
      if (lError) console.error('Links error:', lError)

      totalProducts = pCount || 0
      totalCategories = cCount || 0
      productsData = pData || []
      storeLinksData = lData || []
    }

    // Aggregation
    const supplierCounts: Record<string, number> = {}
    if (productsData) {
      for (const p of productsData) {
        if (p.supplier_id) {
            const sid = String(p.supplier_id)
            supplierCounts[sid] = (supplierCounts[sid] || 0) + 1
        }
      }
    }

    const shopCounts: Record<string, number> = {}
    for (const l of storeLinksData) {
        if (l.store_id) {
            const sid = String(l.store_id)
            shopCounts[sid] = (shopCounts[sid] || 0) + 1
        }
    }

    // Transform data
    const transformedSuppliers = suppliers?.map(s => ({
      id: s.id,
      supplier_name: s.supplier_name,
      productCount: supplierCounts[String(s.id)] || 0
    })) || []

    const transformedShops = (shops || []).map((s: any) => ({
      id: s.id,
      store_name: s.store_name,
      productsCount: shopCounts[String(s.id)] || 0
    })) || []

    const responseData = {
      suppliers: transformedSuppliers,
      stores: transformedShops,
      totalProducts: totalProducts || 0,
      totalCategories: totalCategories
    }

    if (REDIS_REST_URL && REDIS_REST_TOKEN) {
      const cacheKey = `dashboard:stats:${userId}`
      redisPipeline([
        ['SET', cacheKey, JSON.stringify(responseData), 'EX', DASHBOARD_STATS_TTL]
      ]).catch(err => console.error('Redis cache error:', err))
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

