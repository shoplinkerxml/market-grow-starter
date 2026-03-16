import { createClient } from '@supabase/supabase-js'
import { applyExternalRefsToDesiredMap, dedupeDesiredCategoriesByName, diffStoreCategoryRows, extractCategoryRefsFromLinks, normalizeCategoryName } from '../_shared/store-category-sync.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const MAX_LINKS = 1000
const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SHOP_COUNTS_TTL_SECONDS = Math.max(
  5,
  Number(Deno.env.get('SHOP_COUNTS_TTL_SECONDS') || '30') || 30,
)
const SHOP_COUNTS_KEY_PREFIX =
  Deno.env.get('SHOP_COUNTS_KEY_PREFIX') || 'shop:counts:'
const SHOP_LIST_KEY_PREFIX =
  Deno.env.get('SHOP_LIST_KEY_PREFIX') || 'shop:list:'
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

function buildShopsListKey(userId: string): string {
  return `${SHOP_LIST_KEY_PREFIX}${userId}`
}

function buildProductStoresKey(productId: string): string {
  return `${PRODUCT_STORES_KEY_PREFIX}${productId}`
}

type ShopCounts = { productsCount: number; categoriesCount: number }

function normalizeCounts(input: any): ShopCounts {
  const productsCount = Math.max(0, Number(input?.productsCount ?? input?.products_count ?? 0) || 0)
  const categoriesRaw = Math.max(0, Number(input?.categoriesCount ?? input?.categories_count ?? 0) || 0)
  return { productsCount, categoriesCount: productsCount === 0 ? 0 : categoriesRaw }
}

