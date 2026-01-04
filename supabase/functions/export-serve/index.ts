import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function readExportLink(format: string, token: string) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";
  const res = await fetch(
    `${url}/rest/v1/store_export_links?select=object_key,format,token,is_active&format=eq.${format}&token=eq.${token}&is_active=eq.true`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data[0] ? data[0] : null;
}

function ensureXmlHeaderText(text: string): string {
  return text;
}

async function readFromR2(objectKey: string): Promise<ReadableStream<Uint8Array> | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  const obj = await s3.send(cmd);
  const body = obj.Body as ReadableStream<Uint8Array>;
  return body || null;
}

async function readFromSupabaseStorage(
  objectKey: string,
): Promise<ReadableStream<Uint8Array> | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "",
  );

  const { data } = await supabase.storage.from("exports").download(objectKey);
  if (!data) return null;

  return (data as Blob).stream();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "export");

    if (idx === -1 || parts.length < idx + 3) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const format = parts[idx + 1];
    const token = parts[idx + 2];
    const dl = url.searchParams.get("dl");

    if (format !== "xml" && format !== "csv") {
      return new Response(JSON.stringify({ error: "unsupported_format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const link = await readExportLink(format, token);
    if (!link?.object_key) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const objectKey = String(link.object_key);
    const contentType =
      format === "xml"
        ? "application/xml; charset=utf-8"
        : "text/csv; charset=utf-8";
    const filename = format === "xml" ? "export.xml" : "export.csv";

    let stream: ReadableStream<Uint8Array> | null = null;

    // 1) пробуем R2
    try {
      stream = await readFromR2(objectKey);
    } catch {
      stream = null;
    }

    // 2) fallback: Supabase Storage
    if (!stream) {
      stream = await readFromSupabaseStorage(objectKey);
    }

    if (stream == null) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(stream as any, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": (format === "xml" && dl !== "1")
          ? `inline; filename=${filename}`
          : `attachment; filename=${filename}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "serve_failed",
        message: e?.message || "failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
