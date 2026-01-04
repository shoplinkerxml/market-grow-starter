import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type RequestBody = { store_id?: string | null }

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  })

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: 'misconfigured_supabase' }, { status: 500 })

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, { status: 401 })

    const apiKey = req.headers.get('apikey') || SUPABASE_ANON_KEY
    const supabase = (createClient as any)(SUPABASE_URL, apiKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    })

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user) return json({ error: 'unauthorized' }, { status: 401 })

    let body: RequestBody = {}
    try { body = (await req.json()) as RequestBody } catch {}
    const storeId = String(body?.store_id || '').trim()
    if (!storeId) return json({ error: 'validation_failed' }, { status: 422 })

    const { data: storeRow, error: storeErr } = await supabase
      .from('user_stores')
      .select('id, user_id, store_name, store_company, store_url, template_id, xml_config, custom_mapping, is_active, created_at, updated_at')
      .eq('id', storeId)
      .maybeSingle()
    if (storeErr) return json({ error: 'db_error' }, { status: 500 })
    if (!storeRow || String((storeRow as any).user_id) !== userRes.user.id) return json({ error: 'forbidden' }, { status: 403 })

    let shopMarketplace: string | null = null
    if ((storeRow as any).template_id) {
      const { data: tpl, error: tplErr } = await supabase
        .from('store_templates')
        .select('marketplace')
        .eq('id', String((storeRow as any).template_id))
        .maybeSingle()
      if (!tplErr && tpl && (tpl as any)?.marketplace) {
        shopMarketplace = String((tpl as any).marketplace)
      }
    }

    const [productsRes, storeCurrenciesRes, availCurRes, storeCatsRes, marketplacesRes] = await Promise.all([
      supabase.from('store_products').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      supabase.from('store_currencies').select('code, rate, is_base, created_at').eq('store_id', storeId).order('created_at', { ascending: true }),
      supabase.from('currencies').select('code, rate'),
      supabase.from('store_store_categories').select('id, store_id, category_id, custom_name, external_id, rz_id_value, is_active').eq('store_id', storeId),
      supabase.from('store_templates').select('marketplace').eq('is_active', true),
    ])

    if (productsRes.error || storeCurrenciesRes.error || availCurRes.error || storeCatsRes.error || marketplacesRes.error) {
      return json({ error: 'db_error' }, { status: 500 })
    }

    const productsCount = Number(productsRes.count || 0)

    const storeCurrencies = (storeCurrenciesRes.data || []).map((r: any) => ({
      code: String(r.code),
      rate: Number(r.rate ?? 1),
      is_base: Boolean(r.is_base),
    }))

    const availableCurrencies = (availCurRes.data || []).map((r: any) => ({
      code: String(r.code),
      rate: r.rate != null ? Number(r.rate) : undefined,
    }))

    const catRows = (storeCatsRes.data || []) as Array<{
      id: number
      store_id: string
      category_id: number
      custom_name?: string | null
      external_id?: string | null
      rz_id_value?: string | null
      is_active: boolean
    }>

    const catIds = Array.from(new Set(catRows.map((r) => r.category_id).filter((v) => Number.isFinite(v))))

    const { data: baseCats, error: baseErr } = catIds.length
      ? await supabase.from('store_categories').select('id, name, external_id, parent_external_id, rz_id').in('id', catIds)
      : { data: [], error: null }
    if (baseErr) return json({ error: 'db_error' }, { status: 500 })

    const baseById = new Map<number, any>()
    for (const b of baseCats || []) {
      const id = Number((b as any)?.id)
      if (Number.isFinite(id)) baseById.set(id, b)
    }

    const categories = catRows.map((row) => {
      const base = baseById.get(row.category_id) || {}
      return {
        store_category_id: Number(row.id),
        store_id: String(row.store_id),
        category_id: Number(row.category_id),
        name: String(row.custom_name ?? base?.name ?? ''),
        base_external_id: base?.external_id != null ? String(base.external_id) : null,
        parent_external_id: base?.parent_external_id != null ? String(base.parent_external_id) : null,
        base_rz_id: base?.rz_id != null ? String(base.rz_id) : null,
        store_external_id: row.external_id != null ? String(row.external_id) : null,
        store_rz_id_value: row.rz_id_value != null ? String(row.rz_id_value) : null,
        is_active: row.is_active !== false,
      }
    })

    const rawMarketplaces = (marketplacesRes.data || [])
      .map((r: any) => (r?.marketplace ? String(r.marketplace) : null))
      .filter((v: string | null): v is string => !!v)
    const marketplaces: string[] = Array.from(new Set(rawMarketplaces))
      .map((v) => String(v))
      .sort((a, b) => a.localeCompare(b))

    return json({
      shop: { ...(storeRow as any), marketplace: shopMarketplace },
      productsCount,
      storeCurrencies,
      availableCurrencies,
      categories,
      marketplaces,
    })
  } catch (e) {
    return json({ error: (e as any)?.message || 'failed' }, { status: 500 })
  }
})
