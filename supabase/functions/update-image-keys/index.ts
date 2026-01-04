import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { image_id?: number; r2_key_card?: string; r2_key_thumb?: string; r2_key_original?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const tokenHdr = req.headers.get('X-Worker-Token') || ''
    const expected = Deno.env.get('WORKER_SHARED_SECRET') || Deno.env.get('WORKER_TOKEN') || ''
    if (!expected || tokenHdr !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body: Body = await req.json().catch(() => ({}) as Body)
    const imageId = typeof body?.image_id === 'number' ? body.image_id : NaN
    const r2Card = body?.r2_key_card ? String(body.r2_key_card) : ''
    const r2Thumb = body?.r2_key_thumb ? String(body.r2_key_thumb) : ''
    if (!Number.isFinite(imageId)) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: supabaseKey ? { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } : {} } })

    const patch: Record<string, string> = {}
    if (r2Card) patch['r2_key_card'] = r2Card
    if (r2Thumb) patch['r2_key_thumb'] = r2Thumb
    const r2Orig = body?.r2_key_original ? String(body.r2_key_original) : ''
    if (r2Orig) patch['r2_key_original'] = r2Orig
    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: 'nothing_to_update' }), { status: 400, headers: corsHeaders })
    }

    const { error } = await supabase
      .from('store_product_images')
      .update(patch)
      .eq('id', imageId)
    if (error) {
      const msg = (error as any)?.message || ''
      return new Response(JSON.stringify({ error: 'update_failed', message: msg }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
