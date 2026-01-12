import { createClient } from '@supabase/supabase-js'

// Конфигурация
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const R2_PUBLIC_HOST = Deno.env.get('R2_PUBLIC_HOST') || ''
const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL') || ''
const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const PRODUCT_STORES_TTL_SECONDS = Math.max(
  5,
  Number(Deno.env.get('PRODUCT_STORES_TTL_SECONDS') || '60') || 60,
)
const PRODUCT_STORES_KEY_PREFIX =
  Deno.env.get('PRODUCT_STORES_KEY_PREFIX') || 'product:stores:'

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

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

type ProductStoresInfo = { storeIds: string[]; customCategoryId: string | null }

async function getProductStoresFromRedis(productIds: string[]): Promise<Map<string, ProductStoresInfo>> {
  const out = new Map<string, ProductStoresInfo>()
  const ids = Array.from(new Set((productIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return out
  const resp = await redisPipeline(ids.map((id) => ['GET', buildProductStoresKey(id)]))
  if (!resp) return out
  for (let i = 0; i < ids.length; i++) {
    const raw = resp?.[i]?.result
    if (!raw) continue
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const storeIds = Array.isArray(parsed?.storeIds) ? parsed.storeIds.map(String).filter(Boolean) : []
      const customCategoryId = parsed?.customCategoryId != null ? String(parsed.customCategoryId) : null
      out.set(ids[i], { storeIds, customCategoryId })
    } catch {
      continue
    }
  }
  return out
}

async function setProductStoresToRedis(rows: Array<{ productId: string; info: ProductStoresInfo }>): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const items = (rows || [])
    .map((r) => ({
      productId: String(r.productId || '').trim(),
      info: {
        storeIds: Array.isArray(r.info?.storeIds) ? r.info.storeIds.map(String).filter(Boolean) : [],
        customCategoryId: r.info?.customCategoryId != null ? String(r.info.customCategoryId) : null,
      },
    }))
    .filter((r) => r.productId.length > 0)
  if (items.length === 0) return
  const now = Date.now()
  await redisPipeline(
    items.map((r) => [
      'SET',
      buildProductStoresKey(r.productId),
      JSON.stringify({ ...r.info, ts: now }),
      'EX',
      PRODUCT_STORES_TTL_SECONDS,
    ]),
  )
}

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

  // 1. Получаем ID уникальных товаров из мастер-таблицы (для правильной пагинации и подсчета)
  // Мы запрашиваем store_products, чтобы получить уникальные товары (мастер-записи),
  // игнорируя дубликаты из связей (store_product_links), которые есть в products_with_details.
  const { data: masterProducts, error: masterError, count } = await client
    .from('store_products')
    .select('id, store_id, created_at', { count: 'exact' })
    .in('store_id', storeIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (masterError || !masterProducts?.length) {
    return { products: [], totalCount: count ?? 0 }
  }

  const productIds = masterProducts.map((p: any) => String(p.id))
  const masterStoreMap = new Map(masterProducts.map((p: any) => [String(p.id), String(p.store_id)]))

  // 2. Получаем детали для этих товаров через VIEW
  const { data: detailsData, error: detailsError } = await client
    .from('products_with_details')
    .select('*')
    .in('id', productIds)

  if (detailsError) {
    console.error('Error fetching details:', detailsError)
    // В случае ошибки получения деталей, возвращаем пустой список, но с правильным каунтом?
    // Лучше вернуть ошибку или пустой список.
    return { products: [], totalCount: count ?? 0 }
  }

  // 3. Собираем данные, выбирая только мастер-запись для каждого товара
  // Это исключает дубликаты, если товар привязан к нескольким магазинам
  const data = productIds.map((pid: string) => {
    const masterStoreId = masterStoreMap.get(pid)
    // Ищем запись в деталях, которая соответствует мастер-магазину
    const detail = detailsData?.find((d: any) => String(d.id) === pid && String(d.store_id) === masterStoreId)
    // Fallback: берем первую попавшуюся запись с таким ID, если мастер-запись не найдена в VIEW
    return detail || detailsData?.find((d: any) => String(d.id) === pid)
  }).filter((p: any) => p)

  const linksMap = new Map<string, ProductStoresInfo>()
  const cachedLinks = await getProductStoresFromRedis(productIds)
  for (const [pid, info] of cachedLinks.entries()) {
    linksMap.set(pid, info)
  }

  const missingProductIds = productIds.filter((pid: string) => !linksMap.has(String(pid)))
  if (missingProductIds.length > 0) {
    const { data: links } = await client
      .from('store_product_links')
      .select('product_id, store_id, is_active, custom_category_id')
      .in('product_id', missingProductIds)
      .eq('is_active', true)

    const toWrite: Array<{ productId: string; info: ProductStoresInfo }> = []
    for (const pid of missingProductIds) {
      linksMap.set(String(pid), { storeIds: [], customCategoryId: null })
    }
    for (const link of links || []) {
      const pid = String(link.product_id)
      const item = linksMap.get(pid) || { storeIds: [], customCategoryId: null }
      item.storeIds.push(String(link.store_id))
      if (link.custom_category_id && item.storeIds.length === 1) {
        item.customCategoryId = String(link.custom_category_id)
      }
      linksMap.set(pid, item)
    }
    for (const pid of missingProductIds) {
      const info = linksMap.get(String(pid))
      if (!info) continue
      toWrite.push({ productId: String(pid), info })
    }
    await setProductStoresToRedis(toWrite)
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
