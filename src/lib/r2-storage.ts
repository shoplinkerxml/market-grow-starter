import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { invokeSupabaseFunctionWithRetry } from "@/lib/request-handler";

const supabaseInvoke = supabase.functions.invoke.bind(supabase.functions) as any;

export type UploadResponse = {
  success: boolean;
  publicUrl: string;
  objectKey: string;
  viewUrl?: string;
};

export type UploadProductImageResult = {
  imageId: string;
  originalUrl: string;
  r2KeyOriginal: string;
  isMain: boolean;
  orderIndex: number;
};

type UploadProductImageResponse = {
  success?: boolean;
  image_id?: number;
  url?: string;
  original_url?: string;
  r2_key_original?: string;
  is_main?: boolean;
  order_index?: number;
};

type EdgeErrorContext = { status?: number; body?: unknown };
type EdgeErrorLike = { message?: string; context?: EdgeErrorContext };

function parseEdgeError(err: unknown, fallbackMessage: string): Error {
  const anyErr = err as EdgeErrorLike | undefined;
  const status = anyErr?.context?.status;
  let code: string | undefined;
  let serverMessage: string | undefined;
  try {
    const rawBody = anyErr?.context?.body as unknown;
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    const obj = body as Record<string, unknown> | undefined;
    code = typeof obj?.error === "string" ? (obj?.error as string) : undefined;
    serverMessage = typeof obj?.message === "string" ? (obj?.message as string) : undefined;
  } catch { void 0 }
  const e = new Error(code || serverMessage || anyErr?.message || fallbackMessage);
  (e as unknown as { status?: number }).status = typeof status === "number" ? status : undefined;
  (e as unknown as { code?: string }).code = code;
  return e;
}

function getAccessTokenSync(): string | null {
  try {
    const rawV1 = localStorage.getItem("supabase.auth.token");
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      const token = parsed?.currentSession?.access_token || parsed?.access_token || parsed?.accessToken || null;
      if (token) return token;
    }
    const urlObj = new URL(SUPABASE_URL);
    const projectRef = urlObj.host.split(".")[0];
    const v2Key = `sb-${projectRef}-auth-token`;
    const rawV2 = localStorage.getItem(v2Key);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      const token = parsed?.currentSession?.access_token || parsed?.access_token || parsed?.accessToken || null;
      if (token) return token;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const token = parsed?.currentSession?.access_token || parsed?.access_token || parsed?.accessToken || null;
          if (token) return token;
        } catch { void 0 }
      }
    }
    return null;
  } catch { return null }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return getAccessTokenSync();
  }
}

function buildAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function getPendingKey(userId: string): string { return `pending_uploads:${userId}`; }
function readPendingUploads(userId: string): string[] { try { return JSON.parse(localStorage.getItem(getPendingKey(userId)) || "[]"); } catch { return []; } }
function writePendingUploads(userId: string, list: string[]): void { try { if (list.length) localStorage.setItem(getPendingKey(userId), JSON.stringify(list)); else localStorage.removeItem(getPendingKey(userId)); } catch { void 0 } }
function addPendingUpload(userId: string, objectKey: string): void { const list = readPendingUploads(userId); list.push(objectKey); writePendingUploads(userId, list); }
function removePendingUploadKey(userId: string, objectKey: string): void { const list = readPendingUploads(userId); writePendingUploads(userId, list.filter((k) => k !== objectKey)); }

