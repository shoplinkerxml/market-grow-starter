import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { store_id?: string | null; store_ids?: string[] | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    const body = (await req.json().catch(() => ({}))) as Body
    const list = Array.isArray(body?.store_ids)
      ? (body?.store_ids || []).map((v) => String(v || '').trim()).filter(Boolean)
      : []
    const single = String(body?.store_id || '').trim()
    const storeIds = list.length > 0 ? Array.from(new Set(list)) : (single ? [single] : [])
    if (storeIds.length === 0) {
      return new Response(JSON.stringify({ error: 'store_id_required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const url = Deno.env.get('SUPABASE_URL') || ''
    const key = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'misconfigured_supabase' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(url, key, {
      global: authHeader ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })

    // 1. Ссылки и маппинг категорий для всех магазинов — одним запросом на каждую таблицу
    const [{ data: links, error: linksErr }, { data: maps, error: mapsErr }] =
      await Promise.all([
        (supabase as any)
          .from('store_product_links')
          .select(
            'is_active,custom_category_id,store_id,store_products(category_id,category_external_id)',
          )
          .in('store_id', storeIds),
        (supabase as any)
          .from('store_store_categories')
          .select('store_id,category_id,external_id,is_active')
          .in('store_id', storeIds),
      ])

    if (linksErr) {
      return new Response(JSON.stringify({ error: 'links_fetch_failed' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (mapsErr) {
      return new Response(JSON.stringify({ error: 'maps_fetch_failed' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const byStoreCatId: Record<string, Record<string, string | null>> = {}
    for (const m of maps || []) {
      const active = (m as any)?.is_active !== false
      if (!active) continue
      const sid = String((m as any)?.store_id || '')
      const cid = (m as any)?.category_id != null ? String((m as any).category_id) : null
      const ext = (m as any)?.external_id != null ? String((m as any).external_id) : null
      if (!sid || !cid) continue
      if (!byStoreCatId[sid]) byStoreCatId[sid] = {}
      byStoreCatId[sid][cid] = ext || null
    }

    const idsByStore: Record<string, Set<string>> = {}
    const extsByStore: Record<string, Set<string>> = {}
    for (const r of links || []) {
      const active = (r as any)?.is_active !== false
      if (!active) continue
      const sid = String((r as any)?.store_id || '')
      if (!sid) continue

      const linkExt = (r as any)?.custom_category_id != null ? String((r as any).custom_category_id) : null
      const baseCid = (r as any)?.store_products?.category_id != null ? String((r as any).store_products.category_id) : null
      const baseExt = (r as any)?.store_products?.category_external_id != null ? String((r as any).store_products.category_external_id) : null

      if (!idsByStore[sid]) idsByStore[sid] = new Set<string>()
      if (!extsByStore[sid]) extsByStore[sid] = new Set<string>()

      if (linkExt) {
        extsByStore[sid].add(linkExt)
      } else if (baseCid && byStoreCatId[sid] && byStoreCatId[sid][baseCid]) {
        extsByStore[sid].add(String(byStoreCatId[sid][baseCid]))
      } else if (baseExt) {
        extsByStore[sid].add(baseExt)
      } else if (baseCid) {
        idsByStore[sid].add(baseCid)
      }
    }

    const allIdSet = new Set<string>()
    const allExtSet = new Set<string>()
    for (const sid of storeIds) {
      const ids = Array.from(idsByStore[sid] || [])
      const exts = Array.from(extsByStore[sid] || [])
      for (const v of ids) allIdSet.add(v)
      for (const v of exts) allExtSet.add(v)
    }
    const idListAll = Array.from(allIdSet)
    const extListAll = Array.from(allExtSet)
    if (idListAll.length === 0 && extListAll.length === 0) {
      // Возвращаем пустые списки для всех магазинов
      const results: Record<string, string[]> = {}
      for (const sid of storeIds) results[sid] = []
      return new Response(JSON.stringify({ names: [], results }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // 2. Все запросы к store_categories — одним проходом (параллельно по id и external_id)
    const [catByIdRes, catByExtRes] = await Promise.all([
      idListAll.length
        ? (supabase as any).from('store_categories').select('id,name').in('id', idListAll)
        : Promise.resolve({ data: [] }),
      extListAll.length
        ? (supabase as any).from('store_categories').select('external_id,name').in('external_id', extListAll)
        : Promise.resolve({ data: [] }),
    ])

    const catRows = (catByIdRes as any)?.data || []
    const extCatRows = (catByExtRes as any)?.data || []

    const nameById = new Map<string, string>()
    const nameByExt = new Map<string, string>()
    for (const r of catRows) {
      const id = String((r as any)?.id || '')
      const name = (r as any)?.name
      if (id && name) nameById.set(id, String(name))
    }
    for (const r of extCatRows) {
      const ext = String((r as any)?.external_id || '')
      const name = (r as any)?.name
      if (ext && name) nameByExt.set(ext, String(name))
    }

    const results: Record<string, string[]> = {}
    for (const sid of storeIds) {
      const namesSet = new Set<string>()
      const ids = Array.from(idsByStore[sid] || [])
      const exts = Array.from(extsByStore[sid] || [])
      for (const id of ids) {
        const name = nameById.get(id)
        if (name) namesSet.add(name)
      }
      for (const ext of exts) {
        const name = nameByExt.get(ext)
        if (name) namesSet.add(name)
      }
      results[sid] = Array.from(namesSet).sort((a, b) => a.localeCompare(b))
    }

    // Для совместимости оставляем поле names, если передан один магазин
    const names = storeIds.length === 1 ? (results[storeIds[0]] || []) : []

    return new Response(JSON.stringify({ names, results }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (e) {
    const msg = (e as any)?.message || 'aggregation_failed'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
