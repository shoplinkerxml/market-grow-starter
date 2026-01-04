import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { R2Storage } from '@/lib/r2-storage';
import { ImageHelpers } from '@/utils/imageHelpers';

type Uploaded = { url: string; object_key?: string };

type WorkerResponse =
  | { id: string; ok: true; passthrough: true }
  | { id: string; ok: true; passthrough: false; buffer: ArrayBuffer; name: string; type: string }
  | { id: string; ok: false; error?: string };

export function useImageUpload(productId?: string) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const workerStateRef = useRef<{
    worker: Worker | null;
    url: string | null;
    pending: Map<string, { resolve: (v: WorkerResponse) => void; reject: (e: unknown) => void }>;
  }>({ worker: null, url: null, pending: new Map() });

  const workerSource = useMemo(() => {
    return `
self.onmessage = async (event) => {
  const data = event.data || {};
  const id = String(data.id || "");
  const file = data.file;
  const maxSide = typeof data.maxSide === "number" ? data.maxSide : 1600;
  const quality = typeof data.quality === "number" ? data.quality : 0.85;
  const mimeType = typeof data.mimeType === "string" ? data.mimeType : "image/webp";

  const passthrough = () => {
    self.postMessage({ id, ok: true, passthrough: true });
  };

  try {
    if (!id) return;
    if (!file || !file.type || typeof file.type !== "string") return passthrough();
    if (!file.type.startsWith("image/")) return passthrough();
    if (file.type === "image/gif") return passthrough();
    if (typeof createImageBitmap !== "function") return passthrough();
    if (typeof OffscreenCanvas === "undefined") return passthrough();

    const bitmap = await createImageBitmap(file);
    const srcW = bitmap.width || 1;
    const srcH = bitmap.height || 1;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = new OffscreenCanvas(dstW, dstH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return passthrough();
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);

    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    const buffer = await blob.arrayBuffer();
    const baseName = String(file.name || "image").replace(/\\.[^/.]+$/, "");
    const ext = mimeType.includes("png") ? "png" : (mimeType.includes("jpeg") || mimeType.includes("jpg")) ? "jpg" : "webp";
    const name = baseName ? (baseName + "." + ext) : ("image." + ext);

    self.postMessage({ id, ok: true, passthrough: false, buffer, name, type: blob.type }, [buffer]);
  } catch (e) {
    const msg = (e && typeof e === "object" && "message" in e) ? String(e.message) : String(e);
    self.postMessage({ id, ok: false, error: msg });
  }
};
`;
  }, []);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const state = workerStateRef.current;
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const worker = new Worker(url);
    state.worker = worker;
    state.url = url;
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerResponse;
      const id = (msg as any)?.id ? String((msg as any).id) : '';
      const pending = state.pending.get(id);
      if (!pending) return;
      state.pending.delete(id);
      pending.resolve(msg);
    };
    worker.onerror = (err) => {
      for (const [, pending] of state.pending.entries()) pending.reject(err);
      state.pending.clear();
    };
    return () => {
      for (const [, pending] of state.pending.entries()) pending.reject(new Error('worker_terminated'));
      state.pending.clear();
      worker.terminate();
      URL.revokeObjectURL(url);
      state.worker = null;
      state.url = null;
    };
  }, [workerSource]);

  const processFile = useCallback(async (file: File): Promise<File> => {
    const state = workerStateRef.current;
    if (!state.worker) return file;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const res = await new Promise<WorkerResponse>((resolve, reject) => {
      state.pending.set(id, { resolve, reject });
      state.worker?.postMessage({ id, file, maxSide: 1600, quality: 0.85, mimeType: 'image/webp' });
    });
    if (!res.ok) return file;
    if (res.passthrough === true) return file;
    const blob = new Blob([res.buffer], { type: res.type });
    return new File([blob], res.name, { type: res.type, lastModified: file.lastModified });
  }, []);

  const uploadFromUrl = useCallback(async (url: string): Promise<Uploaded> => {
    const u = String(url || '').trim();
    if (!u) return { url: '', object_key: undefined };
    setUploading(true);
    setUploadProgress(null);
    try {
      if (productId) {
        const res = await R2Storage.uploadProductImageFromUrl(productId, u);
        return { url: res.originalUrl, object_key: res.r2KeyOriginal };
      }
      const key = ImageHelpers.extractObjectKeyFromUrl(u);
      return { url: u, object_key: key || undefined };
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [productId]);

  const uploadFileRaw = useCallback(async (file: File): Promise<Uploaded> => {
    if (productId) {
      const res = await R2Storage.uploadProductImage(productId, file);
      return { url: res.originalUrl, object_key: res.r2KeyOriginal };
    }
    const tmp = await R2Storage.uploadFile(file);
    return { url: tmp.publicUrl, object_key: tmp.objectKey };
  }, [productId]);

  const uploadFile = useCallback(async (file: File): Promise<Uploaded> => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const processed = await processFile(file);
      setUploadProgress(40);
      return await uploadFileRaw(processed);
    } finally {
      setUploadProgress(100);
      setUploading(false);
      setUploadProgress(null);
    }
  }, [processFile, uploadFileRaw]);

  const uploadFiles = useCallback(async (files: File[]): Promise<Array<PromiseSettledResult<Uploaded>>> => {
    const list = Array.isArray(files) ? files.filter(Boolean) : [];
    if (list.length === 0) return [];
    setUploading(true);
    setUploadProgress(0);
    try {
      let completed = 0;
      const total = list.length;
      const tasks = list.map(async (f) => {
        const res = await uploadFileRaw(await processFile(f));
        completed += 1;
        setUploadProgress(Math.round((completed / total) * 100));
        return res;
      });
      return await Promise.allSettled(tasks);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [processFile, uploadFileRaw]);

  return {
    isDragOver,
    setIsDragOver,
    uploading,
    uploadProgress,
    uploadFromUrl,
    uploadFile,
    uploadFiles,
  };
}
