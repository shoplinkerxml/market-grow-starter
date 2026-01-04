import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

type Body = { product_id?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: authHeader ? { Authorization: `Bearer ${token}` } : {} } }
    )

    const body: Body = await req.json().catch(() => ({} as Body))
    const productId = body?.product_id ? String(body.product_id) : ''

    if (!productId) return new Response(JSON.stringify({ store_ids: [] }), { status: 200, headers: corsHeaders })

    const { data, error } = await supabase
      .from('store_product_links')
      .select('store_id,is_active')
      .eq('product_id', productId)

    if (error) return new Response(JSON.stringify({ error: 'links_fetch_failed' }), { status: 500, headers: corsHeaders })

    const storeIds: string[] = []
    for (const r of data || []) {
      const sid = (r as any)?.store_id != null ? String((r as any).store_id) : ''
      const active = (r as any)?.is_active !== false
      if (sid && active) storeIds.push(sid)
    }

    return new Response(JSON.stringify({ store_ids: storeIds }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'links_fetch_failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})

