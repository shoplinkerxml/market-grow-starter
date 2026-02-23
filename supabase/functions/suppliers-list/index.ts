import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const SUPPLIERS_LIST_TTL_SECONDS = Math.max(
  5,
  Number(Deno.env.get('SUPPLIERS_LIST_TTL_SECONDS') || '60') || 60
)
const SUPPLIERS_LIST_KEY_PREFIX =
  Deno.env.get('SUPPLIERS_LIST_KEY_PREFIX') || 'suppliers:list:'

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

async function getSuppliersFromRedis(userId: string): Promise<unknown[] | null> {
  const uid = String(userId || '').trim()
  if (!uid) return null
  const resp = await redisPipeline([['GET', buildSuppliersKey(uid)]])
  const raw = resp?.[0]?.result
  if (!raw) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) return parsed
    const rows = (parsed as any)?.rows
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

async function setSuppliersToRedis(userId: string, suppliers: unknown[]): Promise<void> {
  const uid = String(userId || '').trim()
  if (!uid) return
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return
  await redisPipeline([
    [
      'SET',
      buildSuppliersKey(uid),
      JSON.stringify(suppliers || []),
      'EX',
      SUPPLIERS_LIST_TTL_SECONDS,
    ],
  ])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const serviceKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    if (!SUPABASE_URL || !serviceKey) {
      return jsonResponse(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      serviceKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Проверка аутентификации пользователя
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.log('User authentication failed', {
        error: userError?.message,
      })
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('User authenticated successfully', {
      userId: user.id,
    })

    try {
      const cached = await getSuppliersFromRedis(user.id)
      if (cached) return jsonResponse({ suppliers: cached })
    } catch {
      void 0
    }

    // Получение поставщиков только текущего пользователя
    const { data: suppliers, error: suppliersError } = await supabaseClient
      .from('user_suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (suppliersError) {
      console.log('Suppliers fetch error', {
        error: suppliersError.message,
      })
      return jsonResponse(
        { error: 'Failed to fetch suppliers' },
        { status: 500 }
      )
    }

    try {
      await setSuppliersToRedis(user.id, suppliers || [])
    } catch {
      void 0
    }

    return jsonResponse({
      suppliers: suppliers || []
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