export const R2Storage = {
  getWorkerUrl(): string {
    try {
      const env = import.meta as unknown as { env?: Record<string, string> };
      const w = window as unknown as { __IMAGE_WORKER_URL__?: string };
      const v = env?.env?.VITE_IMAGE_WORKER_URL || w.__IMAGE_WORKER_URL__ || '';
      return v;
    } catch (e) { void e; return ''; }
  },
  getImageBaseUrl(): string {
    try {
      const base = (import.meta as any).env?.VITE_IMAGE_BASE_URL
        || (import.meta as any).env?.IMAGE_BASE_URL
        || (window as any).__IMAGE_BASE_URL__
        || '';
      if (!base) return '';
      const b = String(base).startsWith('http') ? String(base) : `https://${String(base)}`;
      try {
        const u = new URL(b);
        const origin = `${u.protocol}//${u.host}`;
        const path = (u.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
        return path ? `${origin}/${path}` : origin;
      } catch {
        return b;
      }
    } catch {
      return '';
    }
  },
  getR2PublicBaseUrl(): string {
    try {
      const base = (import.meta as any).env?.VITE_R2_PUBLIC_BASE_URL
        || (import.meta as any).env?.VITE_R2_PUBLIC_HOST
        || (import.meta as any).env?.R2_PUBLIC_BASE_URL
        || (import.meta as any).env?.R2_PUBLIC_HOST
        || (window as any).__R2_PUBLIC_BASE_URL__
        || (window as any).__R2_PUBLIC_HOST__
        || 'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev';
      if (!base) return '';
      const b = String(base).startsWith('http') ? String(base) : `https://${String(base)}`;
      try {
        const u = new URL(b);
        const origin = `${u.protocol}//${u.host}`;
        const path = (u.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
        return path ? `${origin}/${path}` : origin;
      } catch {
        return b;
      }
    } catch {
      return 'https://pub-b1876983df974fed81acea10f7cbc1c5.r2.dev';
    }
  },
  makePublicUrl(objectKey: string): string {
    const base = R2Storage.getR2PublicBaseUrl();
    if (!base) return objectKey;
    return `${base}/${objectKey}`;
  },
  /**
   * Загружает файл через Supabase proxy, избегая CORS проблем
   */
  async uploadFile(file: File, productId?: string): Promise<UploadResponse> {
    const token = await getAccessToken();
    const headers = token ? buildAuthHeaders(token) : undefined;
    const base64File: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(",");
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const { data, error } = await invokeSupabaseFunctionWithRetry<UploadResponse>(
      supabaseInvoke,
      "r2-upload",
      { body: { fileName: file.name, fileType: file.type, fileSize: file.size, fileData: base64File, productId }, headers },
    );
    if (error) throw parseEdgeError(error, "Failed to upload file to R2");
    const resp = data as UploadResponse;
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!productId && userId && resp?.objectKey && (resp.objectKey.includes(`uploads/tmp/${userId}/`) || resp.objectKey.includes(`/uploads/tmp/${userId}/`))) {
      addPendingUpload(userId, resp.objectKey);
    }
    const publicBase = R2Storage.getR2PublicBaseUrl();
    const parsedKey = resp.objectKey || R2Storage.extractObjectKeyFromUrl(resp.publicUrl || '') || '';
    const normalizedPublicUrl = parsedKey ? `${publicBase}/${parsedKey}` : (resp.publicUrl || '');
    return { success: !!resp.success, objectKey: parsedKey || resp.objectKey, publicUrl: normalizedPublicUrl, viewUrl: resp.viewUrl };
  },

  /**
   * Загружает изображение товара с ресайзом в три размера (original, card, thumb).
   * Использует edge function upload-product-image для обработки на бэкенде.
   */
  async uploadProductImage(productId: string, file: File): Promise<UploadProductImageResult> {
    const token = await getAccessToken();
    const headers = token ? buildAuthHeaders(token) : undefined;

    async function convertToWebpIfNeeded(input: File): Promise<File> {
      try {
        const type = String(input.type || '')
        const isImage = /^image\//i.test(type)
        const isWebp = /webp/i.test(type)
        if (!isImage || isWebp) return input
        const bitmap = await createImageBitmap(input)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return input
        ctx.drawImage(bitmap, 0, 0)
        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/webp', 0.85))
        if (!blob) return input
        const webpFile = new File([blob], input.name.replace(/\.[a-zA-Z0-9]+$/, '.webp'), { type: 'image/webp' })
        return webpFile
      } catch {
        return input
      }
    }

    const normalizedFile = await convertToWebpIfNeeded(file)

    const base64File: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(normalizedFile);
    });

    const { data, error } = await invokeSupabaseFunctionWithRetry<UploadProductImageResponse>(
      supabaseInvoke,
      "upload-product-image",
      { body: { productId, fileData: base64File, fileName: normalizedFile.name, fileType: normalizedFile.type }, headers },
    );

    if (error) throw parseEdgeError(error, 'upload_failed');
    
    const json = data as UploadProductImageResponse;
    const singleUrl = json.url || json.original_url || '';
    return {
      imageId: String(json.image_id || ''),
      originalUrl: singleUrl,
      r2KeyOriginal: json.r2_key_original || '',
      isMain: json.is_main || false,
      orderIndex: json.order_index || 0,
    };
  },

  /**
   * Загружает изображение товара по URL с ресайзом в три размера.
   */
  async uploadProductImageFromUrl(productId: string, url: string): Promise<UploadProductImageResult> {
    const token = await getAccessToken();
    const headers = token ? buildAuthHeaders(token) : undefined;

    const { data, error } = await invokeSupabaseFunctionWithRetry<UploadProductImageResponse>(
      supabaseInvoke,
      "upload-product-image",
      { body: { productId, url }, headers },
    );

    if (error) throw parseEdgeError(error, 'upload_failed');
    
    const json = data as UploadProductImageResponse;
    const singleUrl = json.url || json.original_url || '';
    return {
      imageId: String(json.image_id || ''),
      originalUrl: singleUrl,
      r2KeyOriginal: json.r2_key_original || '',
      isMain: json.is_main || false,
      orderIndex: json.order_index || 0,
    };
  },

  

  async cleanupPendingUploads(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const list = readPendingUploads(userId);
    if (!list.length) return;
    const toDelete = [...list];
    const remaining: string[] = [];
    const queue = [...toDelete];
    const concurrency = Math.min(5, queue.length);
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const key = queue.shift();
        if (!key) continue;
        try {
          const res = await R2Storage.deleteFile(key);
          if (!res?.success) remaining.push(key);
        } catch {
          remaining.push(key);
        }
      }
    });
    await Promise.all(workers);
    writePendingUploads(userId, remaining);
  },
  /**
   * Возвращает подписанный view URL для предпросмотра по objectKey (GET)
   */
  async getViewUrl(objectKey: string, expiresInSeconds: number = 3600): Promise<string> {
    const token = await getAccessToken();
    const headers = token ? buildAuthHeaders(token) : undefined;

    const { data, error } = await invokeSupabaseFunctionWithRetry<{ viewUrl: string }>(
      supabaseInvoke,
      "r2-view",
      { body: { objectKey, expiresIn: expiresInSeconds }, headers },
    );

    if (error) throw parseEdgeError(error, 'Failed to get view URL from R2');

    return (data?.viewUrl as string) || '';
  },

  /**
   * Извлекает objectKey из публичных URL R2.
   * Поддерживает оба варианта:
   * - r2.dev: https://<account>.r2.dev/<bucket>/<objectKey>
   * - cloudflarestorage.com: https://<bucket>.<account>.r2.cloudflarestorage.com/<objectKey>
   * Также содержит фолбэк: ищет подстроку "uploads/" и возвращает путь от неё.
   */
  extractObjectKeyFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const pathname = (u.pathname || '/').replace(/^\/+/, '');
      if (!pathname) return null;
      const idxProducts = pathname.indexOf('products/');
      const idxUploads = pathname.indexOf('uploads/');
      if (idxProducts >= 0) return pathname.slice(idxProducts);
      if (idxUploads >= 0) return pathname.slice(idxUploads);
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length <= 1) return parts[0] || null;
      return parts.slice(1).join('/');
    } catch { return null }
  },

  /**
   * Удаляет файл из R2 по objectKey через Edge Function
   */
  async deleteFile(objectKey: string): Promise<{ success: boolean }> {
    const token = await getAccessToken();
    const headers = token ? buildAuthHeaders(token) : undefined;
    const syncToken = getAccessTokenSync();
    const authorizationInBody = token ? `Bearer ${token}` : (syncToken ? `Bearer ${syncToken}` : undefined);

    const { data, error } = await invokeSupabaseFunctionWithRetry<{ success: boolean }>(
      supabaseInvoke,
      "r2-delete",
      { body: { objectKey, authorization: authorizationInBody }, headers },
    );

    if (error) throw parseEdgeError(error, 'Failed to delete file from R2');

    return data as { success: boolean };
  },

  /**
   * Удаляет файл через прямой запрос к Supabase Functions с keepalive для pagehide
   * Используется как фолбэк при уходе со страницы, когда обычные вызовы могут оборваться
   */
  async deleteFileKeepalive(objectKey: string): Promise<boolean> {
    try {
      let token = getAccessTokenSync();
      // Фолбэк: если синхронно не нашли токен, попробуем получить его из supabase (может не успеть при уходе)
      if (!token) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token || null;
        } catch { void 0 }
      }

      // Для unload используем простое тело без нестандартных заголовков, чтобы не было preflight:
      // - отправляем JSON строкой (text/plain)
      // - токен передаём в body (authorization), а не в заголовке

      // Формируем единственный URL для функций (path-style), чтобы избежать дублей запросов
      const fnUrl = `${SUPABASE_URL}/functions/v1/r2-delete`;

      const body = JSON.stringify({ objectKey, authorization: token ? `Bearer ${token}` : undefined });
      const init: RequestInit = {
        method: 'POST',
        // Минимизируем вероятность preflight: не добавляем лишние заголовки.
        // Токен передаём в теле запроса как authorization.
        body,
        mode: 'cors',
        keepalive: true,
      };

      // Выполняем один fetch с keepalive, чтобы запрос был виден в Network (Fetch/XHR)
      // Возвращаем успешность доставки ответа (res.ok)
      try {
        const res = await fetch(fnUrl, init);
        return res.ok;
      } catch {
        return false;
      }
    } catch {
      // Безопасно игнорируем ошибки в keepalive сценарию
      return false;
    }
  },

  /**
   * Удаляет ключ из локального списка незавершённых загрузок пользователя
   */
  async removePendingUpload(objectKey: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    removePendingUploadKey(userId, objectKey);
  },

  /**
   * @deprecated Используйте uploadFile вместо этого метода
   */
  async getUploadUrl(fileName: string, contentType: string, productId?: string): Promise<unknown> {
    const { data, error } = await invokeSupabaseFunctionWithRetry<unknown>(
      supabaseInvoke,
      "r2-presign",
      { body: { fileName, contentType, productId } },
    );
    if (error) throw new Error(error.message ?? "Failed to presign R2 upload");
    return data;
  },
};
