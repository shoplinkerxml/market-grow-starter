import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/user-auth-service", () => ({
  UserAuthService: { clearAuthMeCache: vi.fn() },
}));

vi.mock("@/lib/shop-service", () => ({
  ShopService: { clearAllCaches: vi.fn() },
}));

vi.mock("@/lib/persistent-cache-service", () => ({
  PersistentCacheService: { invalidateShops: vi.fn() },
}));

vi.mock("@/lib/category-service", () => ({
  invalidateCategoriesCache: vi.fn(),
}));

vi.mock("@/lib/product/product-utils", () => ({
  invokeEdge: vi.fn(),
}));

import { ProductService } from "@/lib/product-service";
import { ProductCoreService } from "@/lib/product/product-core-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { ShopService } from "@/lib/shop-service";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { invalidateCategoriesCache } from "@/lib/category-service";
import { invokeEdge } from "@/lib/product/product-utils";

describe("ProductService cache invalidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const expectRelatedInvalidations = () => {
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
    expect(ShopService.clearAllCaches).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateShops).toHaveBeenCalledTimes(1);
    expect(invalidateCategoriesCache).toHaveBeenCalledTimes(1);
  };

  it("invalidates related caches on createProduct", async () => {
    vi.spyOn(ProductCoreService, "createProduct").mockResolvedValue({ id: "p1" } as any);
    await ProductService.createProduct({} as any);
    expectRelatedInvalidations();
  });

  it("invalidates related caches on updateProduct", async () => {
    vi.spyOn(ProductCoreService, "updateProduct").mockResolvedValue("p1");
    await ProductService.updateProduct("p1", {} as any);
    expectRelatedInvalidations();
  });

  it("invalidates related caches on deleteProduct", async () => {
    vi.spyOn(ProductCoreService, "deleteProduct").mockResolvedValue(undefined);
    await ProductService.deleteProduct("p1");
    expectRelatedInvalidations();
  });

  it("invalidates related caches on bulkDeleteProducts", async () => {
    vi.spyOn(ProductCoreService, "bulkDeleteProducts").mockResolvedValue({ deleted: 2 });
    await ProductService.bulkDeleteProducts(["p1", "p2"]);
    expectRelatedInvalidations();
  });

  it("invalidates related caches on duplicateProduct", async () => {
    vi.spyOn(ProductCoreService, "duplicateProduct").mockResolvedValue({ id: "p2" } as any);
    await ProductService.duplicateProduct("p1");
    expectRelatedInvalidations();
  });

  it("invalidates related caches on saveStoreProductEdit", async () => {
    (invokeEdge as any).mockResolvedValue({ product_id: "p1", link: null });
    await ProductService.saveStoreProductEdit("p1", "s1", { name: "n" });
    expectRelatedInvalidations();
  });
});
