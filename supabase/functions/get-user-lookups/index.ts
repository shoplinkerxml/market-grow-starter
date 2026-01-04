import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })

type CacheEntry<T> = { data: T; timestamp: number }
const cache = new Map<string, CacheEntry<any>>()
const CACHE_TTL = 30 * 60 * 1000
const MAX_CACHE_KEYS = 200

function pruneCache(): void {
  const now = Date.now()
  for (const [k, v] of cache) {
    if (!v || now - v.timestamp > CACHE_TTL) cache.delete(k)
  }
  while (cache.size > MAX_CACHE_KEYS) {
    const firstKey = cache.keys().next().value as string | undefined
    if (!firstKey) break
    cache.delete(firstKey)
  }
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache<T>(key: string, data: T): void {
  pruneCache()
  cache.set(key, { data, timestamp: Date.now() })
  while (cache.size > MAX_CACHE_KEYS) {
    const firstKey = cache.keys().next().value as string | undefined
    if (!firstKey) break
    cache.delete(firstKey)
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Configuration error' }, 500)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const cacheKey = `lookups:${user.id}`
    const cached = getCached(cacheKey)
    if (cached) {
      return jsonResponse(cached)
    }

    const [suppliersResult, currenciesResult] = await Promise.all([
      client
        .from('user_suppliers')
        .select('id, supplier_name')
        .eq('user_id', user.id)
        .order('supplier_name'),
      client
        .from('currencies')
        .select('id, name, code, status')
        .eq('status', true)
        .order('code'),
    ])

    const suppliers = (suppliersResult.data || []).map((s: any) => ({
      id: String(s.id),
      supplier_name: s.supplier_name || '',
    }))

    const currencies = (currenciesResult.data || []).map((c: any) => ({
      id: c.id,
      name: c.name || '',
      code: c.code || '',
      status: c.status ?? true,
    }))

    const supplierIdsAll = suppliers
      .map((s: any) => Number(s.id))
      .filter((n: number) => Number.isFinite(n))

    const categoriesResult =
      supplierIdsAll.length > 0
        ? await client
            .from('store_categories')
            .select('id, name, external_id, supplier_id, parent_external_id')
            .in('supplier_id', supplierIdsAll)
            .order('name')
        : ({ data: [] } as any)

    const supplierCategoriesMap: Record<string, any[]> = {}
    for (const cat of categoriesResult.data || []) {
      const sid = String((cat as any).supplier_id)
      if (!supplierCategoriesMap[sid]) supplierCategoriesMap[sid] = []
      supplierCategoriesMap[sid].push({
        id: String((cat as any).id),
        name: (cat as any).name || '',
        external_id: String((cat as any).external_id || ''),
        supplier_id: sid,
        parent_external_id: (cat as any).parent_external_id ? String((cat as any).parent_external_id) : null,
      })
    }

    const result = { suppliers, currencies, supplierCategoriesMap }
    setCache(cacheKey, result)
    return jsonResponse(result)
  } catch {
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
