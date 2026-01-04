import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = {
  supplier_name?: string
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
    const name = (body?.supplier_name || '').trim()
    if (!name) {
      return new Response(JSON.stringify({ error: 'validation_failed', message: 'supplier_name required' }), { status: 422, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from('user_suppliers')
      .insert({
        user_id: user.id,
        supplier_name: name,
        website_url: body?.website_url ?? null,
        xml_feed_url: body?.xml_feed_url ?? null,
        phone: body?.phone ?? null,
      })
      .select('*')
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'create_failed', message: (error as any)?.message }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ supplier: data }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})

