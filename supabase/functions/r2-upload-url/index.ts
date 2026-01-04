import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const auth = req.headers.get("authorization")
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } })
    
    let body: { productId?: string; url?: string } | null = null
    try {
      body = await req.json()
      console.log("Parsed body:", JSON.stringify(body))
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr)
      return new Response(JSON.stringify({ error: "json_parse_error", message: String(parseErr) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
    }
    
    if (!body || !body.productId) {
      console.error("Missing productId in body:", body)
      return new Response(JSON.stringify({ error: "invalid_body", received: body }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
    }

    const workerBase = Deno.env.get("IMAGE_WORKER_URL") || "https://img-api.xmlreactor.shop"

    // If a source URL is provided, delegate to existing upload-from-URL flow
    if (body.url && body.url.length > 0) {
      const token = Deno.env.get("WORKER_SHARED_SECRET") || Deno.env.get("WORKER_TOKEN") || ""
      const res = await fetch(`${workerBase}/upload`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "X-Worker-Token": token } : {}) }, body: JSON.stringify({ productId: body.productId, url: body.url }) })
      const txt = await res.text()
      const headers = { ...cors, "Content-Type": "application/json" }
      if (!res.ok) return new Response(JSON.stringify({ error: "worker_failed", message: txt }), { status: res.status || 500, headers })
      return new Response(txt, { status: 200, headers })
    }

    const token = Deno.env.get("WORKER_SHARED_SECRET") || ""
    if (!token) return new Response(JSON.stringify({ error: "server_misconfig" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })

    // Create image row first to obtain image_id
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ehznqzaumsnjkrntaiox.supabase.co"
    const bearer = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    console.log("Calling create-image-row for productId:", body.productId)
    const insRes = await fetch(`${supabaseUrl}/functions/v1/create-image-row`, { method: "POST", headers: { "content-type": "application/json", "X-Worker-Token": token, ...(bearer ? { Authorization: `Bearer ${bearer}`, apikey: bearer } : {}) }, body: JSON.stringify({ product_id: body.productId, url: "#pending" }) })
    if (!insRes.ok) {
      const txt = await insRes.text().catch(() => "")
      return new Response(JSON.stringify({ error: "insert_failed", message: txt }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
    }
    const insJson = await insRes.json() as { image_id?: number }
    const imageId = String(insJson?.image_id ?? "")
    if (!imageId) return new Response(JSON.stringify({ error: "image_id_missing" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })

    const originalKey = `products/${body.productId}/${imageId}/original.webp`
    const cardKey = `products/${body.productId}/${imageId}/card.webp`
    const thumbKey = `products/${body.productId}/${imageId}/thumb.webp`

    const upRes = await fetch(`${workerBase}/r2/upload-url`, { method: "POST", headers: { "content-type": "application/json", "X-Worker-Token": token }, body: JSON.stringify({ key: originalKey, expiresIn: 900 }) })
    const upTxt = await upRes.text()
    const headers = { ...cors, "Content-Type": "application/json" }
    if (!upRes.ok) return new Response(JSON.stringify({ error: "worker_failed", message: upTxt }), { status: upRes.status || 500, headers })
    const payload = JSON.parse(upTxt)
    return new Response(JSON.stringify({ imageId, originalKey, cardKey, thumbKey, ...payload }), { status: 200, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error"
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
  }
})
