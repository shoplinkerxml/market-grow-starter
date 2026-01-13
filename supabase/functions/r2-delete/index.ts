// @ts-nocheck
// Этот файл выполняется в среде Deno (Supabase Edge Functions).
// Импорты вида "https://deno.land/..." и "npm:..." валидны в Deno,
// но редактор Node/TypeScript может ругаться на их типы.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type DeleteBody = {
  objectKey: string;
  authorization?: string;
  token?: string;
};

const base64UrlToBase64 = (input: string) => input.replace(/-/g, "+").replace(/_/g, "/");

const decodeJwtSub = (authHeader: string | null) => {
  try {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(base64UrlToBase64(parts[1])), (c) => c.charCodeAt(0)),
      ),
    );
    const v = payload?.sub || payload?.user_id;
    return v != null ? String(v) : null;
  } catch {
    return null;
  }
};

async function reorderImages(supabase: any, productId: string) {
  const { data } = await supabase
    .from("store_product_images")
    .select("id,is_main,order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });

  const rows: Array<{ id: number; is_main?: boolean; order_index?: number }> = Array.isArray(data) ? data : [];
  if (rows.length === 0) return;

  let assigned = false;
  const normalized = rows.map((r, idx) => {
    const isMain = !assigned && r.is_main === true;
    if (isMain) assigned = true;
    return { id: Number(r.id), order_index: idx, is_main: isMain };
  });

  if (!normalized.some((r) => r.is_main) && normalized.length > 0) {
    normalized[0] = { ...normalized[0], is_main: true };
  }

  await Promise.all(
    normalized.map((r) =>
      supabase
        .from("store_product_images")
        .update({ order_index: r.order_index, is_main: r.is_main })
        .eq("id", r.id),
    ),
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Support both JSON and text/plain bodies (for keepalive/sendBeacon)
    const contentType = req.headers.get('content-type') || '';
    let body: DeleteBody | null = null;
    if (contentType.includes('application/json')) {
      try {
        body = await req.json() as DeleteBody;
      } catch (_) {
        body = null;
      }
    } else {
      let text = '';
      try {
        text = await req.text();
      } catch (_) {
        text = '';
      }
      if (text) {
        try {
          body = JSON.parse(text) as DeleteBody;
        } catch (_) {
          const params = new URLSearchParams(text);
          const objectKeyParam = params.get('objectKey') || undefined;
          const authParam = params.get('authorization') || params.get('token') || undefined;
          if (objectKeyParam) {
            body = { objectKey: objectKeyParam, authorization: authParam };
          }
        }
      }
    }

    // Fallback: attempt to parse as JSON if not yet parsed
    const objectKey = body?.objectKey;
    const auth = req.headers.get('authorization') || body?.authorization || body?.token || null;
    if (!auth) {
      // Allow unauthenticated deletion only for temporary uploads
      // Support both path styles: with or without leading slash
      const isTmp = objectKey && (objectKey.includes('uploads/tmp/') || objectKey.includes('/uploads/tmp/'));
      if (!objectKey || !isTmp) {
        return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    if (!objectKey) {
      return new Response(JSON.stringify({ error: 'invalid_body', message: 'Missing objectKey' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';
    const bucket = Deno.env.get('R2_BUCKET_NAME') ?? '';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      return new Response(JSON.stringify({ error: 'server_misconfig', message: 'Missing R2 environment configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const m = objectKey.match(/^products\/([^\/]+)\/([^\/]+)\/(.+)$/);
    const productIdFromKey = m?.[1] ? String(m[1]) : null;
    const imageIdFromKey = m?.[2] ? String(m[2]) : null;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const canTouchDb = !!(SUPABASE_URL && SERVICE_KEY && productIdFromKey && imageIdFromKey && auth);

    let supabase: any = null;
    let userId: string | null = null;

    if (canTouchDb) {
      supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      userId = decodeJwtSub(auth);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: productRow } = await supabase
        .from("store_products")
        .select("id,store_id,user_stores!inner(id,user_id,is_active)")
        .eq("id", productIdFromKey)
        .maybeSingle();

      const userStoreRaw: any = (productRow as any)?.user_stores;
      const userStore = Array.isArray(userStoreRaw) ? (userStoreRaw[0] || null) : userStoreRaw;

      if (!productRow || !userStore || String(userStore.user_id) !== String(userId) || userStore.is_active === false) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (m) {
      const prefix = `products/${m[1]}/${m[2]}/`;
      try {
        const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
        const keys = (listed.Contents || []).map((o) => o.Key).filter((k): k is string => !!k);
        if (keys.length > 0) {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((k) => ({ Key: k })) } }));
          if (supabase && productIdFromKey && imageIdFromKey) {
            const imgId = Number(imageIdFromKey);
            if (Number.isFinite(imgId)) {
              await supabase.from("store_product_images").delete().eq("id", imgId).eq("product_id", productIdFromKey);
              await reorderImages(supabase, productIdFromKey);
            }
          }
          return new Response(JSON.stringify({ success: true, deleted: keys.length, prefix }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (_) {
        // fall through to single object delete
      }
    }
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (supabase && productIdFromKey && imageIdFromKey) {
      const imgId = Number(imageIdFromKey);
      if (Number.isFinite(imgId)) {
        await supabase.from("store_product_images").delete().eq("id", imgId).eq("product_id", productIdFromKey);
        await reorderImages(supabase, productIdFromKey);
      }
    }

    return new Response(JSON.stringify({ success: true, deleted: 1 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'delete_failed', message: (e as any)?.message ?? 'Failed to delete object' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
