import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const R2_PUBLIC_HOST = Deno.env.get('R2_PUBLIC_HOST') || ''
const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL') || ''

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const CACHE_TTL = {
  PRODUCTS: 15 * 60 * 1000,
  CATEGORIES: 30 * 60 * 1000,
}
const MAX_PRODUCTS_CACHE_ENTRIES = 200
const MAX_CATEGORIES_CACHE_ENTRIES = 200

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type CacheEntry<T> = { data: T; timestamp: number }

class Cache {
  private products = new Map<string, CacheEntry<any>>()
  private categories = new Map<string, CacheEntry<Record<string, string>>>()

  private isExpired(entry: CacheEntry<any>, ttl: number) {
    return Date.now() - entry.timestamp > ttl
  }

  private pruneMap<T>(map: Map<string, CacheEntry<T>>, ttl: number, maxEntries: number) {
    const now = Date.now()
    for (const [k, v] of map) {
      if (!v || now - v.timestamp > ttl) map.delete(k)
    }
    while (map.size > maxEntries) {
      const firstKey = map.keys().next().value as string | undefined
      if (!firstKey) break
      map.delete(firstKey)
    }
  }

  getProducts(key: string) {
    const entry = this.products.get(key)
    if (!entry) return null
    if (this.isExpired(entry, CACHE_TTL.PRODUCTS)) {
      this.products.delete(key)
      return null
    }
    return entry.data
  }

  setProducts(key: string, data: any) {
    this.pruneMap(this.products, CACHE_TTL.PRODUCTS, MAX_PRODUCTS_CACHE_ENTRIES)
    this.products.set(key, { data, timestamp: Date.now() })
    while (this.products.size > MAX_PRODUCTS_CACHE_ENTRIES) {
      const firstKey = this.products.keys().next().value as string | undefined
      if (!firstKey) break
      this.products.delete(firstKey)
    }
  }

  getCategories(key: string) {
    const entry = this.categories.get(key)
    if (!entry) return null
    if (this.isExpired(entry, CACHE_TTL.CATEGORIES)) {
      this.categories.delete(key)
      return null
    }
    return entry.data
  }

  setCategories(key: string, data: Record<string, string>) {
    this.pruneMap(this.categories, CACHE_TTL.CATEGORIES, MAX_CATEGORIES_CACHE_ENTRIES)
    this.categories.set(key, { data, timestamp: Date.now() })
    while (this.categories.size > MAX_CATEGORIES_CACHE_ENTRIES) {
      const firstKey = this.categories.keys().next().value as string | undefined
      if (!firstKey) break
      this.categories.delete(firstKey)
    }
  }
}

const cache = new Cache()

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })

function getImagePublicUrl(r2Key: string | null, fallbackUrl: string): string {
  if (!r2Key) return fallbackUrl
  const base = R2_PUBLIC_HOST || R2_PUBLIC_BASE_URL
  if (!base) return fallbackUrl
  const cleanBase = base.startsWith('http') ? base : `https://${base}`
  return `${cleanBase}/${r2Key}`
}

async function buildCategoriesMap(
  client: any,
  userId: string,
  storeId: string,
  options?: { bypassCache?: boolean },
): Promise<Record<string, string>> {
  const bypassCache = options?.bypassCache === true
  const cacheKey = `${userId}:${storeId}`
  if (!bypassCache) {
    const cached = cache.getCategories(cacheKey)
    if (cached) return cached
  }

  const { data } = await client
    .from('store_store_categories')
    .select('id, external_id, custom_name, store_categories(name)')
    .eq('store_id', storeId)
    .eq('is_active', true)

  const map: Record<string, string> = {}
  for (const row of data || []) {
    const r: any = row as any
    const name = String(r.custom_name ?? r.store_categories?.name ?? '')
    if (r.id != null) map[String(r.id)] = name
    if (r.external_id != null) map[String(r.external_id)] = name
  }

  if (!bypassCache) {
    cache.setCategories(cacheKey, map)
  }
  return map
}

