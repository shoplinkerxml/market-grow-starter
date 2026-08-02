import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/inngest";

interface StartBody {
  supplier_id: number;
  trigger?: "manual" | "scheduled";
  /** Optional: path inside the `supplier-xml-uploads` bucket for a manually uploaded file. */
  storage_path?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendInngestEvent(
  name: string,
  data: Record<string, unknown>,
  id?: string,
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const INNGEST_API_KEY = Deno.env.get("INNGEST_API_KEY");
  if (!LOVABLE_API_KEY || !INNGEST_API_KEY) {
    throw new Error("Inngest connector secrets are not configured");
  }
  const res = await fetch(`${GATEWAY_URL}/e/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": INNGEST_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(id ? { id, name, data } : { name, data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Inngest event send failed [${res.status}]: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub as string;

    let body: StartBody;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
    if (!body || typeof body.supplier_id !== "number") {
      return json(400, { error: "supplier_id (number) is required" });
    }
    const trigger = body.trigger === "scheduled" ? "scheduled" : "manual";
    const storagePath =
      typeof body.storage_path === "string" && body.storage_path.trim()
        ? body.storage_path.trim().replace(/^\/+/, "")
        : null;
    if (storagePath) {
      if (storagePath.includes("..") || !storagePath.startsWith(`${userId}/`)) {
        return json(403, { error: "Invalid storage path" });
      }
      if (!/\.(xml|yml)$/i.test(storagePath)) {
        return json(400, { error: "Only .xml files are supported" });
      }
    }

    // Service-role client for privileged DB operations.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate supplier belongs to user and has an xml_feed_url.
    const { data: supplier, error: supErr } = await admin
      .from("user_suppliers")
      .select("id, user_id, xml_feed_url, supplier_name")
      .eq("id", body.supplier_id)
      .maybeSingle();
    if (supErr) return json(500, { error: supErr.message });
    if (!supplier || supplier.user_id !== userId) {
      return json(404, { error: "Supplier not found" });
    }
    if (!storagePath && !supplier.xml_feed_url) {
      return json(400, { error: "Supplier has no xml_feed_url configured" });
    }

    // Resolve the effective XML source: uploaded file (signed URL) or feed URL.
    let effectiveXmlUrl = supplier.xml_feed_url as string;
    if (storagePath) {
      const { data: signed, error: signErr } = await admin.storage
        .from("supplier-xml-uploads")
        .createSignedUrl(storagePath, 60 * 60 * 6);
      if (signErr || !signed?.signedUrl) {
        return json(400, {
          error: signErr?.message || "Uploaded file not found",
        });
      }
      effectiveXmlUrl = signed.signedUrl;
    }

    // Check active run guard (queued/running) — prevent duplicates.
    const { data: activeRun } = await admin
      .from("supplier_import_runs")
      .select("id, status")
      .eq("supplier_id", supplier.id)
      .in("status", ["queued", "running"])
      .limit(1)
      .maybeSingle();
    if (activeRun) {
      return json(409, {
        error: "Import already in progress",
        run_id: activeRun.id,
      });
    }

    // Create run row in queued status.
    const { data: run, error: runErr } = await admin
      .from("supplier_import_runs")
      .insert({
        user_id: userId,
        supplier_id: supplier.id,
        trigger,
        status: "queued",
        xml_url: effectiveXmlUrl,
      })
      .select("id")
      .single();
    if (runErr || !run) {
      return json(500, { error: runErr?.message || "Failed to create run" });
    }

    // Idempotency: 1 event per (supplier, minute) to dedupe rapid clicks.
    const minuteIso = new Date().toISOString().slice(0, 16);
    const eventId = storagePath
      ? `import:${supplier.id}:upload:${run.id}`
      : `import:${supplier.id}:${minuteIso}`;

    try {
      await sendInngestEvent(
        "supplier/import.requested",
        {
          run_id: run.id,
          user_id: userId,
          supplier_id: supplier.id,
          xml_url: effectiveXmlUrl,
          trigger,
          source: storagePath ? "upload" : "url",
          storage_path: storagePath,
        },
        eventId,
      );
    } catch (e) {
      // Roll back run row if the event could not be queued.
      await admin
        .from("supplier_import_runs")
        .update({
          status: "failed",
          error: (e as Error).message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      return json(502, { error: (e as Error).message });
    }

    return json(200, { run_id: run.id, status: "queued" });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});