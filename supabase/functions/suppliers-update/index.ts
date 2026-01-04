import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = {
  id?: number
  supplier_name?: string | null
  website_url?: string | null
  xml_feed_url?: string | null
  phone?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body: Body = await req.json().catch(() => ({} as Body))
    const id = Number(body?.id ?? NaN)
    if (!Number.isFinite(id)) {
      return new Response(JSON.stringify({ error: 'validation_failed', message: 'id required' }), { status: 422, headers: corsHeaders })
    }

    const { data: existing } = await supabase
      .from('user_suppliers')
      .select('id,user_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing || String((existing as any).user_id) !== String(user.id)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders })
    }

    const patch: Record<string, any> = {}
    if (body.supplier_name != null) {
      const name = String(body.supplier_name || '').trim()
      if (!name) {
        return new Response(JSON.stringify({ error: 'validation_failed', message: 'supplier_name required' }), { status: 422, headers: corsHeaders })
      }
      patch['supplier_name'] = name
    }
    if (body.website_url !== undefined) patch['website_url'] = body.website_url ?? null
    if (body.xml_feed_url !== undefined) patch['xml_feed_url'] = body.xml_feed_url ?? null
    if (body.phone !== undefined) patch['phone'] = body.phone ?? null
    patch['updated_at'] = new Date().toISOString()

    const { data, error } = await supabase
      .from('user_suppliers')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'update_failed', message: (error as any)?.message }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ supplier: data }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})

