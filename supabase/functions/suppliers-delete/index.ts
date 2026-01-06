import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SUPPLIERS_LIST_KEY_PREFIX =
  Deno.env.get('SUPPLIERS_LIST_KEY_PREFIX') || 'suppliers:list:'

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, '')
    const res = await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}

function buildSuppliersKey(userId: string): string {
  return `${SUPPLIERS_LIST_KEY_PREFIX}${userId}`
}

async function invalidateSuppliersList(userId: string): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  const uid = String(userId || '').trim()
  if (!uid) return
  await redisPipeline([['DEL', buildSuppliersKey(uid)]])
}

type Body = { id?: number }

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

    const { error } = await supabase
      .from('user_suppliers')
      .delete()
      .eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: 'delete_failed', message: (error as any)?.message }), { status: 500, headers: corsHeaders })
    }

    try {
      await invalidateSuppliersList(user.id)
    } catch {
      void 0
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
