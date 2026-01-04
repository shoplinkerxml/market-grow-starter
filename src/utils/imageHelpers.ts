import type React from 'react';
import { R2Storage } from '@/lib/r2-storage';

export const ImageHelpers = {
  isImageUrl(url: string): boolean {
    const u = String(url || '');
    return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|#|$)/i.test(u) || u.startsWith('data:image/');
  },

  async extractFromDragEvent(e: React.DragEvent): Promise<string | null> {
    try {
      const htmlData = e.dataTransfer.getData('text/html');
      if (htmlData) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const img = doc.querySelector('img');
        if (img?.src && this.isImageUrl(img.src)) return img.src;
        const a = doc.querySelector('a[href]');
        const href = a?.getAttribute('href') || '';
        if (href && this.isImageUrl(href)) return href;
      }

      const textData = e.dataTransfer.getData('text/plain');
      if (textData && this.isImageUrl(textData)) return textData;

      const uriList = e.dataTransfer.getData('text/uri-list');
      if (uriList) {
        const first = uriList.split('\n').find(line => line.trim() && !line.startsWith('#')) || '';
        if (first && this.isImageUrl(first)) return first.trim();
      }

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const str = await new Promise<string | null>((resolve) => {
          let done = false;
          try {
            for (const item of Array.from(e.dataTransfer.items)) {
              if (item.kind === 'string') {
                item.getAsString((s) => {
                  if (done) return;
                  const val = String(s || '');
                  if (val && this.isImageUrl(val)) {
                    done = true;
                    resolve(val);
                  }
                });
              }
            }
            setTimeout(() => { if (!done) resolve(null); }, 25);
          } catch {
            resolve(null);
          }
        });
        if (str) return str;
      }
    } catch {
    }
    return null;
  },

  normalizeImageUrl(u: string): string {
    const s = String(u || '');
    if (!s) return s;
    return s.replace(/\.(web|wep)(\?|#|$)/, '.webp$2');
  },

  normalizeObjectKeyExt(key?: string | null): string | undefined {
    const k = String(key || '');
    if (!k) return undefined;
    return k.replace(/\.web$/, '.webp');
  },

  extractObjectKeyFromUrl(url?: string | null): string | null {
    const u = String(url || '');
    if (!u) return null;
    return R2Storage.extractObjectKeyFromUrl(u);
  },

  async ensureAbsoluteUrl(previewUrl: string, objectKeyRaw?: string | null): Promise<string> {
    const url = String(previewUrl || '');
    if (/^https?:\/\//i.test(url)) return url;
    const key = String(objectKeyRaw || url || '').replace(/^\/+/, '');
    const base = R2Storage.getR2PublicBaseUrl();
    if (base) return `${base}/${key}`;
    try {
      const view = await R2Storage.getViewUrl(key);
      return String(view || url);
    } catch {
      return url;
    }
  },

  async resolveDisplayUrl(args: { url?: string | null; objectKey?: string | null }): Promise<string> {
    const rawUrl = String(args.url || '').trim();
    const rawKey = String(args.objectKey || '').trim();
    if (!rawUrl && !rawKey) return '';

    const normalizedUrl = this.normalizeImageUrl(rawUrl);
    const fromUrl = normalizedUrl ? (this.extractObjectKeyFromUrl(normalizedUrl) || undefined) : undefined;
    const key = this.normalizeObjectKeyExt(rawKey || fromUrl);
    return await this.ensureAbsoluteUrl(normalizedUrl, key || fromUrl);
  },
};
