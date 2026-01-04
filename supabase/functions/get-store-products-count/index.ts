import { createClient } from "@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = (createClient as any)(SUPABASE_URL, SERVICE_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    })
    function decodeJwtSub(h: string): string | null {
      try {
        const t = h.replace(/^Bearer\s+/i, "").trim()
        const p = t.split(".")
        if (p.length < 2) return null
        const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))))
        return String(payload?.sub || payload?.user_id || "")
      } catch { return null }
    }
    const userId = decodeJwtSub(authHeader)
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })
    const body = await req.json().catch(() => ({}))
    const store_id = String((body as any)?.store_id || "")
    if (!store_id) return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: corsHeaders })
    const { data: store } = await supabase.from("user_stores").select("id,user_id").eq("id", store_id).maybeSingle()
    if (!store || String((store as any).user_id) !== userId) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    const { count, error } = await supabase.from("store_products").select("*", { count: "exact", head: true }).eq("store_id", store_id)
    if (error) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify({ count: count || 0 }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: corsHeaders })
  }
})
