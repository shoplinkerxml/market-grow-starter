import { createClient } from "npm:@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
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
    const code = String((body as any)?.code || "")
    if (!store_id || !code) return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: corsHeaders })
    const { data: store } = await supabase.from("user_stores").select("id,user_id").eq("id", store_id).maybeSingle()
    if (!store || String((store as any).user_id) !== userId) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })
    const { data: row } = await supabase
      .from("store_currencies")
      .select("is_base")
      .eq("store_id", store_id)
      .eq("code", code)
      .maybeSingle()
    if (row && (row as any).is_base) {
      return new Response(JSON.stringify({ error: "cannot_delete_base_currency" }), { status: 422, headers: corsHeaders })
    }
    const { error } = await supabase.from("store_currencies").delete().eq("store_id", store_id).eq("code", code)
    if (error) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: corsHeaders })
  }
})
