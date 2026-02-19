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

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      serviceKey,
      {
        global: {
          headers: { Authorization: authHeader },
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
        { data: pData, error: pDataError },
        { data: lData, error: lError },
      ] = await Promise.all([
        // Total count of products across all user stores
        supabaseClient
          .from('store_products')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds),
        
        // Products with category info (for supplier stats and totalCategories)
        supabaseClient
          .from('store_products')
          .select('id, supplier_id, store_id, category_id, category_external_id')
          .in('store_id', storeIds),

        // Store product links (for per-store product counts — original behavior)
        supabaseClient
          .from('store_product_links')
          .select('store_id, product_id')
          .in('store_id', storeIds)
          .eq('is_active', true),
      ])

      if (pError) console.error('Products count error:', pError)
      if (pDataError) console.error('Products data error:', pDataError)
      if (lError) console.error('Links error:', lError)

      totalProducts = pCount || 0
      productsData = pData || []
      storeLinksData = lData || []

      // totalCategories: count unique categories from actual products
      if (totalProducts === 0) {
        totalCategories = 0
      } else {
        const uniqueCategoryKeys = new Set<string>()
        for (const p of productsData) {
          if (p?.category_id != null) {
            uniqueCategoryKeys.add(`id:${String(p.category_id)}`)
          } else if (p?.category_external_id != null) {
            uniqueCategoryKeys.add(`ext:${String(p.category_external_id).trim().toLowerCase()}`)
          }
        }
        totalCategories = uniqueCategoryKeys.size
      }
    }

    // Per-supplier: count from store_products (products belong to supplier)
    const supplierCounts: Record<string, number> = {}
    const categoriesBySupplier = new Map<string, Set<string>>()
    for (const p of productsData) {
      if (p.supplier_id) {
        const sid = String(p.supplier_id)
        supplierCounts[sid] = (supplierCounts[sid] || 0) + 1
        // Track unique categories per supplier
        const catKey = p.category_id != null
          ? `id:${String(p.category_id)}`
          : (p.category_external_id != null ? `ext:${String(p.category_external_id).trim().toLowerCase()}` : null)
        if (catKey) {
          if (!categoriesBySupplier.has(sid)) categoriesBySupplier.set(sid, new Set())
          categoriesBySupplier.get(sid)!.add(catKey)
        }
      }
    }

    // Per-store: count from store_product_links (original behavior — products linked to store)
    const shopCounts: Record<string, number> = {}
    const shopCategorySets = new Map<string, Set<string>>()
    for (const l of storeLinksData) {
      if (!l?.store_id) continue
      const storeId = String(l.store_id)
      shopCounts[storeId] = (shopCounts[storeId] || 0) + 1
    }

    const transformedSuppliers = suppliers?.map((s: any) => {
      const sid = String(s.id)
      const productCount = supplierCounts[sid] || 0
      if (productCount === 0) {
        return {
          id: s.id,
          supplier_name: s.supplier_name,
          productCount: 0,
          categoriesCount: 0,
          categories: []
        }
      }
      const catSet = categoriesBySupplier.get(sid)
      const categoriesCount = catSet?.size || 0
      return {
        id: s.id,
        supplier_name: s.supplier_name,
        productCount,
        categoriesCount,
        categories: []
      }
    }) || []

    const transformedShops = (shops || []).map((s: any) => ({
      id: s.id,
      store_name: s.store_name,
      productsCount: shopCounts[String(s.id)] || 0
    })) || []

    if (SUPABASE_SERVICE_ROLE_KEY && storeIds.length > 0) {
      try {
        const entityIds: string[] = []
        for (const sid of storeIds) {
          const storeId = String(sid)
          entityIds.push(`store:${storeId}:products`)
          entityIds.push(`store:${storeId}:categories`)
        }

        const { data: existingRows } = await supabaseClient
          .from('counters')
          .select('id, entity_id, counter_type')
          .in('entity_id', entityIds)

        const existingByEntity = new Map<string, { id: string; counter_type: string }>()
        for (const r of existingRows || []) {
          if (!(r as any)?.entity_id || !(r as any)?.id) continue
          existingByEntity.set(String((r as any).entity_id), { id: String((r as any).id), counter_type: String((r as any).counter_type || 'store') })
        }

        const updates: Array<{ id: string; count: number }> = []
        const inserts: Array<{ entity_id: string; counter_type: string; count: number }> = []

        for (const sid of storeIds) {
          const storeId = String(sid)
          const productsEntityId = `store:${storeId}:products`
          const categoriesEntityId = `store:${storeId}:categories`

          const productsCount = Math.max(0, Number(shopCounts[storeId] ?? 0) || 0)
          const categoriesCountRaw = shopCategorySets.get(storeId)?.size ?? 0
          const categoriesCount = productsCount === 0 ? 0 : Math.max(0, Number(categoriesCountRaw) || 0)

          const exP = existingByEntity.get(productsEntityId)
          if (exP) updates.push({ id: exP.id, count: productsCount })
          else inserts.push({ entity_id: productsEntityId, counter_type: 'store', count: productsCount })

          const exC = existingByEntity.get(categoriesEntityId)
          if (exC) updates.push({ id: exC.id, count: categoriesCount })
          else inserts.push({ entity_id: categoriesEntityId, counter_type: 'store', count: categoriesCount })
        }

        await Promise.all([
          ...updates.map((u) => supabaseClient.from('counters').update({ count: u.count }).eq('id', u.id)),
          inserts.length > 0 ? supabaseClient.from('counters').insert(inserts) : Promise.resolve(null),
        ])
      } catch (e) {
        console.error('Counters sync error:', e)
      }
    }

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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
