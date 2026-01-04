import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { S3Client, CopyObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ImageInput = { key?: string; url?: string; order_index?: number; is_main?: boolean };
type ParamInput = { name: string; value: string; order_index?: number; paramid?: string | null; valueid?: string | null };
type LinkInput = { store_id: string; is_active?: boolean; custom_price?: number | null; custom_price_promo?: number | null; custom_stock_quantity?: number | null; custom_available?: boolean | null; custom_name?: string | null; custom_description?: string | null; custom_category_id?: string | null };
type Body = {
  store_id?: string;
  supplier_id?: number | string | null;
  category_id?: number | string | null;
  category_external_id?: string | null;
  currency_code?: string | null;
  external_id?: string | null;
  name: string;
  name_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  available?: boolean;
  stock_quantity?: number;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  description?: string | null;
  description_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  state?: string | null;
  images?: ImageInput[];
  params?: ParamInput[];
  links?: LinkInput[];
};

const base64UrlToBase64 = (input: string) => input.replace(/-/g, "+").replace(/_/g, "/");
const decodeJwtSub = (authHeader: string | null) => {
  try {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64UrlToBase64(parts[1])), c => c.charCodeAt(0))));
    return String(payload?.sub || payload?.user_id || "");
  } catch (_) {
    return null;
  }
};

function extractObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.host || "";
    const pathname = (u.pathname || "/").replace(/^\/+/, "");
    const parts = pathname.split("/").filter(Boolean);
    if (host.includes("cloudflarestorage.com")) {
      const hostParts = host.split(".");
      const isPathStyle = hostParts.length === 4;
      if (isPathStyle) {
        if (parts.length >= 2) return parts.slice(1).join("/");
        return parts[0] || null;
      }
      return pathname || null;
    }
    if (host.includes("r2.dev")) {
      if (parts.length >= 2) return parts.slice(1).join("/");
      return parts[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = decodeJwtSub(auth);
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = (await req.json()) as Body;
    const storeId = String(body?.store_id || "").trim();
    if (!storeId) {
      return new Response(JSON.stringify({ error: "invalid_body", message: "store_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const currencyCode = String(body?.currency_code || "").trim();
    if (!currencyCode) {
      return new Response(JSON.stringify({ error: "validation_error", message: "currency_code required" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
    function resolvePublicBase(): string {
      const host = Deno.env.get("R2_PUBLIC_HOST") || "";
      if (host) {
        const h = host.startsWith("http") ? host : `https://${host}`;
        try {
          const u = new URL(h);
          return `${u.protocol}//${u.host}`;
        } catch {
          return h;
        }
      }
      const raw = Deno.env.get("R2_PUBLIC_BASE_URL") || Deno.env.get("IMAGE_BASE_URL") || "https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev";
      try {
        const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        const origin = `${u.protocol}//${u.host}`;
        const path = (u.pathname || "/").replace(/^\/+/, "").replace(/\/+$/, "");
        return path ? `${origin}/${path}` : origin;
      } catch {
        return raw;
      }
    }
    const IMAGE_BASE_URL = resolvePublicBase();
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "server_misconfig" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: storeRow } = await supabase
      .from("user_stores")
      .select("id,user_id,is_active")
      .eq("id", storeId)
      .maybeSingle();
    if (!storeRow || String(storeRow.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const isActive = (storeRow as { is_active?: boolean }).is_active;
    if (isActive === false) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: subsRows } = await supabase
      .from("user_subscriptions")
      .select("id,tariff_id,end_date,is_active,start_date")
      .eq("user_id", String(userId))
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1);
    let activeSub = (subsRows || [])[0] || null;
    if (activeSub && activeSub.end_date) {
      const endMs = new Date(activeSub.end_date).getTime();
      if (endMs < Date.now()) {
        await supabase.from("user_subscriptions").update({ is_active: false }).eq("id", activeSub.id);
        activeSub = null;
      }
    }
    if (!activeSub) {
      return new Response(JSON.stringify({ error: "limit_reached" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tariffId = Number(activeSub.tariff_id);
    const { data: limitRow } = await supabase
      .from("tariff_limits")
      .select("value")
      .eq("tariff_id", tariffId)
      .ilike("limit_name", "%товар%")
      .eq("is_active", true)
      .maybeSingle();
    const maxProducts = Number(limitRow?.value ?? 0);
    if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
      return new Response(JSON.stringify({ error: "limit_reached" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: userStores } = await supabase
      .from("user_stores")
      .select("id")
      .eq("user_id", String(userId))
      .eq("is_active", true);
    const storeIds = (userStores || []).map((s) => String((s as { id: string }).id));
    let currentCount = 0;
    if (storeIds.length > 0) {
      const { count } = await supabase
        .from("store_products")
        .select("id", { count: "exact", head: true })
        .in("store_id", storeIds);
      currentCount = Number(count || 0);
    }
    if (currentCount >= maxProducts) {
      return new Response(JSON.stringify({ error: "limit_reached" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const insertBase: Record<string, unknown> = {
      store_id: storeId,
      supplier_id: body.supplier_id != null ? Number(body.supplier_id) : null,
      external_id: body.external_id ?? null,
      name: body.name,
      name_ua: body.name_ua ?? null,
      docket: body.docket ?? null,
      docket_ua: body.docket_ua ?? null,
      description: body.description ?? null,
      description_ua: body.description_ua ?? null,
      vendor: body.vendor ?? null,
      article: body.article ?? null,
      category_id: body.category_id != null ? Number(body.category_id) : null,
      category_external_id: body.category_external_id ?? null,
      currency_code: currencyCode,
      price: body.price ?? null,
      price_old: body.price_old ?? null,
      price_promo: body.price_promo ?? null,
      stock_quantity: body.stock_quantity ?? 0,
      available: body.available ?? true,
      state: body.state ?? "new",
    };

    const { data: created, error: createErr } = await supabase
      .from("store_products")
      .insert([insertBase])
      .select("*")
      .single();
    if (!created || createErr) {
      return new Response(JSON.stringify({ error: "create_failed", message: createErr?.message || "Create failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const s3 = accountId && bucket && accessKeyId && secretAccessKey
      ? new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } })
      : null;

    try {
      const images = Array.isArray(body.images) ? body.images : [];
      if (images.length) {
        const hasMain = images.some((i) => i.is_main === true);
        let assigned = false;
        for (let index = 0; index < images.length; index++) {
          const img = images[index];
          let m = img.is_main === true && !assigned;
          if (hasMain) {
            if (img.is_main === true && !assigned) assigned = true; else m = false;
          } else {
            m = index === 0;
          }
          let insertedId: number | null = null;
          const { data: insertedRow } = await supabase
            .from("store_product_images")
            .insert({
              product_id: String(created.id),
              url: "#processing",
              order_index: typeof img.order_index === "number" ? img.order_index : index,
              is_main: m,
            })
            .select("id")
            .single();
          insertedId = (insertedRow as any)?.id ?? null;
          const srcKey = s3 ? ((img.key && String(img.key)) || (typeof img.url === "string" ? extractObjectKeyFromUrl(img.url) : null)) : null;
          if (s3 && insertedId && srcKey) {
            const originalKey = `products/${String(created.id)}/${String(insertedId)}/original.webp`;
            try {
              await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: originalKey, CopySource: `${bucket}/${srcKey}` }));
              const finalUrl = IMAGE_BASE_URL ? `${IMAGE_BASE_URL}/${originalKey}` : `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${originalKey}`;
              await supabase
                .from("store_product_images")
                .update({ url: finalUrl, r2_key_original: originalKey })
                .eq("id", insertedId);
            } catch {
              await supabase
                .from("store_product_images")
                .update({ url: String(img.url || "") })
                .eq("id", insertedId);
            }
          } else if (insertedId) {
            await supabase
              .from("store_product_images")
              .update({ url: String(img.url || "") })
              .eq("id", insertedId);
          }
        }
      }

      const params = Array.isArray(body.params) ? body.params : [];
      if (params.length) {
        const mapped = params.map((p, index) => ({ product_id: String(created.id), name: p.name, value: p.value, order_index: typeof p.order_index === "number" ? p.order_index : index, paramid: p.paramid ?? null, valueid: p.valueid ?? null }));
        await supabase.from("store_product_params").insert(mapped);
      }

      const links = Array.isArray(body.links) ? body.links : [];
      if (links.length) {
        const mapped = links.map((l) => ({ product_id: String(created.id), store_id: String(l.store_id), is_active: l.is_active ?? true, custom_price: l.custom_price ?? null, custom_price_promo: l.custom_price_promo ?? null, custom_stock_quantity: l.custom_stock_quantity ?? null, custom_available: l.custom_available ?? null, custom_name: l.custom_name ?? null, custom_description: l.custom_description ?? null, custom_category_id: l.custom_category_id ?? null }));
        await supabase.from("store_product_links").insert(mapped);
      }
    } catch (subErr) {
      try {
        await supabase.from("store_products").delete().eq("id", String(created.id));
      } catch { /* noop */ }
      return new Response(JSON.stringify({ error: "create_failed", message: (subErr as { message?: string })?.message || "Create sub-ops failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ product_id: String(created.id) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as unknown as { message?: string })?.message ?? "Create failed";
    return new Response(JSON.stringify({ error: "create_failed", message: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
