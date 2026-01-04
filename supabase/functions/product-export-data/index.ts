import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { product_ids?: string[]; store_id?: string | null }

function parseQuery(req: Request): Body {
  const url = new URL(req.url)
  const ids = url.searchParams.getAll('product_id')
  const sid = url.searchParams.get('store_id')
  return { product_ids: ids.length ? ids : undefined, store_id: sid }
}

async function parseBody(req: Request): Promise<Body> {
  if (req.method === 'GET') return parseQuery(req)
  try {
    const raw = await req.json()
    const idsRaw = (raw as any)?.product_ids
    const product_ids = Array.isArray(idsRaw)
      ? idsRaw.map((v: any) => String(v || '')).filter((s: string) => !!s)
      : undefined
    const sidRaw = (raw as any)?.store_id
    const sid = sidRaw == null ? null : String(sidRaw)
    return { product_ids, store_id: sid }
  } catch {
    return { product_ids: undefined, store_id: null }
  }
}

function resolvePublicBase(): string {
  const host = Deno.env.get('R2_PUBLIC_HOST') || ''
  if (host) {
    const h = host.startsWith('http') ? host : `https://${host}`
    try {
      const u = new URL(h)
      return `${u.protocol}//${u.host}`
    } catch {
      return h
    }
  }
  const raw =
    Deno.env.get('R2_PUBLIC_BASE_URL') ||
    Deno.env.get('IMAGE_BASE_URL') ||
    'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev'
  if (!raw) return 'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev'
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const origin = `${u.protocol}//${u.host}`
    const path = (u.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '')
    return path ? `${origin}/${path}` : origin
  } catch {
    return raw
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    const body = await parseBody(req)
    const rawIds = Array.isArray(body.product_ids) ? body.product_ids : []
    const uniqueIds = Array.from(
      new Set((rawIds || []).map((v) => String(v || '').trim()).filter(Boolean)),
    ).slice(0, 1000)

    if (uniqueIds.length === 0) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global:
        authHeader && token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {},
    })

    const [
      { data: productRows, error: productErr },
      imagesResult,
      { data: paramRows, error: paramsErr },
    ] = await Promise.all([
      supabase.from('store_products').select('*').in('id', uniqueIds),
      supabase
        .from('store_product_images')
        .select('id,product_id,url,order_index,is_main,r2_key_original,alt_text')
        .in('product_id', uniqueIds)
        .order('order_index'),
      supabase
        .from('store_product_params')
        .select('id,product_id,name,value,order_index,paramid,valueid')
        .in('product_id', uniqueIds)
        .order('order_index'),
    ])

    if (productErr) {
      return new Response(JSON.stringify({ error: 'products_fetch_failed' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (paramsErr) {
      return new Response(JSON.stringify({ error: 'params_fetch_failed' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const productsById = new Map<string, any>()
    for (const p of (productRows || []) as any[]) {
      if (!p?.id) continue
      productsById.set(String(p.id), p)
    }

    const imageBase = resolvePublicBase()
    const imagesByProductId = new Map<string, any[]>()
    const imageRows = imagesResult?.data
    for (const img of (Array.isArray(imageRows) ? imageRows : []) as any[]) {
      const pid = String(img.product_id || '')
      if (!pid) continue
      const r2o = img.r2_key_original ? String(img.r2_key_original) : ''
      const originalUrl = r2o && imageBase ? `${imageBase}/${r2o}` : null
      const fallbackUrl = String(img.url || '')
      const list = imagesByProductId.get(pid) || []
      list.push({
        id: img.id != null ? String(img.id) : undefined,
        product_id: pid,
        url: originalUrl || fallbackUrl,
        order_index: typeof img.order_index === 'number' ? img.order_index : list.length,
        is_main: img.is_main === true,
        r2_key_original: r2o || null,
        alt_text: img.alt_text != null ? String(img.alt_text) : undefined,
      })
      imagesByProductId.set(pid, list)
    }

    const paramsByProductId = new Map<string, any[]>()
    for (const p of (Array.isArray(paramRows) ? paramRows : []) as any[]) {
      const pid = String(p.product_id || '')
      if (!pid) continue
      const list = paramsByProductId.get(pid) || []
      list.push({
        id: p.id != null ? String(p.id) : undefined,
        product_id: pid,
        name: String(p.name || ''),
        value: String(p.value || ''),
        order_index: typeof p.order_index === 'number' ? p.order_index : list.length,
        paramid: p.paramid ?? null,
        valueid: p.valueid ?? null,
      })
      paramsByProductId.set(pid, list)
    }

    const items = uniqueIds
      .map((id) => {
        const product = productsById.get(String(id)) || null
        if (!product) return null
        const pid = String(product.id)
        return {
          product,
          images: imagesByProductId.get(pid) || [],
          params: paramsByProductId.get(pid) || [],
          store_id: body.store_id ? String(body.store_id) : null,
        }
      })
      .filter(Boolean)

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (e: any) {
    const msg = e?.message || 'aggregation_failed'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})

