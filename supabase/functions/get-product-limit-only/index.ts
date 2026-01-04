import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, serviceKey)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Получаем user_id
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // ШАГ 1: Проверяем подписки
    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)

    // ШАГ 2: Проверяем активную подписку
    const activeSubs = subs?.filter(s => s.is_active) || []
    
    // ШАГ 3: Проверяем неистёкшие подписки
    const validSubs = activeSubs.filter(s => new Date(s.end_date) > new Date())

    let limitsData = []
    if (validSubs.length > 0) {
      const tariffId = validSubs[0].tariff_id
      
      // ШАГ 4: Получаем ВСЕ лимиты
      const { data: limits } = await supabase
        .from("tariff_limits")
        .select("*")
        .eq("tariff_id", tariffId)
      
      limitsData = limits || []
    }

    // Возвращаем ВСЁ для анализа
    return new Response(JSON.stringify({
      userId: user.id,
      userEmail: user.email,
      allSubscriptions: subs || [],
      activeSubscriptions: activeSubs,
      validSubscriptions: validSubs,
      limits: limitsData,
      // Ищем "товар"
      productLimit: limitsData.find(l => 
        l.limit_name?.toLowerCase().includes("товар")
      ),
      value: limitsData.find(l => 
        l.limit_name?.toLowerCase().includes("товар")
      )?.value || 0
    }, null, 2), {
      headers: corsHeaders
    })

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
})