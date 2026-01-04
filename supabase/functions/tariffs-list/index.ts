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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

type RequestBody = {
  includeInactive?: boolean
  includeDemo?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    
    const supabaseClient = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      authHeader ? {
        global: {
          headers: { Authorization: authHeader },
        },
      } : {}
    )

    // Парсинг body с обработкой ошибок
    let body: RequestBody = {}
    try {
      body = await req.json()
    } catch {
      // Если body пустой или невалидный, используем дефолтные значения
    }

    const includeInactive = !!body.includeInactive
    const includeDemo = !!body.includeDemo

    console.log('Fetching tariffs', { includeInactive, includeDemo })

    // Получение тарифов
    let query = supabaseClient
      .from('tariffs')
      .select('id, name, description, old_price, new_price, currency_id, duration_days, is_free, is_lifetime, is_active, created_at, updated_at, sort_order, visible, popular')
      .order('sort_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: tariffs, error: tariffsError } = await query

    if (tariffsError) {
      console.log('Tariffs fetch error', { error: tariffsError.message })
      return jsonResponse(
        { error: 'Failed to fetch tariffs' },
        { status: 500 }
      )
    }

    // Фильтрация демо-тарифов
    const filteredTariffs = !tariffs || tariffs.length === 0
      ? []
      : includeDemo
        ? tariffs
        : tariffs.filter((t: any) => {
            const name = String(t.name || '').toLowerCase()
            return !(name.includes('демо') || name.includes('demo'))
          })

    if (filteredTariffs.length === 0) {
      return jsonResponse({ tariffs: [] })
    }

    const tariffIds = filteredTariffs.map((t: any) => t.id)
    const currencyIds = Array.from(
      new Set(
        filteredTariffs
          .map((t: any) => t.currency_id)
          .filter((id) => id !== null && id !== undefined)
      )
    )

    // Параллельное получение связанных данных
    const [
      { data: currencies },
      { data: features },
      { data: limits }
    ] = await Promise.all([
      currencyIds.length > 0
        ? supabaseClient
            .from('currencies')
            .select('*')
            .in('id', currencyIds)
        : Promise.resolve({ data: [] }),
      supabaseClient
        .from('tariff_features')
        .select('*')
        .in('tariff_id', tariffIds)
        .eq('is_active', true)
        .order('feature_name'),
      supabaseClient
        .from('tariff_limits')
        .select('*')
        .in('tariff_id', tariffIds)
        .eq('is_active', true)
        .order('limit_name')
    ])

    // Построение map'ов для быстрого доступа
    const currenciesMap: Record<string, any> = {}
    for (const currency of currencies || []) {
      currenciesMap[String(currency.id)] = currency
    }

    const featuresMap: Record<string, any[]> = {}
    for (const feature of features || []) {
      const tariffId = String((feature as any).tariff_id)
      if (!featuresMap[tariffId]) {
        featuresMap[tariffId] = []
      }
      featuresMap[tariffId].push(feature)
    }

    const limitsMap: Record<string, any[]> = {}
    for (const limit of limits || []) {
      const tariffId = String((limit as any).tariff_id)
      if (!limitsMap[tariffId]) {
        limitsMap[tariffId] = []
      }
      limitsMap[tariffId].push(limit)
    }

    // Агрегация данных
    const aggregated = filteredTariffs.map((tariff: any) => {
      const currencyData = tariff.currency_id 
        ? currenciesMap[String(tariff.currency_id)] 
        : null

      return {
        id: tariff.id,
        name: tariff.name,
        description: tariff.description,
        old_price: tariff.old_price,
        new_price: tariff.new_price,
        currency_id: tariff.currency_id,
        currency_code: currencyData?.code,
        duration_days: tariff.duration_days,
        is_free: tariff.is_free,
        is_lifetime: tariff.is_lifetime,
        is_active: tariff.is_active,
        created_at: tariff.created_at,
        updated_at: tariff.updated_at,
        sort_order: tariff.sort_order,
        visible: tariff.visible ?? true,
        popular: tariff.popular ?? false,
        currency_data: currencyData,
        features: featuresMap[String(tariff.id)] || [],
        limits: limitsMap[String(tariff.id)] || []
      }
    })

    console.log('Tariffs fetched successfully', { count: aggregated.length })

    return jsonResponse({ tariffs: aggregated })

  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})