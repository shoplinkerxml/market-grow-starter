// @ts-nocheck
// Этот файл выполняется в среде Deno (Supabase Edge Functions).
// Импорты вида "https://deno.land/..." и "npm:..." валидны в Deno,
// но редактор Node/TypeScript может ругаться на их типы.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3";

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
    if (m) {
      const prefix = `products/${m[1]}/${m[2]}/`;
      try {
        const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
        const keys = (listed.Contents || []).map((o) => o.Key).filter((k): k is string => !!k);
        if (keys.length > 0) {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((k) => ({ Key: k })) } }));
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
