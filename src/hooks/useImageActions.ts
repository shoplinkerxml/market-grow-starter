import { useCallback } from 'react';
import type React from 'react';
import type { ProductImage } from '@/components/ProductFormTabs/types';
import { R2Storage } from '@/lib/r2-storage';
import { ImageHelpers } from '@/utils/imageHelpers';
import { toast } from 'sonner';

type Uploaded = { url: string; object_key?: string };

export function useImageActions(
  productId: string | undefined,
  images: ProductImage[],
  addImages: (imgs: ProductImage[]) => void,
  reload: () => Promise<void>,
  uploadFromUrl: (url: string) => Promise<Uploaded>,
  uploadFile: (file: File) => Promise<Uploaded>,
  uploadFiles: ((files: File[]) => Promise<Array<PromiseSettledResult<Uploaded>>>) | undefined,
  removeImage: (index: number) => Promise<void>,
  setMainImage: (index: number) => Promise<void>,
  reorderImages: (list: ProductImage[]) => Promise<void>,
) {
  const addImageFromUrl = useCallback(async (imageUrl: string): Promise<{ ok: boolean; errorCode?: string }> => {
    const url = imageUrl?.trim();
    if (!url) return { ok: false, errorCode: 'empty_url' };
    try {
      const res = await uploadFromUrl(url);
      const newImage: ProductImage = {
        url: res.url,
        order_index: images.length,
        is_main: images.length === 0,
        object_key: res.object_key,
      };
      addImages([newImage]);
      await reload();
      return { ok: true };
    } catch (e: any) {
      const code = e?.code as string | undefined;
      return { ok: false, errorCode: code || 'unknown' };
    }
  }, [images, addImages, reload, uploadFromUrl]);

  const uploadFileDirect = useCallback(async (file: File): Promise<{ ok: boolean; errorCode?: string }> => {
    if (!file) return { ok: false, errorCode: 'no_file' };
    try {
      const res = await uploadFile(file);
      const newImage: ProductImage = {
        url: res.url,
        order_index: images.length,
        is_main: images.length === 0,
        object_key: res.object_key,
      };
      addImages([newImage]);
      await reload();
      return { ok: true };
    } catch (e: any) {
      const code = e?.code as string | undefined;
      return { ok: false, errorCode: code || 'unknown' };
    }
  }, [images, addImages, reload, uploadFile]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<{ ok: boolean; errorCode?: string; uploadedCount?: number; failedCount?: number }> => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    event.target.value = '';
    if (files.length === 0) return { ok: false, errorCode: 'no_file' };

    try {
      const baseIndex = images.length;
      const settled = uploadFiles ? await uploadFiles(files) : await Promise.allSettled(files.map((f) => uploadFile(f)));
      const fulfilled: Uploaded[] = settled
        .filter((r): r is PromiseFulfilledResult<Uploaded> => r.status === 'fulfilled')
        .map((r) => r.value);
      const failedCount = settled.length - fulfilled.length;
      if (fulfilled.length > 0) {
        const newImages: ProductImage[] = fulfilled.map((u, i) => ({
          url: u.url,
          order_index: baseIndex + i,
          is_main: baseIndex === 0 && i === 0,
          object_key: u.object_key,
        }));
        addImages(newImages);
        await reload();
      }
      if (fulfilled.length === 0) return { ok: false, errorCode: 'failed_upload', uploadedCount: 0, failedCount };
      return { ok: failedCount === 0, errorCode: failedCount ? 'failed_upload' : undefined, uploadedCount: fulfilled.length, failedCount };
    } catch (e: any) {
      const code = e?.code as string | undefined;
      return { ok: false, errorCode: code || 'unknown' };
    }
  }, [addImages, images.length, reload, uploadFile, uploadFiles]);

  const removeImageWithR2 = useCallback(async (index: number): Promise<{ ok: boolean; errorCode?: string }> => {
    const target = images[index];
    try {
      await removeImage(index);
    } catch (error) {
      console.error(error);
      toast.error('Не удалось удалить изображение');
      return { ok: false, errorCode: 'failed_delete' };
    }

    toast.success('Изображение удалено');

    const objectKey = target?.object_key || (target?.url ? ImageHelpers.extractObjectKeyFromUrl(target.url) : null);
    if (objectKey) {
      (async () => {
        try {
          await R2Storage.deleteFile(objectKey);
          await R2Storage.removePendingUpload(objectKey);
        } catch {
          toast.error('Не удалось удалить файл изображения из хранилища');
        }
      })();
    }

    return { ok: true };
  }, [images, removeImage]);

  const setMain = useCallback(async (index: number): Promise<{ ok: boolean }> => {
    await setMainImage(index);
    toast.success('Главное изображение обновлено');
    return { ok: true };
  }, [setMainImage]);

  const reorder = useCallback(async (list: ProductImage[]): Promise<{ ok: boolean }> => {
    await reorderImages(list);
    return { ok: true };
  }, [reorderImages]);

  return {
    addImageFromUrl,
    uploadFileDirect,
    handleFileUpload,
    removeImageWithR2,
    setMain,
    reorder,
  };
}
