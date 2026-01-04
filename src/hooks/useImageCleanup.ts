import { useEffect, useRef } from 'react';
import type { ProductImage } from '@/components/ProductFormTabs/types';
import { R2Storage } from '@/lib/r2-storage';
import { ImageHelpers } from '@/utils/imageHelpers';

export function useImageCleanup(isNewProduct: boolean, images: ProductImage[]) {
  const savedRef = useRef(false);
  const cleanedRef = useRef(false);

  const markSaved = () => {
    savedRef.current = true;
  };

  useEffect(() => {
    const cleanup = async () => {
      if (!isNewProduct) return;
      if (savedRef.current) return;
      if (cleanedRef.current) return;
      cleanedRef.current = true;
      for (const img of images) {
        const key = img.object_key || ImageHelpers.extractObjectKeyFromUrl(img.url);
        if (!key) continue;
        try {
          await R2Storage.deleteFileKeepalive(key);
          await R2Storage.removePendingUpload(key);
        } catch {}
      }
    };

    const handleVisibility = () => {
      if (document.hidden) cleanup();
    };
    const handlePageHide = () => cleanup();
    const handleBeforeUnload = () => cleanup();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [isNewProduct, images]);

  return { markSaved };
}
