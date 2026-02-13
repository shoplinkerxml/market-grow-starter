import { R2Storage } from "@/lib/r2-storage";
import type { ProductImage } from "@/lib/product-service";
import { SessionValidator } from "@/lib/session-validation";
import { ApiError } from "@/lib/user-service";
import { EdgeClient } from "@/lib/request-handler";

type ImageInput = ProductImage & { object_key?: string; r2_key_original?: string | null };

export class ProductImageService {
  private static edgeError(
    error: { context?: { status?: number }; status?: number; statusCode?: number; message?: string } | null,
    fallbackKey: string,
  ): never {
    const status = (error?.context?.status ?? error?.status ?? error?.statusCode) as number | undefined;
    const message = (error?.message as string | undefined) || undefined;
    if (status === 403) throw new ApiError("permission_denied", 403, "PERMISSION_DENIED");
    if (status === 400) throw new ApiError("products_limit_reached", 400, "LIMIT_REACHED");
    if (status === 422) throw new ApiError("validation_error", 422, "VALIDATION_ERROR");
    throw new ApiError(message || fallbackKey, status || 500);
  }

  private static async invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
    try {
      return await EdgeClient.invokeWithRetry<T>(name, body);
    } catch (error) {
      ProductImageService.edgeError(error as any, name);
      throw new ApiError(name, 500);
    }
  }

  private static async ensureValidSession(): Promise<void> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }
  }

  static mapImagesForEdge(images: Array<ImageInput>): Array<{ key?: string; url: string; order_index: number; is_main: boolean }> {
    return (images || []).map((img, index) => {
      const input = img as ImageInput;
      return {
        key: input.object_key || undefined,
        url: input.url,
        order_index: typeof input.order_index === "number" ? input.order_index : index,
        is_main: !!input.is_main,
      };
    });
  }

  static async getProductImages(productId: string): Promise<ProductImage[]> {
    await ProductImageService.ensureValidSession();

    const payload = await ProductImageService.invokeEdge<{ images?: Array<ProductImage & { r2_key_original?: string | null }> }>(
      "product-edit-data",
      { product_id: String(productId) },
    );
    const images = Array.isArray(payload?.images) ? payload.images : [];
    return images
      .map((img, idx) => {
        const urlRaw = String((img as any)?.url || "").trim();
        const r2 = (img as any)?.r2_key_original;
        let resolvedUrl = "";
        if (urlRaw) {
          resolvedUrl = urlRaw;
          try {
            const u = new URL(urlRaw);
            const host = String(u.host || "");
            if (host.includes("r2.dev") || host.includes("cloudflarestorage.com")) {
              const extracted = R2Storage.extractObjectKeyFromUrl(urlRaw);
              if (extracted) resolvedUrl = R2Storage.makePublicUrl(extracted);
            }
          } catch {}
        } else if (r2) {
          resolvedUrl = R2Storage.makePublicUrl(String(r2));
        }
        return {
          id: (img as any)?.id != null ? String((img as any).id) : undefined,
          product_id: String(productId),
          url: resolvedUrl,
          order_index: (img as any)?.order_index != null ? Number((img as any).order_index) : idx,
          is_main: !!(img as any)?.is_main,
        } as ProductImage;
      })
      .filter((img) => img.url.trim() !== "");
  }

  static async uploadMissingObjectKeysFromUrls(
    productId: string,
    images: Array<ImageInput>,
  ): Promise<{ processed: Array<ImageInput>; changed: boolean }> {
    const origImages = (images || []).map((img, index) => {
      const input = img as ImageInput;
      return {
        object_key: input.object_key || undefined,
        url: input.url,
        order_index: typeof input.order_index === "number" ? input.order_index : index,
        is_main: !!input.is_main,
      };
    });

    const processed = await Promise.all(
      origImages.map(async (i) => {
        const key = i.object_key || undefined;
        const u = String(i.url || "").trim();
        if (key) return { object_key: key, url: u, order_index: i.order_index, is_main: i.is_main };
        if (!u) return { object_key: undefined, url: u, order_index: i.order_index, is_main: i.is_main };
        if (/^(https?:\/\/|data:)/i.test(u)) {
          try {
            const res = await R2Storage.uploadProductImageFromUrl(String(productId), u);
            const nextKey = res.r2KeyOriginal || undefined;
            const nextUrl = res.originalUrl || u;
            return { object_key: nextKey, url: nextUrl, order_index: i.order_index, is_main: i.is_main };
          } catch {
            return { object_key: undefined, url: u, order_index: i.order_index, is_main: i.is_main };
          }
        }
        return { object_key: undefined, url: u, order_index: i.order_index, is_main: i.is_main };
      }),
    );

    const changed = processed.some((p, idx) => !!p.object_key && !origImages[idx]?.object_key);
    return { processed, changed };
  }

  /**
   * Extracts R2 object key from an image record (from object_key, r2_key_original, or URL).
   */
  private static extractR2Key(img: ImageInput): string | null {
    if (img.object_key) return img.object_key;
    if (img.r2_key_original) return img.r2_key_original;
    const url = String(img.url || "").trim();
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = String(u.host || "");
      if (host.includes("r2.dev") || host.includes("cloudflarestorage.com")) {
        return R2Storage.extractObjectKeyFromUrl(url);
      }
    } catch {}
    return null;
  }

  /**
   * Deletes R2 objects that were removed during product update.
   * Compares old images (from DB) with new images being saved,
   * and deletes any R2 keys that are no longer referenced.
   */
  static async cleanupRemovedImages(
    productId: string,
    newImages: Array<ImageInput>,
  ): Promise<void> {
    try {
      // Get current images from DB
      const oldImages = await ProductImageService.getProductImages(productId);

      // Collect R2 keys from new images
      const newKeys = new Set<string>();
      for (const img of newImages || []) {
        const key = ProductImageService.extractR2Key(img as ImageInput);
        if (key) newKeys.add(key);
      }

      // Find R2 keys in old images that are not in new images
      const keysToDelete: string[] = [];
      for (const img of oldImages) {
        const key = ProductImageService.extractR2Key(img as ImageInput);
        if (key && !newKeys.has(key)) {
          keysToDelete.push(key);
        }
      }

      // Delete orphaned R2 objects
      if (keysToDelete.length > 0) {
        await Promise.all(
          keysToDelete.map(async (key) => {
            try {
              await R2Storage.deleteFile(key);
            } catch (e) {
              console.warn("Failed to delete R2 key:", key, e);
            }
          }),
        );
      }
    } catch (e) {
      console.error("ProductImageService.cleanupRemovedImages failed", e);
    }
  }

  /**
   * Deletes all R2 images for a product (used when deleting the product).
   */
  static async deleteAllProductImages(productId: string): Promise<void> {
    try {
      const images = await ProductImageService.getProductImages(productId);
      const keysToDelete: string[] = [];
      for (const img of images) {
        const key = ProductImageService.extractR2Key(img as ImageInput);
        if (key) keysToDelete.push(key);
      }
      if (keysToDelete.length > 0) {
        await Promise.all(
          keysToDelete.map(async (key) => {
            try {
              await R2Storage.deleteFile(key);
            } catch (e) {
              console.warn("Failed to delete R2 key on product delete:", key, e);
            }
          }),
        );
      }
    } catch (e) {
      console.error("ProductImageService.deleteAllProductImages failed", e);
    }
  }
}
