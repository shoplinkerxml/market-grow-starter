import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Body = { limit?: number | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const rawBody = await req.json().catch(() => ({}))
    const body: Body & { marketplace?: string | null } = rawBody as any
    const limit = (typeof body.limit === 'number' && body.limit > 0) ? body.limit : null
    const marketplace = typeof body.marketplace === 'string' ? body.marketplace.trim() : null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: authHeader ? { Authorization: `Bearer ${token}` } : {} } }
    )

    if (marketplace) {
      const mk = marketplace.trim()
      const mkLower = mk.toLowerCase()
      // Try exact match
      let { data: template, error } = await (supabase as any)
        .from('store_templates')
        .select('id, xml_structure, mapping_rules, marketplace')
        .eq('marketplace', mk)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!template && !error) {
        // Try lower-case exact match
        const res2 = await (supabase as any)
          .from('store_templates')
          .select('id, xml_structure, mapping_rules, marketplace')
          .eq('marketplace', mkLower)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        template = res2?.data || null
        error = res2?.error || null
      }
      if (!template && !error) {
        // Fallback: ilike contains
        const res3 = await (supabase as any)
          .from('store_templates')
          .select('id, xml_structure, mapping_rules, marketplace')
          .ilike('marketplace', `%${mkLower}%`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        template = res3?.data || null
        error = res3?.error || null
      }
      if (error) return new Response(JSON.stringify({ error: 'template_fetch_failed' }), { status: 500, headers: corsHeaders })
      return new Response(JSON.stringify({ template: template || null }), { status: 200, headers: corsHeaders })
    }

    const { data: rows, error } = await (supabase as any)
      .from('store_templates')
      .select('id, marketplace, xml_structure, mapping_rules, created_at, is_active')
      .eq('is_active', true)
      .order('marketplace', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) return new Response(JSON.stringify({ error: 'fetch_failed' }), { status: 500, headers: corsHeaders })

    const templatesByMarketplace: Record<string, { id: string; xml_structure: unknown; mapping_rules: unknown }> = {}
    const marketplacesSet = new Set<string>()
    for (const r of (rows || [])) {
      const m = (r as any)?.marketplace
      if (!m) continue
      const mStr = String(m).trim()
      const key = mStr.toLowerCase()
      marketplacesSet.add(mStr)
      if (!templatesByMarketplace[key]) {
        templatesByMarketplace[key] = {
          id: String((r as any)?.id),
          xml_structure: (r as any)?.xml_structure ?? null,
          mapping_rules: (r as any)?.mapping_rules ?? null,
        }
      }
    }
    const items = Array.from(marketplacesSet)

    return new Response(JSON.stringify({ marketplaces: items, templatesByMarketplace }), { status: 200, headers: corsHeaders })
  } catch (e) {
    const msg = (e as any)?.message || 'marketplaces_failed'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