async function fetchStoreProducts(
  client: any,
  userId: string,
  storeId: string,
  limit: number,
  offset: number,
  categoriesMap: Record<string, string>,
) {
  const { data: store } = await client
    .from('user_stores')
    .select('id')
    .eq('id', storeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!store) {
    return { error: 'Store not found or access denied', status: 403 }
  }

  const linksResult = await client
    .from('store_product_links')
    .select(
      'product_id, created_at, custom_name, custom_description, custom_price, custom_price_old, custom_price_promo, custom_stock_quantity, custom_available, custom_category_id',
      { count: 'exact' },
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (linksResult.error) {
    return { products: [], totalCount: 0 }
  }

  const links = linksResult.data || []
  const productIds = links.map((l: any) => String(l.product_id)).filter(Boolean)
  if (productIds.length === 0) {
    return { products: [], totalCount: linksResult.count ?? 0 }
  }

  const productsResult = await client
    .from('products_with_details')
    .select('*')
    .in('id', productIds)

  if (productsResult.error) {
    return { products: [], totalCount: linksResult.count ?? 0 }
  }

  const byId = new Map<string, any>()
  for (const p of productsResult.data || []) {
    byId.set(String((p as any).id), p)
  }

  const products = links
    .map((link: any) => {
      const p: any = byId.get(String(link.product_id))
      if (!p) return null

      let categoryName = p.category_name
      if (link?.custom_category_id) {
        categoryName = categoriesMap[String(link.custom_category_id)] || categoryName
      }

      return {
        id: String(p.id),
        store_id: String(p.store_id),
        supplier_id: p.supplier_id,
        external_id: p.external_id,
        name: link?.custom_name ?? p.name,
        name_ua: p.name_ua,
        description: link?.custom_description ?? p.description,
        description_ua: p.description_ua,
        vendor: p.vendor,
        article: p.article,
        category_id: p.category_id,
        category_external_id: link?.custom_category_id ? String(link.custom_category_id) : p.category_external_id,
        currency_id: p.currency_id,
        currency_code: p.currency_code,
        price: link?.custom_price ?? p.price,
        price_old: link?.custom_price_old ?? p.price_old,
        price_promo: link?.custom_price_promo ?? p.price_promo,
        stock_quantity: link?.custom_stock_quantity ?? p.stock_quantity ?? 0,
        available: link?.custom_available ?? p.available ?? true,
        state: p.state ?? 'new',
        created_at: p.created_at,
        updated_at: p.updated_at,
        is_active: true,
        mainImageUrl: p.main_image_key ? getImagePublicUrl(p.main_image_key, p.main_image_url) : undefined,
        categoryName,
        supplierName: p.supplier_name,
        linkedStoreIds: [String(storeId)],
      }
    })
    .filter(Boolean)

  return { products, totalCount: linksResult.count ?? 0 }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const serviceKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !serviceKey) {
    return jsonResponse({ error: 'Configuration error' }, 500)
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const client = createClient(SUPABASE_URL, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {}

    const storeId = String(body.store_id || '').trim()
    if (!storeId) {
      return jsonResponse({ error: 'store_id_required' }, 422)
    }

    const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
    const offset = Math.max(0, body.offset ?? 0)
    const bypassCache = body?.bypassCache === true || body?.bypassCache === 'true'

    const cacheKey = `${user.id}:${storeId}:${limit}:${offset}`
    if (!bypassCache) {
      const cachedResult = cache.getProducts(cacheKey)
      if (cachedResult) {
        const { products, totalCount } = cachedResult
        return jsonResponse({
          products,
          page: {
            limit,
            offset,
            hasMore: offset + limit < totalCount,
            nextOffset: offset + limit < totalCount ? offset + limit : null,
            total: totalCount,
          },
        })
      }
    }

    let categoriesMap: Record<string, string> = {}
    try {
      categoriesMap = await buildCategoriesMap(client, String(user.id), storeId, { bypassCache })
    } catch {
      categoriesMap = {}
    }

    const result = await fetchStoreProducts(client, user.id, storeId, limit, offset, categoriesMap)
    if ('error' in result) {
      return jsonResponse({ error: result.error }, result.status)
    }

    const { products, totalCount } = result
    if (!bypassCache) {
      cache.setProducts(cacheKey, { products, totalCount })
    }

    const hasMore = offset + limit < totalCount
    const nextOffset = hasMore ? offset + limit : null

    return jsonResponse({
      products,
      page: { limit, offset, hasMore, nextOffset, total: totalCount },
    })
  } catch (error) {
    return jsonResponse({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
