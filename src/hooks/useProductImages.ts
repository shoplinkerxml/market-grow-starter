import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductImage } from '@/components/ProductFormTabs/types';
import { ProductService } from '@/lib/product-service';
import { ImageHelpers } from '@/utils/imageHelpers';
import { getImageUrl } from '@/lib/imageUtils';

export function useProductImages(productId?: string, preloadedImages?: ProductImage[]) {
  const [images, setImages] = useState<ProductImage[]>(preloadedImages || []);
  const [activeIndex, setActiveIndex] = useState(0);
  const imagesRef = useRef<ProductImage[]>(preloadedImages || []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const addImages = useCallback((newImages: ProductImage[]) => {
    setImages(prev => {
      const combined = [...prev, ...newImages];
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
    setImages(resolved as ProductImage[]);
    imagesRef.current = resolved;
  }, [productId]);

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
    if (productId) {
      await ProductService.updateProduct(String(productId), { images: newImages as any });
      await reload();
    }
    if (activeIndex >= newImages.length) {
      setActiveIndex(Math.max(0, newImages.length - 1));
    } else if (activeIndex === index) {
      setActiveIndex(Math.min(index, newImages.length - 1));
    }
  }, [productId, reload, activeIndex]);

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
