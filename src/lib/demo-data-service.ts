import { supabase } from "@/integrations/supabase/client";
import { requireValidSession } from "@/lib/session-validation";
import { ProductService } from "@/lib/product-service";
import { ShopService } from "@/lib/shop-service";
import { SupplierService } from "@/lib/supplier-service";
import { DashboardService } from "@/lib/dashboard-service";
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
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  ],
  apparel: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  ],
  groceries: [
    "https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80",
  ],
  appliances: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1580915411954-282cb1b0d780?auto=format&fit=crop&w=800&q=80",
  ],
  sports: [
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
  ],
};

const ELECTRONICS_IMAGE_URLS: Array<{ keywords: string[]; urls: string[] }> = [
  {
    keywords: ["ноутбук", "laptop", "vivobook", "macbook"],
    urls: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["смартфон", "phone", "galaxy", "iphone"],
    urls: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["планшет", "tablet", "ipad"],
    urls: [
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["наушник", "headphones"],
    urls: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["монитор", "monitor"],
    urls: [
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["смарт-часы", "смарт часы", "smartwatch", "watch"],
    urls: [
      "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["книга", "ebook", "e-book", "e book", "e-reader"],
    urls: [
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["маршрутизатор", "router"],
    urls: [
      "https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1603791452906-bf4d3d22ad6d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1628539028340-61d2c37c98ab?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["повербанк", "power bank", "powerbank"],
    urls: [
      "https://images.unsplash.com/photo-1587825140708-4f0e0d7e8c4b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1593642532973-d31b6557fa68?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    keywords: ["клавиатура", "keyboard"],
    urls: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
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
