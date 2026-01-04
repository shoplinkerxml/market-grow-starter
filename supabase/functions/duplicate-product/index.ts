import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, CopyObjectCommand } from "npm:@aws-sdk/client-s3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

// ============================================================================
// Types
// ============================================================================

type StoreProduct = {
  id: string;
  store_id: string;
  supplier_id: string | null;
  external_id: string;
  name: string;
  name_ua: string | null;
  docket: string | null;
  docket_ua: string | null;
  description: string | null;
  description_ua: string | null;
  vendor: string | null;
  article: string | null;
  category_id: number | null;
  category_external_id: string | null;
  currency_code: string | null;
  price: number | null;
  price_old: number | null;
  price_promo: number | null;
  stock_quantity: number;
  available: boolean;
  state: string;
};

type ProductParam = {
  name: string;
  value: string;
  order_index: number;
  paramid: string | null;
  valueid: string | null;
};

type ProductImage = {
  url: string;
  order_index: number;
  is_main: boolean;
};

type UserStore = {
  id: string;
  user_id: string;
};

type Subscription = {
  id: string;
  tariff_id: number;
  end_date: string | null;
  is_active: boolean;
  start_date: string;
};

type RequestBody = {
  productId: string;
};

type ApiResponse = {
  success?: boolean;
  product?: StoreProduct;
  error?: string;
  message?: string;
};

// ============================================================================
// Constants
// ============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
};

// ============================================================================
// Environment & Clients
// ============================================================================

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ACCOUNT_ID: Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "",
  BUCKET: Deno.env.get("R2_BUCKET_NAME") ?? "",
  ACCESS_KEY_ID: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
  SECRET_ACCESS_KEY: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
} as const;

// Validate environment
if (Object.values(ENV).some(val => !val)) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(ENV.SUPABASE_URL, ENV.SERVICE_KEY);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ENV.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV.ACCESS_KEY_ID,
    secretAccessKey: ENV.SECRET_ACCESS_KEY,
  },
});

// ============================================================================
// Utility Functions
// ============================================================================

function base64UrlToBase64(input: string): string {
  return input.replace(/-/g, "+").replace(/_/g, "/");
}

function decodeJwtSub(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  
  if (parts.length !== 3) return null;
  
  try {
    const payload = atob(base64UrlToBase64(parts[1]));
    const json = JSON.parse(payload);
    return json?.sub ?? null;
  } catch {
    return null;
  }
}

function extractObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname.replace(/^\/+/, "");
    const parts = pathname.split("/").filter(Boolean);

    // Для pub-xxx.r2.dev URLs - весь pathname это ключ
    if (u.host.includes(".r2.dev")) {
      return pathname || null;
    }

    // Для cloudflarestorage.com - проверяем path-style vs subdomain
    if (u.host.includes("cloudflarestorage.com")) {
      const hostParts = u.host.split(".");
      // Path-style: account.r2.cloudflarestorage.com/bucket/key
      if (hostParts[0] && !hostParts[0].startsWith("pub-")) {
        return parts.length >= 2 ? parts.slice(1).join("/") : null;
      }
      // Subdomain-style: bucket.account.r2.cloudflarestorage.com/key
      return pathname || null;
    }

    // Fallback - ищем products/ в пути
    const productsIdx = pathname.indexOf("products/");
    if (productsIdx >= 0) {
      return pathname.slice(productsIdx);
    }

    return pathname || null;
  } catch (error) {
    console.error("Failed to extract key from URL:", url, error);
    return null;
  }
}

function isOurBucket(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.host;
    // Проверяем все возможные варианты наших доменов
    return (
      host.includes("r2.cloudflarestorage.com") ||
      host.includes(".r2.dev") ||
      host.includes(ENV.BUCKET) ||
      host.includes(ENV.ACCOUNT_ID)
    );
  } catch {
    return false;
  }
}

