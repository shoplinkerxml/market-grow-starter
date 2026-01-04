import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user) return json({ error: 'unauthorized' }, { status: 401 })

    let body: RequestBody = {}
    try { body = (await req.json()) as RequestBody } catch {}
    const storeId = String(body?.store_id || '').trim()
    if (!storeId) return json({ error: 'validation_failed' }, { status: 422 })

    const { data: storeRow, error: storeErr } = await supabase
      .from('user_stores')
      .select('id, user_id, is_active')
      .eq('id', storeId)
      .maybeSingle()
    if (storeErr) return json({ error: 'db_error' }, { status: 500 })
    if (!storeRow || String((storeRow as any).user_id) !== userRes.user.id || (storeRow as any)?.is_active === false) {
      return json({ error: 'forbidden' }, { status: 403 })
    }

    const { data: sscRows, error: sscErr } = await supabase
      .from('store_store_categories')
      .select('id, store_id, category_id, custom_name, external_id, rz_id_value, is_active')
      .eq('store_id', storeId)
    if (sscErr) return json({ error: 'db_error' }, { status: 500 })

    const categoryIds = Array.from(new Set((sscRows || []).map((r: any) => Number(r.category_id)).filter((n) => Number.isFinite(n))))
    const { data: baseCats, error: baseErr } = categoryIds.length
      ? await supabase
          .from('store_categories')
          .select('id, name, external_id, parent_external_id, rz_id')
          .in('id', categoryIds)
      : { data: [], error: null }
    if (baseErr) return json({ error: 'db_error' }, { status: 500 })

    const baseById = new Map<number, any>()
    for (const b of baseCats || []) {
      const id = Number((b as any)?.id)
      if (Number.isFinite(id)) baseById.set(id, b)
    }

    const rows = (sscRows || []).map((row: any) => {
      const base = baseById.get(Number(row.category_id)) || {}
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

    return json({ rows })
  } catch (e) {
    return json({ error: (e as any)?.message || 'failed' }, { status: 500 })
  }
})