async function syncStoreCategoriesForStores(supabase: any, storeIds: string[]): Promise<void> {
  const ids = Array.from(new Set((storeIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return

  const { data: links, error: linksErr } = await supabase
    .from('store_product_links')
    .select('store_id, is_active, custom_category_id, store_products!inner(category_id,category_external_id,supplier_id,is_active)')
    .in('store_id', ids)
    .eq('is_active', true)
    .eq('store_products.is_active', true)
  if (linksErr) return

  const { desiredByStore, externalRefs, externalIdList } = extractCategoryRefsFromLinks((links || []) as any[])

  let categories: any[] = []
  if (externalIdList.length > 0) {
    const supplierIds = Array.from(
      new Set((externalRefs || []).map((r) => Number((r as any)?.supplierId)).filter((v) => Number.isFinite(v))),
    )
    const [{ data: storeCats }, { data: supplierCats }] = await Promise.all([
      supabase
        .from('store_categories')
        .select('id, external_id, supplier_id, store_id')
        .in('external_id', externalIdList)
        .in('store_id', ids),
      supplierIds.length > 0
        ? supabase
            .from('store_categories')
            .select('id, external_id, supplier_id, store_id')
            .in('external_id', externalIdList)
            .in('supplier_id', supplierIds)
        : Promise.resolve({ data: [] }),
    ])
    categories = [...(storeCats || []), ...(supplierCats || [])]
  }

  applyExternalRefsToDesiredMap(desiredByStore, externalRefs, categories as any[])

  const { data: existingRows, error: existingErr } = await supabase
    .from('store_store_categories')
    .select('id, store_id, category_id')
    .in('store_id', ids)
  if (existingErr) return

  const allCategoryIds = new Set<number>()
  for (const set of desiredByStore.values()) {
    for (const id of set) allCategoryIds.add(Number(id))
  }
  for (const row of existingRows || []) {
    const id = Number((row as any)?.category_id)
    if (Number.isFinite(id)) allCategoryIds.add(id)
  }

  let finalDesired = desiredByStore
  if (allCategoryIds.size > 0) {
    const { data: nameRows } = await supabase
      .from('store_categories')
      .select('id, name, store_id')
      .in('id', Array.from(allCategoryIds))
    finalDesired = dedupeDesiredCategoriesByName(desiredByStore, (nameRows || []) as any[], (existingRows || []) as any[])
  }

  const { toInsert, toDeleteIds } = diffStoreCategoryRows(finalDesired, (existingRows || []) as any[])
  if (toInsert.length > 0) {
    await supabase.from('store_store_categories').insert(toInsert)
  }
  if (toDeleteIds.length > 0) {
    await supabase.from('store_store_categories').delete().in('id', toDeleteIds)
  }
}

async function applyStoreCategoryOverrides(supabase: any, links: any[]): Promise<any[]> {
  const productIds = Array.from(
    new Set(links.map((l) => String(l?.product_id || '').trim()).filter((v) => v.length > 0)),
  )
  const storeIds = Array.from(
    new Set(links.map((l) => String(l?.store_id || '').trim()).filter((v) => v.length > 0)),
  )
  if (productIds.length === 0 || storeIds.length === 0) return links

  const { data: products } = await supabase
    .from('store_products')
    .select('id, category_id, category_external_id, supplier_id')
    .in('id', productIds)

  const productMetaById = new Map<string, { categoryId: number | null; externalId: string; supplierId: number | null }>()
  for (const p of products || []) {
    const id = String((p as any)?.id || '').trim()
    if (!id) continue
    const categoryId = Number((p as any)?.category_id)
    const supplierId = Number((p as any)?.supplier_id)
    productMetaById.set(id, {
      categoryId: Number.isFinite(categoryId) ? categoryId : null,
      externalId: (p as any)?.category_external_id != null ? String((p as any).category_external_id) : '',
      supplierId: Number.isFinite(supplierId) ? supplierId : null,
    })
  }

  const categoryIds = Array.from(
    new Set(
      Array.from(productMetaById.values())
        .map((v) => Number(v.categoryId))
        .filter((v) => Number.isFinite(v)),
    ),
  )
  const externalIds = Array.from(
    new Set(
      Array.from(productMetaById.values())
        .map((v) => String(v.externalId || '').trim())
        .filter((v) => v.length > 0),
    ),
  )
  const supplierIds = Array.from(
    new Set(
      Array.from(productMetaById.values())
        .map((v) => Number(v.supplierId))
        .filter((v) => Number.isFinite(v)),
    ),
  )

  const categoryById = new Map<number, { name: string }>()
  if (categoryIds.length > 0) {
    const { data: categoryRows } = await supabase
      .from('store_categories')
      .select('id, name')
      .in('id', categoryIds)
    for (const row of categoryRows || []) {
      const id = Number((row as any)?.id)
      if (!Number.isFinite(id)) continue
      const name = String((row as any)?.name || '')
      if (name) categoryById.set(id, { name })
    }
  }

  const categoryByExternal = new Map<string, { name: string }>()
  if (externalIds.length > 0 && supplierIds.length > 0) {
    const { data: externalRows } = await supabase
      .from('store_categories')
      .select('id, name, external_id, supplier_id')
      .in('external_id', externalIds)
      .in('supplier_id', supplierIds)
    for (const row of externalRows || []) {
      const ext = String((row as any)?.external_id || '').trim().toLowerCase()
      const supplierId = Number((row as any)?.supplier_id)
      if (!ext || !Number.isFinite(supplierId)) continue
      const name = String((row as any)?.name || '')
      if (!name) continue
      categoryByExternal.set(`${supplierId}|${ext}`, { name })
    }
  }

  const storeCategoryByName = new Map<string, string>()
  const { data: storeCategories } = await supabase
    .from('store_store_categories')
    .select('id, external_id, custom_name, store_id, store_categories(name, external_id)')
    .in('store_id', storeIds)
  for (const row of storeCategories || []) {
    const storeId = String((row as any)?.store_id || '').trim()
    if (!storeId) continue
    const nameValue = (row as any)?.custom_name ?? (row as any)?.store_categories?.name ?? ''
    const nameNorm = normalizeCategoryName(nameValue)
    if (!nameNorm) continue
    const externalId =
      (row as any)?.external_id != null
        ? String((row as any).external_id)
        : (row as any)?.store_categories?.external_id != null
          ? String((row as any).store_categories.external_id)
          : ''
    if (!externalId) continue
    const key = `${storeId}|${nameNorm}`
    if (!storeCategoryByName.has(key)) {
      storeCategoryByName.set(key, externalId)
    }
  }

  return links.map((link) => {
    if ((link as any)?.custom_category_id != null) return link
    const productId = String((link as any)?.product_id || '').trim()
    const storeId = String((link as any)?.store_id || '').trim()
    if (!productId || !storeId) return link
    const meta = productMetaById.get(productId)
    if (!meta) return link
    let categoryName = ''
    if (meta.categoryId != null && Number.isFinite(meta.categoryId)) {
      categoryName = categoryById.get(Number(meta.categoryId))?.name || ''
    }
    if (!categoryName && meta.externalId && Number.isFinite(meta.supplierId)) {
      const extKey = `${Number(meta.supplierId)}|${String(meta.externalId).trim().toLowerCase()}`
      categoryName = categoryByExternal.get(extKey)?.name || ''
    }
    const nameNorm = normalizeCategoryName(categoryName)
    if (!nameNorm) return link
    const storeCategoryExternalId = storeCategoryByName.get(`${storeId}|${nameNorm}`)
    if (!storeCategoryExternalId) return link
    return { ...link, custom_category_id: String(storeCategoryExternalId) }
  })
}

async function setCountsToRedis(rows: Array<{ storeId: string; counts: ShopCounts }>): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const items = (rows || [])
    .map((r) => ({ storeId: String(r.storeId || '').trim(), counts: normalizeCounts(r.counts) }))
    .filter((r) => r.storeId.length > 0)
  if (items.length === 0) return

  const now = Date.now()
  await redisPipeline(
    items.map((r) => [
      'SET',
      buildCountsKey(r.storeId),
      JSON.stringify({ ...r.counts, ts: now }),
      'EX',
      SHOP_COUNTS_TTL_SECONDS,
    ]),
  )
}

async function recomputeCountsForStores(
  supabase: any,
  storeIds: string[],
): Promise<Array<{ storeId: string; counts: ShopCounts }>> {
  const ids = Array.from(new Set((storeIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (ids.length === 0) return []

  const { data: links } = await supabase
    .from('store_product_links')
    .select(
      'store_id, is_active, product_id, custom_category_id, store_products!inner(category_id,category_external_id,is_active)',
    )
    .in('store_id', ids)
    .eq('is_active', true)
    .eq('store_products.is_active', true)

  const customCategoryIds = Array.from(
    new Set(
      (links || [])
        .map((l: any) => Number(l?.custom_category_id))
        .filter((id: number) => Number.isFinite(id))
    )
  )
  const customCategoryLabelById = new Map<string, string>()
  if (customCategoryIds.length > 0) {
    const { data: customRows } = await supabase
      .from('store_categories')
      .select('id, external_id, name')
      .in('id', customCategoryIds)
    for (const row of customRows || []) {
      const id = row?.id != null ? String(row.id) : ''
      if (!id || customCategoryLabelById.has(id)) continue
      const label = row?.external_id != null ? String(row.external_id) : (row?.name != null ? String(row.name) : '')
      if (label) customCategoryLabelById.set(id, label)
    }
  }

  const productsCountByStore = new Map<string, number>()
  const categoriesSets = new Map<string, Set<string>>()

  for (const link of links || []) {
    const sid = (link as any)?.store_id
    if (!sid) continue
    const keyStore = String(sid)
    productsCountByStore.set(keyStore, (productsCountByStore.get(keyStore) || 0) + 1)

    const base = (link as any)?.store_products || {}
    const customCat = (link as any)?.custom_category_id
    const customLabel = customCat != null ? customCategoryLabelById.get(String(customCat)) : null
    const normalizedCustom = customLabel ? String(customLabel).trim().toLowerCase() : ''
    const customKey = normalizedCustom ? `name:${normalizedCustom}` : (customCat != null ? `cat:${String(customCat)}` : null)
    const normalizedExternal = base?.category_external_id != null ? String(base.category_external_id).trim().toLowerCase() : ''
    const catKey =
      customKey ||
      (normalizedExternal ? `ext:${normalizedExternal}` : null) ||
      (base?.category_id != null ? `cat:${String(base.category_id)}` : null)

    if (catKey) {
      if (!categoriesSets.has(keyStore)) categoriesSets.set(keyStore, new Set<string>())
      categoriesSets.get(keyStore)!.add(catKey)
    }
  }

  return ids.map((sid) => {
    const productsCount = productsCountByStore.get(sid) ?? 0
    const categoriesCount = productsCount === 0 ? 0 : (categoriesSets.get(sid)?.size ?? 0)
    return { storeId: sid, counts: normalizeCounts({ productsCount, categoriesCount }) }
  })
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

async function invalidateShopsList(userId: string | null | undefined): Promise<void> {
  const uid = String(userId || '').trim()
  if (!uid) return
  await redisPipeline([['DEL', buildShopsListKey(uid)]])
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
    let links: any[] = Array.isArray((body as any).links) ? ((body as any).links as any[]) : []

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

    try {
      links = await applyStoreCategoryOverrides(supabase, links)
    } catch {
      void 0
    }

    const productIds = Array.from(
      new Set(
        links
          .map((l: any) => String(l?.product_id || '').trim())
          .filter((v: string) => v.length > 0),
      ),
    )

    const { data: sourceProducts, error: sourceProductsError } = await supabase
      .from('store_products')
      .select('id, is_active')
      .in('id', productIds)

    if (sourceProductsError) {
      return new Response(
        JSON.stringify({ error: 'source_products_check_failed', message: sourceProductsError.message }),
        { status: 500, headers: CORS_HEADERS }
      )
    }

    const inactiveProductIds = new Set(
      (sourceProducts || [])
        .filter((row: any) => row?.is_active === false)
        .map((row: any) => String(row?.id || '').trim())
        .filter(Boolean),
    )

    if (inactiveProductIds.size > 0) {
      return new Response(
        JSON.stringify({
          error: 'inactive_products_not_allowed',
          message: 'Inactive products cannot be added to stores',
          product_ids: Array.from(inactiveProductIds),
        }),
        { status: 422, headers: CORS_HEADERS }
      )
    }

    const { data, error } = await supabase.rpc('bulk_insert_product_links', { input_links: links })

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
      const storeIds: string[] = Array.from(
        new Set(
          links
            .map((l: any) => String(l?.store_id || '').trim())
            .filter((v: string) => v.length > 0),
        ),
      )
      const productIds: string[] = Array.from(
        new Set(
          links
            .map((l: any) => String(l?.product_id || '').trim())
            .filter((v: string) => v.length > 0),
        ),
      )
      let userId: string | null = null
      try {
        const { data: userData } = await supabase.auth.getUser()
        userId = userData?.user?.id ? String(userData.user.id) : null
      } catch {
        userId = null
      }
      try {
        const rows = await recomputeCountsForStores(supabase, storeIds)
        await setCountsToRedis(rows)
      } catch {
        await invalidateCounts(storeIds)
      }
      try {
        await syncStoreCategoriesForStores(supabase, storeIds)
      } catch {
        void 0
      }
      await invalidateProductStores(productIds)
      await invalidateShopsList(userId)
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
