import { createClient } from '@supabase/supabase-js'
import type { Database } from '../_shared/database-types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
}

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

    const supabaseClient = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
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