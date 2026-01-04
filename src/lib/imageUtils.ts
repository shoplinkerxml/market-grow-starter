import { R2Storage } from "@/lib/r2-storage";
import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";

const IMAGE_URL_CACHE_MAX_SIZE = 500;
const imageUrlCache = UnifiedCacheManager.create("imageUtils:url", {
  mode: "memory",
  defaultTtlMs: CACHE_TTL.uiPrefs,
  maxSize: IMAGE_URL_CACHE_MAX_SIZE,
});

function cacheGet(key: string): string | undefined {
  const v = imageUrlCache.get<string>(key, false);
  return v === null ? undefined : v;
}

function cacheSet(key: string, value: string): void {
  imageUrlCache.set(key, value, CACHE_TTL.uiPrefs);
}

export function getImageUrl(originalUrl: string | null | undefined, _width?: number): string {
  const raw = originalUrl || "";
  if (raw === "" || raw === "#processing" || raw === "#failed") return "";
  const key = `${raw}|${_width ?? 0}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const isAbsolute = /^https?:\/\//i.test(raw);
  const resolved = isAbsolute ? raw : R2Storage.makePublicUrl(raw);
  cacheSet(key, resolved);
  return resolved;
}

export const IMAGE_SIZES = {
  THUMB: 200,
  CARD: 600,
  LARGE: 1200,
} as const;

export function isVideoUrl(u: string | null | undefined): boolean {
  const s = String(u || "");
  return /\.(mp4|webm|mov|mkv)(\?|#|$)/i.test(s);
}
