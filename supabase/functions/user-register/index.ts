import { createClient } from '@supabase/supabase-js'

// ============================================================================
// УПРОЩЕННАЯ EDGE FUNCTION ДЛЯ РЕГИСТРАЦИИ
// ============================================================================
// Эта функция только создает пользователя в auth.users
// Всё остальное делают триггеры автоматически:
// 1. on_auth_user_created → создает профиль в profiles
// 2. on_user_created_add_demo → создает подписку в user_subscriptions
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  })

type RegisterPayload = {
  email?: string
  password?: string
  name?: string
}

// ============================================================================
// ВАЛИДАЦИЯ
// ============================================================================
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPassword(password: string): boolean {
  return password.length >= 8
}

// ============================================================================
// ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================================
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 })
  }

  try {
    // ========================================
    // 1. Парсинг и валидация входных данных
    // ========================================
    const payload = (await req.json()) as RegisterPayload
    const email = String(payload.email || '').trim().toLowerCase()
    const password = String(payload.password || '')
    const name = String(payload.name || '').trim()

    if (!email || !password) {
      return jsonResponse(
        { error: 'invalid_input', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        { error: 'invalid_email', message: 'Invalid email format' },
        { status: 400 }
      )
    }

    if (!isValidPassword(password)) {
      return jsonResponse(
        { 
          error: 'weak_password', 
          message: 'Password must be at least 8 characters' 
        },
        { status: 400 }
      )
    }

    // ========================================
    // 2. Создание Supabase клиента
    // ========================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // ========================================
    // 3. Создание пользователя
    // Триггеры автоматически создадут:
    // - Профиль (on_auth_user_created)
    // - Подписку (on_user_created_add_demo)
    // ========================================
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || email.split('@')[0],
        role: 'user',
      },
    })

    if (authError || !authData?.user) {
      console.error('Registration failed:', authError?.message)
      const message = authError?.message || 'Failed to create user'

      // Проверка на дубликат email
      if (
        message.includes('duplicate') ||
        message.includes('already exists') ||
        message.includes('User already registered')
      ) {
        return jsonResponse(
          { error: 'email_exists', message: 'This email is already registered' },
          { status: 409 }
        )
      }

      // Проверка на слабый пароль
      if (message.toLowerCase().includes('password')) {
        return jsonResponse(
          { error: 'weak_password', message },
          { status: 400 }
        )
      }

      return jsonResponse(
        { error: 'registration_failed', message },
        { status: 400 }
      )
    }

    // ========================================
    // 4. Успешная регистрация
    // ========================================
    console.log(`User registered successfully: ${email} (${authData.user.id})`)

    return jsonResponse(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        message: 'Registration successful. Demo subscription activated.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred during registration',
      },
      { status: 500 }
    )
  }
})