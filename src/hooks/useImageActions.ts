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
      const objectKey = target?.object_key || (target?.url ? ImageHelpers.extractObjectKeyFromUrl(target.url) : null);
      if (objectKey) {
        const deleteOnce = async () => {
          const res = await R2Storage.deleteFile(objectKey);
          if (!res?.success) {
            const err = new Error("r2_delete_failed");
            (err as any).code = "r2_delete_failed";
            throw err;
          }
        };

        const getErrorStatus = (e: any): number | undefined =>
          (e?.context?.status ?? e?.status ?? e?.statusCode) as number | undefined;

        const isNotFoundError = (e: any): boolean => {
          const status = getErrorStatus(e);
          const code = (e as any)?.code as string | undefined;
          const msg = String((e as any)?.message || "");
          return (
            status === 404 ||
            code === "not_found" ||
            code === "object_not_found" ||
            code === "no_such_key" ||
            /not[\s_-]*found/i.test(msg) ||
            /no[\s_-]*such/i.test(msg)
          );
        };

        const isRetryableError = (e: any): boolean => {
          const status = getErrorStatus(e);
          if (status == null) return true;
          if (status === 429) return true;
          if (status >= 500 && status <= 599) return true;
          return false;
        };

        const deleteWithRetry = async () => {
          const delays = [250, 750];
          for (let attempt = 0; attempt < delays.length + 1; attempt++) {
            try {
              await deleteOnce();
              return;
            } catch (e: any) {
              if (isNotFoundError(e)) return;
              if (attempt >= delays.length || !isRetryableError(e)) throw e;
              await new Promise((r) => setTimeout(r, delays[attempt]));
            }
          }
        };

        await deleteWithRetry();
        try {
          await R2Storage.removePendingUpload(objectKey);
        } catch {
          void 0;
        }
      }
      let removed = false;
      try {
        await removeImage(index);
        removed = true;
      } finally {
        if (!removed) {
          try {
            await reload();
          } catch {
            void 0;
          }
        }
      }
      toast.success('Изображение удалено');
    } catch (error) {
      console.error(error);
      toast.error('Не удалось удалить изображение');
      return { ok: false, errorCode: 'failed_delete' };
    }

    return { ok: true };
  }, [images, reload, removeImage]);

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
