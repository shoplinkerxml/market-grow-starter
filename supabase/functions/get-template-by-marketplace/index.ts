import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { marketplace?: string | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const body: Body = await req.json().catch(() => ({}) as Body)
    const marketplace = body?.marketplace ? String(body.marketplace) : ''
    if (!marketplace) return new Response(JSON.stringify({ error: 'marketplace_required' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: authHeader ? { Authorization: `Bearer ${token}` } : {} } }
    )

    const { data, error } = await (supabase as any)
      .from('store_templates')
      .select('id,xml_structure,mapping_rules')
      .eq('marketplace', marketplace)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return new Response(JSON.stringify({ error: 'template_fetch_failed' }), { status: 500, headers: corsHeaders })
    if (!data) return new Response(JSON.stringify({ error: 'template_not_found' }), { status: 404, headers: corsHeaders })

    return new Response(JSON.stringify({ template: data }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'template_lookup_failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})

