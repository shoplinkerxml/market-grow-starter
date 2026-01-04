import { createClient } from "npm:@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", apiKey)
    const { data, error } = await supabase.from("currencies").select("code,rate")
    if (error) return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify({ rows: data || [] }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), { status: 500, headers: corsHeaders })
  }
})

