import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductImage } from '@/components/ProductFormTabs/types';
import { ProductService } from '@/lib/product-service';
import { ImageHelpers } from '@/utils/imageHelpers';
import { getImageUrl } from '@/lib/imageUtils';

function buildImageKey(img: ProductImage): string {
  const objectKeyRaw = img.object_key || ImageHelpers.extractObjectKeyFromUrl(img.url);
  const objectKeyFixed = ImageHelpers.normalizeObjectKeyExt(objectKeyRaw);
  if (objectKeyFixed) return `k:${objectKeyFixed}`;
  return `u:${String(img.url || '').trim()}`;
}

function dedupeImages(list: ProductImage[]): ProductImage[] {
  const sorted = (list || []).slice().sort((a, b) => {
    const ao = typeof a.order_index === 'number' ? a.order_index : 0;
    const bo = typeof b.order_index === 'number' ? b.order_index : 0;
    if (ao !== bo) return ao - bo;
    const aid = String(a.id || a.object_key || a.url || '');
    const bid = String(b.id || b.object_key || b.url || '');
    return aid.localeCompare(bid);
  });

  const out: ProductImage[] = [];
  const idxByKey = new Map<string, number>();

  for (const img of sorted) {
    const key = buildImageKey(img);
    const existingIdx = idxByKey.get(key);
    if (existingIdx == null) {
      idxByKey.set(key, out.length);
      out.push(img);
      continue;
    }
    const current = out[existingIdx];
    if (!current?.is_main && img.is_main) {
      out[existingIdx] = img;
    }
  }

  let mainAssigned = false;
  const normalized = out.map((img, idx) => {
    const isMain = !!img.is_main;
    if (isMain && !mainAssigned) {
      mainAssigned = true;
      return { ...img, is_main: true, order_index: idx };
    }
    return { ...img, is_main: false, order_index: idx };
  });

  if (!mainAssigned && normalized.length > 0) {
    normalized[0] = { ...normalized[0], is_main: true };
  }

  return normalized;
}

export function useProductImages(productId?: string, preloadedImages?: ProductImage[]) {
  const [images, setImages] = useState<ProductImage[]>(preloadedImages || []);
  const [activeIndex, setActiveIndex] = useState(0);
  const imagesRef = useRef<ProductImage[]>(preloadedImages || []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const addImages = useCallback((newImages: ProductImage[]) => {
    setImages(prev => {
      const existing = new Set(prev.map(buildImageKey));
      const merged = [...prev];
      for (const img of newImages || []) {
        const key = buildImageKey(img);
        if (existing.has(key)) continue;
        existing.add(key);
        merged.push(img);
      }
      const combined = dedupeImages(merged);
      imagesRef.current = combined;
      return combined;
    });
  }, []);

  const reload = useCallback(async () => {
    if (!productId) return;
    const list = await ProductService.getProductImages(String(productId));
    const resolved = await Promise.all((list || []).map(async (img, index) => {
      const objectKeyRaw = ImageHelpers.extractObjectKeyFromUrl(img.url);
      const objectKeyFixed = ImageHelpers.normalizeObjectKeyExt(objectKeyRaw);
      const previewUrl = ImageHelpers.normalizeImageUrl(img.url || '');
      const absolutePreview = await ImageHelpers.ensureAbsoluteUrl(previewUrl, objectKeyFixed || objectKeyRaw);
      return {
        id: img.id,
        url: absolutePreview,
        alt_text: img.alt_text || '',
        order_index: typeof img.order_index === 'number' ? img.order_index : index,
        is_main: !!img.is_main,
        object_key: objectKeyFixed || undefined,
      } as ProductImage;
    }));
    const next = dedupeImages(resolved as ProductImage[]);
    setImages(next);
    imagesRef.current = next;
    if (activeIndex >= next.length) {
      setActiveIndex(Math.max(0, next.length - 1));
    }
  }, [productId, activeIndex]);

  const removeImage = useCallback(async (index: number) => {
    const target = imagesRef.current[index];
    const newImages = imagesRef.current.filter((_, i) => i !== index).map((img, i) => ({ ...img, order_index: i }));
    if (target?.is_main && newImages.length > 0) {
      newImages[0] = { ...newImages[0], is_main: true };
      for (let i = 1; i < newImages.length; i++) {
        if (newImages[i].is_main) newImages[i] = { ...newImages[i], is_main: false };
      }
    }
    setImages(newImages);
    imagesRef.current = newImages;
    if (activeIndex >= newImages.length) {
      setActiveIndex(Math.max(0, newImages.length - 1));
    } else if (activeIndex === index) {
      setActiveIndex(Math.min(index, newImages.length - 1));
    }
    if (productId) {
      await ProductService.updateProduct(String(productId), { images: newImages as any });
    }
  }, [activeIndex, productId]);

  const setMainImage = useCallback(async (index: number) => {
    const newImages = imagesRef.current.map((img, i) => ({ ...img, is_main: i === index }));
    setImages(newImages);
    imagesRef.current = newImages;
    setActiveIndex(index);
    if (productId) {
      await ProductService.updateProduct(String(productId), { images: newImages as any });
    }
  }, [productId]);

  const reorderImages = useCallback(async (list: ProductImage[]) => {
    setImages(list);
    imagesRef.current = list;
    if (productId) {
      await ProductService.updateProduct(String(productId), { images: list as any });
    }
  }, [productId]);

  const goNext = useCallback(() => {
    setActiveIndex(prev => {
      const total = imagesRef.current.length;
      if (total === 0) return 0;
      return prev === total - 1 ? 0 : prev + 1;
    });
  }, []);

  const goPrevious = useCallback(() => {
    setActiveIndex(prev => {
      const total = imagesRef.current.length;
      if (total === 0) return 0;
      return prev === 0 ? Math.max(0, total - 1) : prev - 1;
    });
  }, []);

  const goToIndex = useCallback((i: number) => {
    const idx = Math.max(0, Math.min(i, Math.max(0, imagesRef.current.length - 1)));
    setActiveIndex(idx);
  }, []);

  const canGoNext = images.length > 1;
  const canGoPrevious = images.length > 1;

  return {
    images,
    activeIndex,
    setActiveIndex,
    goNext,
    goPrevious,
    goToIndex,
    canGoNext,
    canGoPrevious,
    addImages,
    removeImage,
    setMainImage,
    reorderImages,
    reload,
  };
}

export function useResolvedImageSrc(args: { url?: string | null; objectKey?: string | null; width?: number; fallbackUrl?: string | null }) {
  const rawUrl = String(args.url || '').trim();
  const fallbackUrl = String(args.fallbackUrl || '').trim();
  const width = args.width;

  const initial = useMemo(() => (rawUrl ? getImageUrl(rawUrl, width) : ''), [rawUrl, width]);
  const [src, setSrc] = useState<string>(initial);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  useEffect(() => {
    setSrc(initial);
    setFallbackUsed(false);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    if (!rawUrl) return;

    ImageHelpers.resolveDisplayUrl({ url: rawUrl, objectKey: args.objectKey })
      .then((resolved) => {
        if (cancelled) return;
        const next = String(resolved || '').trim();
        if (next) setSrc(next);
      })
      .catch(() => void 0);

    return () => {
      cancelled = true;
    };
  }, [rawUrl, args.objectKey]);

  const onError = useCallback(() => {
    if (fallbackUsed) return;
    const fb = fallbackUrl || rawUrl;
    if (!fb) return;
    setFallbackUsed(true);
    setSrc(getImageUrl(fb, width));
  }, [fallbackUsed, fallbackUrl, rawUrl, width]);

  return { src, onError, fallbackUsed };
}
