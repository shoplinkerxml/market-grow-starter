import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

const LOOKUP_TTL = 120_000
const MAX_SUPPLIERS_CACHE_USERS = 200

type CacheEntry<T> = { data: T; timestamp: number }

const lookupCache: {
  suppliersByUser: Map<string, CacheEntry<any[]>>
  currencies?: CacheEntry<any[]>
} = (globalThis as any).__lookupCache || { suppliersByUser: new Map() }

;(globalThis as any).__lookupCache = lookupCache

function getCached<T>(entry: CacheEntry<T> | undefined): T | null {
  if (!entry) return null
  if (Date.now() - entry.timestamp >= LOOKUP_TTL) return null
  return entry.data
}

function pruneSuppliersByUser(): void {
  const now = Date.now()
  for (const [k, v] of lookupCache.suppliersByUser) {
    if (!v || now - v.timestamp >= LOOKUP_TTL) lookupCache.suppliersByUser.delete(k)
  }
  while (lookupCache.suppliersByUser.size > MAX_SUPPLIERS_CACHE_USERS) {
    const firstKey = lookupCache.suppliersByUser.keys().next().value as string | undefined
    if (!firstKey) break
    lookupCache.suppliersByUser.delete(firstKey)
  }
}

async function getSuppliersCached(supabase: any, userId: string): Promise<any[]> {
  const cached = getCached(lookupCache.suppliersByUser.get(userId))
  if (cached) return cached

  const { data } = await supabase
    .from('user_suppliers')
    .select('id,supplier_name')
    .eq('user_id', userId)
    .order('supplier_name')

  const rows = (data || []).map((s: any) => ({
    id: String(s.id),
    supplier_name: String(s.supplier_name || ''),
  }))

  pruneSuppliersByUser()
  lookupCache.suppliersByUser.set(userId, { data: rows, timestamp: Date.now() })
  return rows
}

async function getCurrenciesCached(supabase: any): Promise<any[]> {
  const cached = getCached(lookupCache.currencies)
  if (cached) return cached

  const { data } = await supabase
    .from('currencies')
    .select('id,name,code,status')
    .eq('status', true)
    .order('name')

  const rows = (data || []).map((c: any) => ({
    id: Number(c.id),
    name: String(c.name || ''),
    code: String(c.code || ''),
    status: c.status ?? null,
  }))

  lookupCache.currencies = { data: rows, timestamp: Date.now() }
  return rows
}

function resolvePublicBase(): string {
  const host = Deno.env.get('R2_PUBLIC_HOST') || ''
  if (host) {
    const h = host.startsWith('http') ? host : `https://${host}`
    try {
      const u = new URL(h)
      return `${u.protocol}//${u.host}`
    } catch {
      return h
    }
  }
  const raw =
    Deno.env.get('R2_PUBLIC_BASE_URL') ||
    Deno.env.get('IMAGE_BASE_URL') ||
    'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev'
  if (!raw) return 'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev'
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const origin = `${u.protocol}//${u.host}`
    const path = (u.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '')
    return path ? `${origin}/${path}` : origin
  } catch {
    return raw
  }
}

function processImages(imageRows: any[], productId: string, imageBase: string) {
  return imageRows.map((img, index) => {
    const r2o = img.r2_key_original ? String(img.r2_key_original) : ''
    const originalUrl = r2o && imageBase ? `${imageBase}/${r2o}` : null
    const fallbackUrl = String(img.url || '')
    return {
      id: img.id != null ? String(img.id) : undefined,
      product_id: img.product_id != null ? String(img.product_id) : productId,
      url: originalUrl || fallbackUrl,
      order_index: typeof img.order_index === 'number' ? img.order_index : index,
      is_main: img.is_main === true,
      r2_key_original: r2o || null,
      images: { original: originalUrl },
    }
  })
}

