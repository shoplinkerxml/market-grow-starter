import { createClient } from "npm:@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", apiKey, { global: { headers: authHeader ? { Authorization: authHeader } : {} } })
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })
    const body = await req.json().catch(() => ({}))
    const store_id = String((body as any)?.store_id || "")
    const code = String((body as any)?.code || "")
    const rate = Number((body as any)?.rate ?? NaN)
    if (!store_id || !code || !Number.isFinite(rate)) return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: corsHeaders })
    const { error } = await supabase.from("store_currencies").update({ rate }).eq("store_id", store_id).eq("code", code)
    if (error) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: corsHeaders })
  }
})

