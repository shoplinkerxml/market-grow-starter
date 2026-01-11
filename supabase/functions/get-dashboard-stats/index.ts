
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REDIS_REST_URL =
  Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('REDIS_REST_URL') || ''
const REDIS_REST_TOKEN =
  Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('REDIS_REST_TOKEN') || ''
const DASHBOARD_STATS_TTL = 60 // 1 minute cache in Redis

async function redisPipeline(commands: any[]): Promise<any[] | null> {
  if (!REDIS_REST_URL || !REDIS_REST_TOKEN) return null
  try {
    const base = REDIS_REST_URL.replace(/\/+$/, '')
    const res = await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // 0) Try Redis cache first
    if (REDIS_REST_URL && REDIS_REST_TOKEN) {
      try {
        const base = REDIS_REST_URL.replace(/\/+$/, "");
        const cacheKey = `dashboard:stats:${userId}`;
        const cachedRes = await fetch(`${base}/get/${encodeURIComponent(cacheKey)}`, {
          headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}` },
        });
        if (cachedRes.ok) {
          const cachedJson = await cachedRes.json();
          // Upstash returns { result: string | null }
          const raw = cachedJson?.result;
          if (typeof raw === "string" && raw.length > 0) {
            return new Response(raw, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    // 1) Base entities
    const [{ data: suppliers, error: suppliersError }, { data: shops, error: shopsError }] = await Promise.all([
      supabaseClient.from("user_suppliers").select("id, supplier_name").eq("user_id", userId),
      supabaseClient
        .from("user_stores")
        .select("id, store_name, is_active")
        .eq("user_id", userId)
        .or("is_active.is.null,is_active.eq.true"),
    ]);

    if (suppliersError) console.error("Suppliers fetch error:", suppliersError);
    if (shopsError) console.error("Shops fetch error:", shopsError);

    const supplierIds = (suppliers || []).map((s: any) => String(s.id));
    const storeIds = (shops || []).map((s: any) => String(s.id));

    // 2) Read counters (single round-trip)
    const entityIds = Array.from(new Set([String(userId), ...supplierIds, ...storeIds]));
    const { data: countersRows, error: countersError } = await supabaseClient
      .from("counters")
      .select("counter_type, entity_id, count")
      .in("entity_id", entityIds);

    if (countersError) console.error("Counters fetch error:", countersError);

    const countersMap = new Map<string, number>();
    for (const r of countersRows || []) {
      const key = `${String((r as any).counter_type)}:${String((r as any).entity_id)}`;
      countersMap.set(key, Math.max(0, Number((r as any).count) || 0));
    }

    const totalProducts = countersMap.get(`products:${userId}`) ?? 0;
    const totalCategories = countersMap.get(`categories:${userId}`) ?? 0;

    const transformedSuppliers = (suppliers || []).map((s: any) => ({
      id: s.id,
      supplier_name: s.supplier_name,
      // per-supplier product counter stored as: products:<supplier_id>
      productCount: countersMap.get(`products:${s.id}`) ?? 0,
    }));

    const transformedShops = (shops || []).map((s: any) => ({
      id: s.id,
      store_name: s.store_name,
      // per-store product counter stored as: products:<store_uuid>
      productsCount: countersMap.get(`products:${s.id}`) ?? 0,
    }));

    const responseData = {
      suppliers: transformedSuppliers,
      stores: transformedShops,
      totalProducts,
      totalCategories,
    };

    // Cache in Redis
    if (REDIS_REST_URL && REDIS_REST_TOKEN) {
      const cacheKey = `dashboard:stats:${userId}`;
      redisPipeline([["SET", cacheKey, JSON.stringify(responseData), "EX", DASHBOARD_STATS_TTL]]).catch((err) =>
        console.error("Redis cache error:", err),
      );
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
