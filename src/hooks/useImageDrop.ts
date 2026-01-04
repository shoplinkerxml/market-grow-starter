import { useCallback, useState } from 'react';
import { ImageHelpers } from '@/utils/imageHelpers';
import type { ProductImage } from '@/components/ProductFormTabs/types';

export function useImageDrop(options: {
  productId?: string;
  addImages: (imgs: ProductImage[]) => void;
  uploadFile: (file: File) => Promise<{ url: string; object_key?: string }>;
  uploadFromUrl: (url: string) => Promise<{ url: string; object_key?: string }>;
  reload?: () => Promise<void>;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const onDrop = useCallback(async (e: React.DragEvent, currentCount: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedUrl = await ImageHelpers.extractFromDragEvent(e);
    if (!droppedUrl) return;
    if (!ImageHelpers.isImageUrl(droppedUrl)) {
      try {
        const resp = await fetch(droppedUrl);
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const mime = resp.headers.get('content-type') || 'image/webp';
        const file = new File([bytes], `dropped.${mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : 'webp'}`, { type: mime });
        const res = await options.uploadFile(file);
        options.addImages([{ url: res.url, order_index: currentCount, is_main: currentCount === 0, object_key: res.object_key }]);
        if (options.reload) await options.reload();
        return;
      } catch {
        options.addImages([{ url: droppedUrl, order_index: currentCount, is_main: currentCount === 0 }]);
        return;
      }
    }
    try {
      const res = await options.uploadFromUrl(droppedUrl);
      options.addImages([{ url: res.url, order_index: currentCount, is_main: currentCount === 0, object_key: res.object_key }]);
      if (options.reload) await options.reload();
    } catch {
      options.addImages([{ url: droppedUrl, order_index: currentCount, is_main: currentCount === 0 }]);
    }
  }, [options]);

  return { isDragOver, setIsDragOver, onDragEnter, onDragOver, onDragLeave, onDrop };
}
