import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
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

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Получаем пользователя
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
      email: user.email,
    })

    // Параллельно получаем все данные
    const [
      { data: profile, error: profileError },
      { data: subscriptions, error: subscriptionError },
      { data: menuItems, error: menuItemsError },
      { data: userStores, error: userStoresError },
    ] = await Promise.all([
      // Профиль пользователя
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),

      // ВСЕ подписки пользователя (не только активные)
      // Получаем с тарифом за один запрос
      supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          tariffs (*)
        `)
        .eq('user_id', user.id)
        .order('start_date', { ascending: false }),

      // Пункты меню
      supabaseClient
        .from('user_menu_items')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true }),

      supabaseClient
        .from('user_stores')
        .select('id, store_name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('store_name', { ascending: true }),
    ])

    // Обработка ошибок профиля
    if (profileError) {
      console.log('Profile fetch error', { error: profileError.message })
      return jsonResponse({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (!profile) {
      console.log('Profile not found for user', { userId: user.id })
      return jsonResponse({ error: 'Profile not found' }, { status: 404 })
    }

    // Логируем ошибки, но не прерываем выполнение
    if (subscriptionError) {
      console.log('Subscription fetch error', {
        error: subscriptionError.message,
      })
    }

    if (menuItemsError) {
      console.log('Menu items fetch error', {
        error: menuItemsError.message,
      })
    }

    if (userStoresError) {
      console.log('User stores fetch error', {
        error: userStoresError.message,
      })
    }

    // Находим РЕАЛЬНО активную подписку
    // Проверяем is_active И дату окончания
    const now = new Date()
    let activeSubscription = null

    if (subscriptions && subscriptions.length > 0) {
      activeSubscription = subscriptions.find(sub => {
        // Подписка должна быть is_active = true
        if (!sub.is_active) return false
        
        // Если end_date = null (бессрочная), то подписка активна
        if (!sub.end_date) return true
        
        // Иначе проверяем, что дата окончания еще не наступила
        const endDate = new Date(sub.end_date)
        return endDate > now
      })

      // Если активной подписки не найдено, берем самую свежую
      if (!activeSubscription && subscriptions.length > 0) {
        activeSubscription = subscriptions[0]
      }
    }

    // Получаем лимиты тарифа (если есть подписка)
    let tariffLimits: Array<{ limit_name: string; value: number }> = []
    
    if (activeSubscription?.tariffs?.id) {
      const { data: limits, error: limitsError } = await supabaseClient
        .from('tariff_limits')
        .select('limit_name, value')
        .eq('tariff_id', activeSubscription.tariffs.id)
        .eq('is_active', true)

      if (limitsError) {
        console.log('Tariff limits fetch error', {
          error: limitsError.message,
        })
      } else if (limits) {
        tariffLimits = limits
      }
    }

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        ...(profile && typeof profile === 'object' ? profile : {}),
      },
      subscription: activeSubscription || null,
      tariffLimits,
      menuItems: menuItems || [],
      userStores: userStores || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse({ error: 'Internal server error' }, { status: 500 })
  }
})