function processParams(paramRows: any[], productId: string) {
  return paramRows.map((p, index) => ({
    id: p.id != null ? String(p.id) : undefined,
    product_id: p.product_id != null ? String(p.product_id) : productId,
    name: String(p.name || ''),
    value: String(p.value || ''),
    order_index: typeof p.order_index === 'number' ? p.order_index : index,
    paramid: p.paramid ?? null,
    valueid: p.valueid ?? null,
  }))
}

async function getUserStoreIds(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_stores').select('id').eq('user_id', userId)
  if (error) throw error
  return (data || []).map((r: any) => String(r.id)).filter(Boolean)
}

async function handleBatchRequest(supabase: any, userId: string, productIds: string[], storeId: string | null) {
  console.log(`[BATCH] Loading ${productIds.length} products`)
  const startTime = Date.now()

  const storeIds = await getUserStoreIds(supabase, userId)
  if (storeIds.length === 0) return { items: [] }

  // Один запрос со всеми связанными данными через JOIN
  const { data: productsData, error: productsError } = await supabase
    .from('store_products')
    .select(`
      *,
      images:store_product_images(id,product_id,url,order_index,is_main,r2_key_original),
      params:store_product_params(id,product_id,name,value,order_index,paramid,valueid)
    `)
    .in('id', productIds)
    .in('store_id', storeIds)

  if (productsError) {
    console.error('[BATCH] Error loading products:', productsError)
    throw new Error('products_fetch_failed')
  }

  const imageBase = resolvePublicBase()
  const items = (productsData || []).map((product: any) => {
    const pid = String(product.id)
    const images = processImages(product.images || [], pid, imageBase)
    const params = processParams(product.params || [], pid)
    
    return {
      product: {
        ...product,
        images: undefined,
        params: undefined,
      },
      images,
      params,
      store_id: storeId,
    }
  })

  console.log(`[BATCH] Loaded in ${Date.now() - startTime}ms`)
  return { items }
}

