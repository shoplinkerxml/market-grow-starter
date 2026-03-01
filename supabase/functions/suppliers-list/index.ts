import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const CACHE_TTL = Math.max(
  5,
  Number(Deno.env.get('SUPPLIERS_LIST_TTL_SECONDS') || '60') || 60
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  })

// Simple Redis GET via REST API
async function getFromRedis(key: string): Promise<unknown[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, '')
    const res = await fetch(`${base}/get/${key}`, {
      headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.result
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : null
  } catch (err) {
    console.warn('Redis GET error:', err)
    return null
  }
}

// Simple Redis SET via REST API
async function setToRedis(key: string, value: unknown[]): Promise<void> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, '')
    await fetch(`${base}/set/${key}/${encodeURIComponent(JSON.stringify(value))}/ex/${CACHE_TTL}`, {
      headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}` },
    })
  } catch (err) {
    console.warn('Redis SET error:', err)
  }
}

function buildCacheKey(userId: string): string {
  return `suppliers:list:${userId}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
      return jsonResponse({ error: 'Configuration error' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    // Single Supabase client — RLS handles user filtering
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Auth failed:', userError?.message)
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try cache first
    const cacheKey = buildCacheKey(user.id)
    try {
      const cached = await getFromRedis(cacheKey)
      if (cached) {
        return jsonResponse({ suppliers: cached })
      }
    } catch {
      // Cache miss, proceed to DB
    }

    // Query DB — RLS automatically filters by user_id
    const { data: suppliers, error: dbError } = await supabase
      .from('user_suppliers')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('DB error:', {
        message: dbError.message,
        code: (dbError as any)?.code,
        details: (dbError as any)?.details,
        hint: (dbError as any)?.hint,
      })
      return jsonResponse({ error: 'Failed to fetch suppliers' }, { status: 500 })
    }

    // Cache result
    try {
      await setToRedis(cacheKey, suppliers || [])
    } catch {
      // Non-critical
    }

    return jsonResponse({ suppliers: suppliers || [] })
  } catch (error) {
    console.error('Unexpected error:', {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    })
    return jsonResponse({ error: 'Internal server error' }, { status: 500 })
  }
})
