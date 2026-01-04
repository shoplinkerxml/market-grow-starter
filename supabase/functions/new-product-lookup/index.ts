import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

type SupplierRow = { id: string; supplier_name: string }
type CurrencyRow = { id: number; name: string; code: string; status: boolean | null }
type CategoryRow = { id: string; name: string; external_id: string; supplier_id: string; parent_external_id: string | null }

type CacheEntry<T> = { data: T; timestamp: number }

const LOOKUP_TTL = 120_000
const MAX_SUPPLIERS_CACHE_USERS = 200

const lookupCache: {
  suppliersByUser: Map<string, CacheEntry<SupplierRow[]>>
  currencies?: CacheEntry<CurrencyRow[]>
} = (globalThis as any).__newProductLookupCache || { suppliersByUser: new Map() }

;(globalThis as any).__newProductLookupCache = lookupCache

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

async function getSuppliersCached(supabase: any, userId: string): Promise<SupplierRow[]> {
  const cached = getCached(lookupCache.suppliersByUser.get(userId))
  if (cached) return cached

  const { data } = await supabase
    .from('user_suppliers')
    .select('id,supplier_name')
    .eq('user_id', userId)
    .order('supplier_name')

  const rows: SupplierRow[] = (data || []).map((s: any) => ({
    id: String(s.id),
    supplier_name: String(s.supplier_name || ''),
  }))

  pruneSuppliersByUser()
  lookupCache.suppliersByUser.set(userId, { data: rows, timestamp: Date.now() })
  return rows
}

async function getCurrenciesCached(supabase: any): Promise<CurrencyRow[]> {
  const cached = getCached(lookupCache.currencies)
  if (cached) return cached

  const { data } = await supabase
    .from('currencies')
    .select('id,name,code,status')
    .eq('status', true)
    .order('code')

  const rows: CurrencyRow[] = (data || []).map((c: any) => ({
    id: Number(c.id),
    name: String(c.name || ''),
    code: String(c.code || ''),
    status: c.status ?? null,
  }))

  lookupCache.currencies = { data: rows, timestamp: Date.now() }
  return rows
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 1. Справочники: постачальники + валюти
    const [suppliers, currencies] = await Promise.all([
      getSuppliersCached(supabase, user.id),
      getCurrenciesCached(supabase),
    ])

    // 2. Категории для всех поставщиков одним запросом
    const supplierIdsAll = suppliers
      .map((s) => Number(s.id))
      .filter((n) => Number.isFinite(n))

    let supplierCategoriesMap: Record<string, CategoryRow[]> = {}
    if (supplierIdsAll.length > 0) {
      const { data: catsAll } = await supabase
        .from('store_categories')
        .select('id,name,external_id,supplier_id,parent_external_id')
        .in('supplier_id', supplierIdsAll)
        .order('name')

      const catsAllRows = (catsAll || []) as any[]
      for (const c of catsAllRows) {
        const key = String(c.supplier_id)
        const item: CategoryRow = {
          id: String(c.id),
          name: String(c.name || ''),
          external_id: String(c.external_id || ''),
          supplier_id: String(c.supplier_id || ''),
          parent_external_id: c.parent_external_id == null ? null : String(c.parent_external_id),
        }
        if (!supplierCategoriesMap[key]) supplierCategoriesMap[key] = []
        supplierCategoriesMap[key].push(item)
      }
    }

    const payload = {
      suppliers,
      currencies,
      supplierCategoriesMap,
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (e: any) {
    const msg = e?.message || 'aggregation_failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
