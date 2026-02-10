import { supabase } from "@/integrations/supabase/client";
import { requireValidSession } from "@/lib/session-validation";
import { ProductService } from "@/lib/product-service";
import { ShopService } from "@/lib/shop-service";
import { SupplierService } from "@/lib/supplier-service";
import { DashboardService } from "@/lib/dashboard-service";
import { cache } from "@/lib/cache-helper";
import { invalidateCategoriesCache } from "@/lib/category-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { R2Storage } from "@/lib/r2-storage";

export type DemoDataCounts = {
  suppliers: number;
  stores: number;
  categories: number;
  products: number;
  templates: number;
  attributes: number;
  params: number;
  images: number;
};

export type DemoDataProductMeta = {
  id: string;
  category_external_id: string | null;
  name: string | null;
};

export type DemoDataResult = {
  status: "ok" | "already_has_data";
  counts?: DemoDataCounts;
  products_meta?: DemoDataProductMeta[];
};

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

const DEMO_IMAGE_URLS: Record<string, string[]> = {
  electronics: [
    "https://images.unsplash.com/photo-jILZG4zBAQ4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-loRyHkB36Jo?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-Fo-HQUlRGkU?auto=format&fit=crop&w=800&q=80",
  ],
  apparel: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  ],
  groceries: [
    "https://images.unsplash.com/photo-o06EnBaHvvE?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-fRD4cRj4PB4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-y7jUXGIVwSI?auto=format&fit=crop&w=800&q=80",
  ],
  appliances: [
    "https://images.unsplash.com/photo-pVD5AIpHNhU?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-J4Poo0r0qEk?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-QS8KEidLzcY?auto=format&fit=crop&w=800&q=80",
  ],
  sports: [
    "https://images.unsplash.com/photo-0zkJ1EsH9dY?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-FSt9r0_SUJ0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-IQ4NmBWvqx0?auto=format&fit=crop&w=800&q=80",
  ],
};

const ELECTRONICS_IMAGE_URLS: Array<{ keywords: string[]; urls: string[] }> = [
  {
    keywords: ["ноутбук", "laptop", "vivobook", "macbook"],
    urls: [
      "https://images.unsplash.com/photo-jILZG4zBAQ4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-loRyHkB36Jo?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-Fo-HQUlRGkU?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["смартфон", "phone", "galaxy", "iphone"],
    urls: [
      "https://images.unsplash.com/photo-m8heo50UKCo?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-bmUa09zy2ZQ?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-Nf5fSqHm-iY?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["планшет", "tablet", "ipad"],
    urls: [
      "https://images.unsplash.com/photo-nz7z0rNdvyI?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-fHDS_mR76bQ?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-4FwEuaWFxgE?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["наушник", "headphones"],
    urls: [
      "https://images.unsplash.com/photo-Q2RIZtBTtaI?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-i1Ex8ENX3rI?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-cJ8YB0InG6k?auto=format&fit=crop&w=800&q=80",
    ],
  },
];

const DEMO_UPLOAD_BATCH_SIZE = 3;

function normalizeProductsMeta(input: unknown): DemoDataProductMeta[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const obj = item as { id?: unknown; category_external_id?: unknown; name?: unknown } | null;
      const id = obj?.id != null ? String(obj.id) : "";
      const category = obj?.category_external_id != null ? String(obj.category_external_id) : "";
      const name = obj?.name != null ? String(obj.name) : "";
      if (!id) return null;
      return {
        id,
        category_external_id: category ? category : null,
        name: name ? name : null,
      } as DemoDataProductMeta;
    })
    .filter((item): item is DemoDataProductMeta => !!item);
}

export class DemoDataService {
  static async loadDemoData(): Promise<DemoDataResult> {
    const validation = await requireValidSession({ requireAccessToken: false });
    const userId = validation.user?.id ? String(validation.user.id) : "";
    if (!userId) {
      throw new Error("user_id_required");
    }
    const { data, error } = await db.rpc("load_demo_data", { p_user_id: userId });
    if (error) throw error;
    const result = (data ?? {}) as DemoDataResult;
    const productsMeta = normalizeProductsMeta((data as { products_meta?: unknown } | null)?.products_meta);
    const existingImages = Number(result.counts?.images || 0);
    if (result.status === "ok" && productsMeta.length > 0 && existingImages === 0) {
      const uploadedCount = await DemoDataService.uploadDemoImages(productsMeta);
      if (result.counts && uploadedCount > 0) {
        result.counts.images = Math.max(Number(result.counts.images || 0), uploadedCount);
      }
    }
    DemoDataService.invalidateCaches();
    return result;
  }

  private static async uploadDemoImages(products: DemoDataProductMeta[]): Promise<number> {
    let uploaded = 0;
    for (let i = 0; i < products.length; i += DEMO_UPLOAD_BATCH_SIZE) {
      const chunk = products.slice(i, i + DEMO_UPLOAD_BATCH_SIZE);
      const counts = await Promise.all(chunk.map((item) => DemoDataService.uploadImagesForProduct(item)));
      uploaded += counts.reduce((sum, value) => sum + value, 0);
    }
    return uploaded;
  }

  private static async uploadImagesForProduct(meta: DemoDataProductMeta): Promise<number> {
    const category = String(meta.category_external_id || "").trim();
    const name = String(meta.name || "").toLowerCase();
    let urls = DEMO_IMAGE_URLS[category] || [];
    if (category === "electronics" && name) {
      for (const entry of ELECTRONICS_IMAGE_URLS) {
        if (entry.keywords.some((k) => name.includes(k))) {
          urls = entry.urls;
          break;
        }
      }
    }
    if (!meta.id || urls.length === 0) return 0;
    let uploaded = 0;
    for (const url of urls) {
      try {
        await R2Storage.uploadProductImageFromUrl(meta.id, url);
        uploaded += 1;
      } catch (error) {
        console.error("[DemoDataService] Image upload failed", {
          productId: meta.id,
          category,
          url,
          error,
        });
      }
    }
    return uploaded;
  }

  private static invalidateCaches(): void {
    try {
      ProductService.clearAllCaches();
    } catch {
      void 0;
    }
    try {
      ShopService.clearAllCaches();
    } catch {
      void 0;
    }
    try {
      SupplierService.clearSuppliersCache();
    } catch {
      void 0;
    }
    try {
      DashboardService.clearCache();
    } catch {
      void 0;
    }
    try {
      cache.clearByPrefix("template:");
    } catch {
      void 0;
    }
    try {
      invalidateCategoriesCache();
    } catch {
      void 0;
    }
    try {
      UserAuthService.clearAuthMeCache();
    } catch {
      void 0;
    }
  }
}
