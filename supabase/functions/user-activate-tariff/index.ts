import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY")
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  })

type Body = { tariffId?: number | string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, { status: 405 })

  try {
    const authHeader = req.headers.get("Authorization") || ""
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "unauthorized" }, { status: 401 })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes?.user) return json({ success: false, error: "unauthorized" }, { status: 401 })

    const body: Body = await req.json().catch(() => ({} as Body))
    const tariffId = Number(body?.tariffId)
    if (!Number.isFinite(tariffId) || tariffId <= 0) {
      return json({ success: false, error: "invalid_tariff_id" }, { status: 400 })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const userId = userRes.user.id

    const { error: deactivateError } = await adminClient
      .from("user_subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true)

    if (deactivateError) {
      return json({ success: false, error: deactivateError.message || "deactivate_failed" }, { status: 200 })
    }

    const { data: tariff, error: tariffError } = await adminClient
      .from("tariffs")
      .select("duration_days,is_lifetime,is_active")
      .eq("id", tariffId)
      .single()

    if (tariffError || !tariff) {
      return json({ success: false, error: "tariff_not_found" }, { status: 200 })
    }

    if (tariff.is_active === false) {
      return json({ success: false, error: "tariff_inactive" }, { status: 200 })
    }

    const startDate = new Date()
    let endDate: Date | null = null
    if (!tariff.is_lifetime && typeof tariff.duration_days === "number" && tariff.duration_days > 0) {
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + tariff.duration_days)
    }

    const { data: subscription, error: insertError } = await adminClient
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        tariff_id: tariffId,
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        is_active: true,
      })
      .select("id,user_id,tariff_id,start_date,end_date,is_active")
      .single()

    if (insertError || !subscription) {
      return json({ success: false, error: insertError?.message || "insert_failed" }, { status: 200 })
    }

    return json({ success: true, subscription })
  } catch (e) {
    return json({ success: false, error: (e as Error)?.message || "failed" }, { status: 500 })
  }
})