function generateDatePath(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function generateUniqueId(): string {
  return crypto.randomUUID?.() ?? 
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function createResponse(data: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

// ============================================================================
// Business Logic
// ============================================================================

async function validateSubscription(userId: string): Promise<{
  isValid: boolean;
  maxProducts: number;
}> {
  const { data: subscriptions } = await supabase
    .from("user_subscriptions")
    .select("id,tariff_id,end_date,is_active,start_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1);

  let activeSub = (subscriptions as Subscription[])?.[0] || null;

  // Check if subscription expired
  if (activeSub?.end_date) {
    const endMs = new Date(activeSub.end_date).getTime();
    if (endMs < Date.now()) {
      await supabase
        .from("user_subscriptions")
        .update({ is_active: false })
        .eq("id", activeSub.id);
      activeSub = null;
    }
  }

  if (!activeSub) {
    return { isValid: false, maxProducts: 0 };
  }

  // Get tariff limits
  const { data: limitRow } = await supabase
    .from("tariff_limits")
    .select("value")
    .eq("tariff_id", activeSub.tariff_id)
    .ilike("limit_name", "%товар%")
    .eq("is_active", true)
    .maybeSingle();

  const maxProducts = Number(limitRow?.value ?? 0);

  return {
    isValid: Number.isFinite(maxProducts) && maxProducts > 0,
    maxProducts,
  };
}

async function checkProductLimit(userId: string, maxProducts: number): Promise<boolean> {
  const { data: userStores } = await supabase
    .from("user_stores")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!userStores?.length) return true;

  const storeIds = userStores.map((s) => s.id);
  
  const { count } = await supabase
    .from("store_products")
    .select("id", { count: "exact", head: true })
    .in("store_id", storeIds);

  return Number(count || 0) < maxProducts;
}

async function copyImageToR2(
  sourceUrl: string,
  newProductId: string,
  index: number
): Promise<{ url: string; key: string | null }> {
  // Если это не наше хранилище - оставляем URL как есть
  if (!isOurBucket(sourceUrl)) {
    console.log(`External image, skipping copy: ${sourceUrl}`);
    return { url: sourceUrl, key: null };
  }

  const sourceKey = extractObjectKeyFromUrl(sourceUrl);
  if (!sourceKey) {
    console.error(`Failed to extract key from URL: ${sourceUrl}`);
    return { url: sourceUrl, key: null };
  }

  console.log(`Copying image from key: ${sourceKey}`);

  // Извлекаем оригинальное имя файла
  const parts = sourceKey.split("/").filter(Boolean);
  const originalFileName = parts[parts.length - 1] || "image.webp";
  const cleanName = sanitizeFilename(originalFileName);

  // Создаем новый путь с ID нового продукта
  // Формат: products/{newProductId}/{index}/original.webp (или другое имя)
  const destKey = `products/${newProductId}/${index}/${cleanName}`;

  console.log(`Destination key: ${destKey}`);

  try {
    // Копируем файл в R2
    await s3.send(
      new CopyObjectCommand({
        Bucket: ENV.BUCKET,
        Key: destKey,
        CopySource: `${ENV.BUCKET}/${sourceKey}`,
        // Копируем метаданные
        MetadataDirective: "COPY",
      })
    );

    // Формируем новый URL
    // Используем тот же формат что и в исходном URL
    const sourceUrlObj = new URL(sourceUrl);
    const newUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}/${destKey}`;

    console.log(`Image copied successfully to: ${newUrl}`);
    return { url: newUrl, key: destKey };

  } catch (error) {
    console.error(`Failed to copy image from ${sourceKey} to ${destKey}:`, error);
    // В случае ошибки возвращаем исходный URL
    return { url: sourceUrl, key: null };
  }
}

async function duplicateImages(
  images: ProductImage[],
  newProductId: string
): Promise<void> {
  if (!images.length) return;

  console.log(`Duplicating ${images.length} images for product ${newProductId}`);

  // Копируем изображения параллельно (с индексом для пути)
  const copiedImages = await Promise.all(
    images.map(async (img, idx) => {
      const copied = await copyImageToR2(img.url, newProductId, idx);
      return {
        url: copied.url,
        r2_key_original: copied.key,
        order_index: typeof img.order_index === "number" ? img.order_index : idx,
        is_main: img.is_main,
      };
    })
  );

  // Гарантируем что есть ровно одно главное изображение
  const hasMain = copiedImages.some((img) => img.is_main);
  const normalized = copiedImages.map((img, idx) => ({
    product_id: newProductId,
    url: img.url,
    r2_key_original: img.r2_key_original || null,
    order_index: img.order_index,
    is_main: hasMain ? img.is_main : idx === 0,
  }));

  // Сортируем: главное изображение первым
  const mainIndex = normalized.findIndex((img) => img.is_main);
  if (mainIndex > 0) {
    const [mainImg] = normalized.splice(mainIndex, 1);
    normalized.unshift(mainImg);
  }

  // Переназначаем order_index после сортировки
  const ordered = normalized.map((img, idx) => ({
    ...img,
    order_index: idx,
  }));

  console.log(`Inserting ${ordered.length} images to database`);

  // Сохраняем в базу
  const { error } = await supabase
    .from("store_product_images")
    .insert(ordered);

  if (error) {
    console.error("Failed to insert images:", error);
    throw new Error(`Failed to save images: ${error.message}`);
  }

  console.log(`Successfully duplicated ${ordered.length} images`);
}

async function duplicateParams(
  params: ProductParam[],
  productId: string
): Promise<void> {
  if (!params.length) return;

  const paramsData = params.map((p, idx) => ({
    product_id: productId,
    name: p.name,
    value: p.value,
    order_index: typeof p.order_index === "number" ? p.order_index : idx,
    paramid: p.paramid ?? null,
    valueid: p.valueid ?? null,
  }));

  await supabase.from("store_product_params").insert(paramsData);
}

async function createProductCopy(
  original: StoreProduct,
  attempt: number = 0
): Promise<StoreProduct | null> {
  const externalId = attempt === 0
    ? original.external_id
    : `${original.external_id}-copy-${Math.floor(Math.random() * 10000)}`;

  const payload = {
    store_id: original.store_id,
    supplier_id: original.supplier_id,
    external_id: externalId,
    name: original.name,
    name_ua: original.name_ua,
    docket: original.docket,
    docket_ua: original.docket_ua,
    description: original.description,
    description_ua: original.description_ua,
    vendor: original.vendor,
    article: original.article,
    category_id: original.category_id,
    category_external_id: original.category_external_id,
    currency_code: original.currency_code,
    price: original.price,
    price_old: original.price_old,
    price_promo: original.price_promo,
    stock_quantity: original.stock_quantity ?? 0,
    available: original.available ?? true,
    state: original.state ?? "new",
  };

  const { data, error } = await supabase
    .from("store_products")
    .insert([payload])
    .select("*")
    .single();

  if (error && attempt === 0) {
    // Retry with modified external_id
    return createProductCopy(original, 1);
  }

  return error ? null : (data as StoreProduct);
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // 1. Authentication
    const authHeader = req.headers.get("authorization");
    const userId = decodeJwtSub(authHeader);

    if (!userId) {
      return createResponse({ error: "unauthorized" }, 401);
    }

    // 2. Parse request body
    const body = await req.json() as RequestBody;
    const productId = String(body?.productId || "").trim();

    if (!productId) {
      return createResponse({ error: "invalid_body" }, 400);
    }

    // 3. Load original product and related data in parallel
    const [
      { data: original },
      { data: params },
      { data: images },
    ] = await Promise.all([
      supabase
        .from("store_products")
        .select("*")
        .eq("id", productId)
        .maybeSingle(),
      supabase
        .from("store_product_params")
        .select("name,value,order_index,paramid,valueid")
        .eq("product_id", productId)
        .order("order_index", { ascending: true }),
      supabase
        .from("store_product_images")
        .select("url,order_index,is_main")
        .eq("product_id", productId)
        .order("order_index", { ascending: true }),
    ]);

    if (!original) {
      return createResponse({ error: "not_found" }, 404);
    }

    // 4. Verify ownership - get store and check user
    const { data: storeRow } = await supabase
      .from("user_stores")
      .select("id,user_id")
      .eq("id", (original as StoreProduct).store_id)
      .maybeSingle();

    if (!storeRow || storeRow.user_id !== userId) {
      return createResponse({ error: "forbidden" }, 403);
    }

    // 5. Validate subscription and limits
    const { isValid, maxProducts } = await validateSubscription(userId);

    if (!isValid) {
      return createResponse({
        error: "limit_reached",
        message: "Ліміт товарів вичерпано",
      }, 400);
    }

    const hasCapacity = await checkProductLimit(userId, maxProducts);

    if (!hasCapacity) {
      return createResponse({
        error: "limit_reached",
        message: "Ліміт товарів вичерпано",
      }, 400);
    }

    // 6. Create product copy
    const created = await createProductCopy(original as StoreProduct);

    if (!created) {
      return createResponse({ error: "create_failed" }, 500);
    }

    // 7. Duplicate related data in parallel
    await Promise.all([
      duplicateImages(
        (images as ProductImage[]) || [],
        created.id
      ),
      duplicateParams(
        (params as ProductParam[]) || [],
        created.id
      ),
    ]);

    console.log(`Product ${productId} successfully duplicated as ${created.id}`);

    return createResponse({ success: true, product: created }, 200);

  } catch (error) {
    console.error("Duplicate product error:", error);
    
    return createResponse({
      error: "duplicate_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