async function handleSingleRequest(supabase: any, user: any, productId: string, storeId: string | null) {
  console.log(`[SINGLE] Loading product ${productId}`)
  const startTime = Date.now()

  const storeIds = await getUserStoreIds(supabase, user.id)
  if (storeIds.length === 0) {
    throw new Error('product_not_found')
  }
  if (storeId && !storeIds.includes(String(storeId))) {
    throw new Error('product_not_found')
  }

  // Один большой запрос со всеми связанными данными
  const { data: productData, error: productError } = await supabase
    .from('store_products')
    .select(`
      *,
      images:store_product_images(id,product_id,url,order_index,is_main,r2_key_original),
      params:store_product_params(id,product_id,name,value,order_index,paramid,valueid)
    `)
    .eq('id', productId)
    .in('store_id', storeIds)
    .single()

  if (productError || !productData) {
    console.error('[SINGLE] Product not found:', productError)
    throw new Error('product_not_found')
  }

  const product = productData
  const actualStoreId = storeId || product.store_id

  // Параллельно загружаем справочники и связанные данные
  const promises: Promise<any>[] = [
    getSuppliersCached(supabase, user.id),
    getCurrenciesCached(supabase),
  ]

  // Только если есть supplier_id, загружаем его категории
  if (product.supplier_id != null) {
    promises.push(
      supabase
        .from('store_categories')
        .select('id,name,external_id,supplier_id,parent_external_id')
        .eq('supplier_id', product.supplier_id)
        .order('name')
        .then((r: any) => r.data || [])
    )
  } else {
    promises.push(Promise.resolve([]))
  }

  // Если есть store_id, загружаем связанные данные магазина
  if (actualStoreId) {
    promises.push(
      supabase
        .from('store_product_links')
        .select('*')
        .eq('product_id', productId)
        .eq('store_id', actualStoreId)
        .maybeSingle()
        .then((r: any) => r.data || null)
    )
    
    promises.push(
      supabase
        .from('user_stores')
        .select('id,store_name')
        .eq('id', actualStoreId)
        .maybeSingle()
        .then((r: any) => r.data || null)
    )
    
    promises.push(
      supabase
        .from('store_store_categories')
        .select(`
          id,store_id,category_id,custom_name,is_active,external_id,
          store_categories:category_id(id,external_id,name,parent_external_id,rz_id)
        `)
        .eq('store_id', actualStoreId)
        .order('id')
        .then((r: any) => r.data || [])
    )
  } else {
    promises.push(Promise.resolve(null))
    promises.push(Promise.resolve(null))
    promises.push(Promise.resolve([]))
  }

  const [
    suppliers,
    currencies,
    categories,
    linkRow,
    shopRow,
    sscRows,
  ] = await Promise.all(promises)

  console.log(`[SINGLE] Params loaded: ${product.params?.length || 0}`)
  console.log(`[SINGLE] Images loaded: ${product.images?.length || 0}`)

  // Обработка данных
  const imageBase = resolvePublicBase()
  const images = processImages(product.images || [], productId, imageBase)
  const params = processParams(product.params || [], productId)

  let supplier = null
  if (product.supplier_id != null) {
    const supplierRow = suppliers.find((s: any) => Number(s.id) === product.supplier_id)
    if (supplierRow) {
      supplier = {
        id: Number(supplierRow.id),
        supplier_name: supplierRow.supplier_name,
      }
    }
  }

  let categoryName = null
  if (categories.length > 0) {
    if (product.category_id != null) {
      const cat = categories.find((c: any) => String(c.id) === String(product.category_id))
      if (cat) categoryName = cat.name
    }
    if (!categoryName && product.category_external_id) {
      const cat = categories.find((c: any) => String(c.external_id) === String(product.category_external_id))
      if (cat) categoryName = cat.name
    }
  }

  const storeCategories = (sscRows || []).map((r: any) => {
    const sc = r?.store_categories || {}
    return {
      store_category_id: Number(r.id),
      store_id: String(r.store_id),
      category_id: Number(r.category_id),
      name: String(r.custom_name ?? sc.name ?? ''),
      store_external_id: r.external_id ?? null,
      is_active: !!r.is_active,
    }
  })

  // Загружаем категории для всех поставщиков только если нужно
  const supplierCategoriesMap: Record<string, any[]> = {}
  if (product.supplier_id != null) {
    supplierCategoriesMap[String(product.supplier_id)] = categories
  }

  console.log(`[SINGLE] Completed in ${Date.now() - startTime}ms`)

  return {
    product: {
      ...product,
      images: undefined,
      params: undefined,
    },
    link: linkRow,
    images,
    params,
    supplier,
    categoryName,
    shop: shopRow,
    storeCategories,
    suppliers,
    currencies,
    categories,
    supplierCategoriesMap,
  }
}

type RequestBody = {
  product_id?: string
  product_ids?: string[]
  store_id?: string | null
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.slice('Bearer '.length).trim()

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const dbKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    const supabase = createClient(SUPABASE_URL, dbKey)

    // Парсинг параметров
    let body: RequestBody = {}
    if (req.method === 'GET') {
      const url = new URL(req.url)
      body.product_id = url.searchParams.get('product_id') || ''
      body.store_id = url.searchParams.get('store_id') || null
    } else {
      try {
        const raw = await req.json() as any
        body.product_id = String(raw?.product_id || '')
        body.product_ids = Array.isArray(raw?.product_ids) 
          ? raw.product_ids.map((v: any) => String(v || '')).filter(Boolean)
          : undefined
        body.store_id = raw?.store_id == null ? null : String(raw.store_id)
      } catch {
        body.product_id = ''
        body.store_id = null
      }
    }

    // Batch запрос
    if (Array.isArray(body.product_ids) && body.product_ids.length > 0) {
      const uniqueIds = Array.from(new Set(body.product_ids)).slice(0, 1000)
      const result = await handleBatchRequest(supabase, user.id, uniqueIds, body.store_id || null)
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // Single запрос
    const productId = String(body.product_id || '')
    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'invalid_payload' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await handleSingleRequest(supabase, user, productId, body.store_id || null)
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })

  } catch (e: any) {
    console.error('[ERROR]', e)
    const msg = e?.message || 'aggregation_failed'
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders }
    )
  }
})
