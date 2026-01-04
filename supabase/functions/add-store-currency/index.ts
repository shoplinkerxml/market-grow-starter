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
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = (createClient as any)(
      Deno.env.get("SUPABASE_URL") || "",
      apiKey,
      {
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
      },
    )

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
    const store_id = String((body as any)?.store_id || "").trim()
    const code = String((body as any)?.code || "").trim()
    const rate = Number((body as any)?.rate ?? NaN)
    if (!store_id || !code || !Number.isFinite(rate)) return new Response(JSON.stringify({ error: "validation_failed" }), { status: 422, headers: corsHeaders })

    const { data: store } = await supabase.from("user_stores").select("id,user_id").eq("id", store_id).maybeSingle()
    if (!store || String((store as any).user_id) !== userId) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders })

    const { data: existing, error: selErr } = await supabase
      .from("store_currencies")
      .select("id, rate")
      .eq("store_id", store_id)
      .eq("code", code)
      .maybeSingle()
    if (selErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })

    if (existing) {
      const currentRate = Number((existing as any)?.rate ?? NaN)
      if (!Number.isFinite(currentRate) || currentRate !== rate) {
        const { error: upErr } = await supabase
          .from("store_currencies")
          .update({ rate })
          .eq("id", (existing as any).id)
        if (upErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
    } else {
      const { error: insErr } = await supabase
        .from("store_currencies")
        .insert({ store_id, code, rate, is_base: false })
      if (insErr) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: corsHeaders })
  }
})
