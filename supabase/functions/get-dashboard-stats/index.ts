
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const DASHBOARD_STATS_TTL = 60 // 1 minute cache in Redis

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // Parallel fetch of base data
    const [
      { data: suppliers, error: suppliersError },
      { data: shops, error: shopsError },
      { count: totalProducts, error: totalProductsError },
      { count: totalCategories, error: totalCategoriesError } // We'll try to count explicitly
    ] = await Promise.all([
      // Suppliers
      supabaseClient
        .from('user_suppliers') // Changed from 'suppliers' to 'user_suppliers' to match other functions
        .select('id, supplier_name')
        .eq('user_id', userId),
      
      // Shops
      supabaseClient
        .from('user_stores')
        .select('id, store_name, is_active')
        .eq('user_id', userId)
        // Treat NULL as active to match other parts of the app
        .or('is_active.is.null,is_active.eq.true'),

      // Total products
      supabaseClient
        .from('user_master_products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Total categories - count from store_categories for user's stores
      // Since we can't join easily in count, we might need a separate query later if this fails.
      // But let's try to get all categories count by selecting from store_categories where store_id is in user_stores.
      // However, we don't have the store IDs yet in this Promise.all context unless we query user_stores twice.
      // So we will handle categories count separately or use a separate query.
      // For now, let's just return 0 and calculate it below.
      Promise.resolve({ count: 0, error: null }) 
    ])

    if (suppliersError) {
      console.error('Suppliers fetch error:', suppliersError)
    }
    if (shopsError) {
      console.error('Shops fetch error:', shopsError)
    }

    // Fetch counts details
    // 1. Product counts per supplier
    // We fetch all products (lightweight) to aggregate in memory
    const { data: productsData } = await supabaseClient
      .from('user_master_products')
      .select('id, supplier_id')
      .eq('user_id', userId)

    // 2. Product counts per shop
    // We fetch all store links to aggregate in memory
    // store_product_links has store_id
    // We need to filter by stores that belong to user.
    const storeIds = shops?.map(s => s.id) || []
    
    let storeLinksData: any[] = []
    if (storeIds.length > 0) {
      const { data: links } = await supabaseClient
        .from('store_product_links')
        .select('store_id')
        .in('store_id', storeIds)
        .eq('is_active', true)
      
      storeLinksData = links || []
    }

    // 3. Categories count
    // Fetch all store_categories for these stores
    let totalCategoriesCount = 0
    if (storeIds.length > 0) {
        const { count } = await supabaseClient
            .from('store_categories')
            .select('*', { count: 'exact', head: true })
            .in('store_id', storeIds)
        
        totalCategoriesCount = count || 0
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

    const transformedShops = shops?.map(s => ({
      id: s.id,
      store_name: s.store_name,
      productsCount: shopCounts[String(s.id)] || 0
    })) || []

    const responseData = {
      suppliers: transformedSuppliers,
      stores: transformedShops,
      totalProducts: totalProducts || 0,
      totalCategories: totalCategoriesCount
    }

    // Cache in Redis (fire and forget)
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
