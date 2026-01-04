import { createClient } from "@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

type MenuItemPayload = {
  title?: string
  path?: string
  parent_id?: number | null
  order_index?: number
  is_active?: boolean
  page_type?: string
  content_data?: Record<string, unknown>
  template_name?: string | null
  meta_data?: Record<string, unknown> | null
  icon_name?: string | null
  description?: string | null
}

type ReorderItem = { id: number; order_index: number; parent_id?: number | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", apiKey)
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
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const action = String((body as any)?.action || "list")

    if (action === "list") {
      const activeOnly = !!(body as any)?.active_only
      let q = supabase.from("user_menu_items").select("*").eq("user_id", userId)
      if (activeOnly) q = q.eq("is_active", true)
      const { data, error } = await q.order("order_index", { ascending: true })
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ items: data || [] }), { headers: corsHeaders })
    }

    if (action === "get") {
      const id = Number((body as any)?.id)
      const { data, error } = await supabase
        .from("user_menu_items")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle()
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ item: data || null }), { headers: corsHeaders })
    }

    if (action === "get_by_path") {
      const path = String((body as any)?.path || "")
      const normalized = path.startsWith("/") ? path.slice(1) : path
      const { data, error } = await supabase
        .from("user_menu_items")
        .select("*")
        .eq("path", normalized)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle()
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ item: data || null }), { headers: corsHeaders })
    }

    if (action === "get_children") {
      const parentId = (body as any)?.parent_id ?? null
      const { data, error } = await supabase
        .from("user_menu_items")
        .select("*")
        .eq("parent_id", parentId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("order_index")
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ items: data || [] }), { headers: corsHeaders })
    }

    if (action === "create") {
      const payload = (body as any)?.data as MenuItemPayload
      const { data: exists } = await supabase
        .from("user_menu_items")
        .select("id")
        .eq("user_id", userId)
        .eq("path", String(payload?.path || ""))
        .maybeSingle()
      if (exists) {
        return new Response(JSON.stringify({ error: "path_exists" }), { status: 409, headers: corsHeaders })
      }
      const insertData = {
        user_id: userId,
        title: String(payload?.title || ""),
        path: String(payload?.path || ""),
        parent_id: (payload?.parent_id ?? null) as number | null,
        order_index: Number(payload?.order_index ?? 0),
        is_active: payload?.is_active ?? true,
        page_type: (payload?.page_type ?? "content") as string,
        content_data: payload?.content_data ?? {},
        template_name: payload?.template_name ?? null,
        meta_data: payload?.meta_data ?? null,
        icon_name: payload?.icon_name ?? null,
        description: payload?.description ?? null,
      }
      const { data, error } = await supabase.from("user_menu_items").insert(insertData).select("*").maybeSingle()
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ item: data }), { status: 201, headers: corsHeaders })
    }

    if (action === "update") {
      const id = Number((body as any)?.id)
      const patch = ((body as any)?.data || {}) as MenuItemPayload
      if (patch.path) {
        const { data: exists } = await supabase
          .from("user_menu_items")
          .select("id")
          .eq("user_id", userId)
          .eq("path", String(patch.path))
          .neq("id", id)
          .maybeSingle()
        if (exists) {
          return new Response(JSON.stringify({ error: "path_exists" }), { status: 409, headers: corsHeaders })
        }
      }
      const { data, error } = await supabase
        .from("user_menu_items")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle()
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ item: data }), { headers: corsHeaders })
    }

    if (action === "delete") {
      const id = Number((body as any)?.id)
      const { error } = await supabase.from("user_menu_items").delete().eq("id", id).eq("user_id", userId)
      if (error) {
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (action === "reorder") {
      const items = ((body as any)?.items || []) as ReorderItem[]
      for (const it of items) {
        const patch: Record<string, unknown> = { order_index: Number(it.order_index) }
        if (it.parent_id !== undefined) patch.parent_id = it.parent_id ?? null
        const { error } = await supabase
          .from("user_menu_items")
          .update(patch)
          .eq("id", Number(it.id))
          .eq("user_id", userId)
        if (error) {
          return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: corsHeaders })
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "failed" }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
