import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { product_id?: string; url?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const tokenHdr = req.headers.get('X-Worker-Token') || req.headers.get('x-worker-token') || ''
    const expected = Deno.env.get('WORKER_SHARED_SECRET') || Deno.env.get('WORKER_TOKEN') || ''
    console.log('create-image-row: tokenHdr length:', tokenHdr.length, 'expected length:', expected.length, 'match:', tokenHdr === expected)
    if (!expected || tokenHdr !== expected) {
      console.log('create-image-row: unauthorized - token mismatch')
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body: Body = await req.json().catch(() => ({}) as Body)
    const productId = (body?.product_id ? String(body.product_id) : '').trim()
    const url = (body?.url ? String(body.url) : '').trim()
    if (!productId || !url) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: supabaseKey ? { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } : {} } })

    // Determine next order_index
    let nextOrder = 0
    const { data: lastRow } = await supabase
      .from('store_product_images')
      .select('order_index')
      .eq('product_id', productId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastRow && typeof (lastRow as any).order_index === 'number') {
      nextOrder = Number((lastRow as any).order_index) + 1
    }

    const insertPayload: Record<string, unknown> = {
      product_id: productId,
      url,
      order_index: nextOrder,
      is_main: false,
    }

    const { data: inserted, error } = await supabase
      .from('store_product_images')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'insert_failed', message: (error as any)?.message || '' }), { status: 500, headers: corsHeaders })
    }

    const imageId = Number((inserted as any)?.id || 0)
    return new Response(JSON.stringify({ image_id: imageId }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
