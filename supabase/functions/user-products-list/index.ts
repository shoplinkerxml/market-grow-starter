import { createClient } from '@supabase/supabase-js'

// Конфигурация
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const R2_PUBLIC_HOST = Deno.env.get('R2_PUBLIC_HOST') || ''
const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL') || ''

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const CACHE_TTL = {
  PRODUCTS: 15 * 60 * 1000,
}
const MAX_PRODUCTS_CACHE_ENTRIES = 200

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

// Кэш
type CacheEntry<T> = { data: T; timestamp: number }

class Cache {
  private products = new Map<string, CacheEntry<any>>()

  private isExpired(entry: CacheEntry<any>, ttl: number) {
    return Date.now() - entry.timestamp > ttl
  }

  private prune() {
    const now = Date.now()
    for (const [k, v] of this.products) {
      if (!v || now - v.timestamp > CACHE_TTL.PRODUCTS) this.products.delete(k)
    }
    while (this.products.size > MAX_PRODUCTS_CACHE_ENTRIES) {
      const firstKey = this.products.keys().next().value as string | undefined
      if (!firstKey) break
      this.products.delete(firstKey)
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
    this.prune()
    this.products.set(key, { data, timestamp: Date.now() })
    while (this.products.size > MAX_PRODUCTS_CACHE_ENTRIES) {
      const firstKey = this.products.keys().next().value as string | undefined
      if (!firstKey) break
      this.products.delete(firstKey)
    }
  }
}

const cache = new Cache()

// Утилиты
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })

function getImagePublicUrl(r2Key: string | null, fallbackUrl: string): string {
  if (!r2Key) return fallbackUrl
  const base = R2_PUBLIC_HOST || R2_PUBLIC_BASE_URL
  if (!base) return fallbackUrl
  const cleanBase = base.startsWith('http') ? base : `https://${base}`
  return `${cleanBase}/${r2Key}`
}

// Получение всех продуктов пользователя через VIEW
async function fetchAllProducts(
  client: any,
  userId: string,
  limit: number,
  offset: number,
) {
  const { data: stores } = await client
    .from('user_stores')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!stores?.length) {
    return { products: [], totalCount: 0 }
  }

  const storeIds = stores.map((s: any) => s.id)

  // Запрос через VIEW
  const { data, error, count } = await client
    .from('products_with_details')
    .select('*', { count: 'exact' })
    .in('store_id', storeIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error || !data?.length) {
    return { products: [], totalCount: count ?? 0 }
  }

  const productIds = data.map((p: any) => String(p.id))

  // Связи магазинов
  const { data: links } = await client
    .from('store_product_links')
    .select('product_id, store_id, is_active, custom_category_id')
    .in('product_id', productIds)
    .eq('is_active', true)

  const linksMap = new Map()
  for (const link of links || []) {
    const pid = String(link.product_id)
    if (!linksMap.has(pid)) {
      linksMap.set(pid, { storeIds: [], customCategoryId: null })
    }
    linksMap.get(pid).storeIds.push(String(link.store_id))
    if (link.custom_category_id && linksMap.get(pid).storeIds.length === 1) {
      linksMap.get(pid).customCategoryId = String(link.custom_category_id)
    }
  }

  // Обработка продуктов
  const products = data.map((p: any) => {
    const pid = String(p.id)
    const linkInfo = linksMap.get(pid)

    return {
      id: pid,
      store_id: String(p.store_id),
      supplier_id: p.supplier_id,
      external_id: p.external_id,
      name: p.name,
      name_ua: p.name_ua,
      description: p.description,
      description_ua: p.description_ua,
      vendor: p.vendor,
      article: p.article,
      category_id: p.category_id,
      category_external_id: p.category_external_id,
      currency_id: p.currency_id,
      currency_code: p.currency_code,
      price: p.price,
      price_old: p.price_old,
      price_promo: p.price_promo,
      stock_quantity: p.stock_quantity ?? 0,
      available: p.available ?? true,
      state: p.state ?? 'new',
      created_at: p.created_at,
      updated_at: p.updated_at,
      is_active: true,
      mainImageUrl: p.main_image_key 
        ? getImagePublicUrl(p.main_image_key, p.main_image_url)
        : undefined,
      categoryName: p.category_name,
      supplierName: p.supplier_name,
      linkedStoreIds: linkInfo?.storeIds || [],
    }
  })

  return {
    products,
    totalCount: count ?? 0,
  }
}

// Основной обработчик
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
    // Аутентификация
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const client = createClient(SUPABASE_URL, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // Параметры
    let body: any = {}
    try {
      body = await req.json()
    } catch {}

    const storeIdRaw = body.store_id
    if (storeIdRaw != null && String(storeIdRaw).trim() !== "") {
      return jsonResponse({ error: "store_id_not_supported" }, 422)
    }
    const storeId = null
    const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
    const offset = Math.max(0, body.offset ?? 0)
    const bypassCache = body?.bypassCache === true || body?.bypassCache === 'true'
    // Кэш ключ
    const cacheKey = `${user.id}:${storeId || 'all'}:${limit}:${offset}`
    if (!bypassCache) {
      const cachedResult = cache.getProducts(cacheKey)
      if (cachedResult) {
        console.log('Cache hit:', cacheKey)
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

    // Получение продуктов
    const result = await fetchAllProducts(client, user.id, limit, offset)

    const { products, totalCount } = result

    // Кэшируем результат
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
    console.error('Error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
