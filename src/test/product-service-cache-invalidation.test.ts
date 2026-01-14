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

vi.mock("@/lib/product/product-link-service", () => ({
  ProductLinkService: {
    removeStoreProductLink: vi.fn(),
    bulkRemoveStoreProductLinks: vi.fn(),
    bulkAddStoreProductLinks: vi.fn(),
    getStoreLinksForProduct: vi.fn(),
    invalidateStoreLinksCache: vi.fn(),
  },
}));

vi.mock("@/lib/session-validation", () => ({
  SessionValidator: {
    ensureValidSession: vi.fn(async () => ({
      isValid: true,
      error: null,
      user: { id: "u1" },
    })),
    validateSession: vi.fn(async () => ({
      isValid: true,
      error: null,
      user: { id: "u1" },
    })),
  },
}));

import { ProductService } from "@/lib/product-service";
import { ProductCoreService } from "@/lib/product/product-core-service";
import { ProductLinkService } from "@/lib/product/product-link-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { ShopService } from "@/lib/shop-service";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { invalidateCategoriesCache } from "@/lib/category-service";
import { invokeEdge } from "@/lib/product/product-utils";

describe("ProductService cache invalidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    ProductService.clearAllProductsCaches();
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

  it("invalidates related caches on bulkAddStoreProductLinks", async () => {
    vi.mocked(ProductLinkService.bulkAddStoreProductLinks).mockResolvedValue({
      inserted: 1,
      addedByStore: { s1: 1 },
      categoryNamesByStore: {},
    });
    await ProductService.bulkAddStoreProductLinks([{ product_id: "p1", store_id: "s1" }]);
    expectRelatedInvalidations();
  });

  it("invalidates related caches on bulkRemoveStoreProductLinks", async () => {
    vi.mocked(ProductLinkService.bulkRemoveStoreProductLinks).mockResolvedValue({
      deleted: 1,
      deletedByStore: { s1: 1 },
      categoryNamesByStore: {},
    });
    await ProductService.bulkRemoveStoreProductLinks(["p1"], ["s1"]);
    expectRelatedInvalidations();
  });

  it("invalidates related caches on removeStoreProductLink", async () => {
    vi.mocked(ProductLinkService.removeStoreProductLink).mockResolvedValue(undefined);
    await ProductService.removeStoreProductLink("p1", "s1");
    expectRelatedInvalidations();
  });

  it("returns standardized response for getProducts(options)", async () => {
    (invokeEdge as any).mockResolvedValue({
      products: [
        {
          id: "p1",
          store_id: "s1",
          external_id: "e1",
          name: "n1",
          stock_quantity: 0,
          available: true,
          state: "new",
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
      page: { total: 1, hasMore: false, nextOffset: null },
    });

    const res = await ProductService.getProducts({ storeId: null, limit: 50, offset: 0 });
    expect(res).toMatchObject({ total: 1, hasMore: false });
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items[0]).toMatchObject({ id: "p1" });
  });

  it("caches only first page for getProducts(options)", async () => {
    let calls = 0;
    (invokeEdge as any).mockImplementation(async (_name: string, body: any) => {
      calls += 1;
      const offset = typeof body?.offset === "number" ? body.offset : 0;
      return {
        products: [
          {
            id: `p_${offset}`,
            store_id: "s1",
            external_id: `e_${offset}`,
            name: `n_${offset}`,
            stock_quantity: 0,
            available: true,
            state: "new",
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
          },
        ],
        page: { total: 100, hasMore: true, nextOffset: offset + 10 },
      };
    });

    await ProductService.getProducts({ storeId: null, limit: 10, offset: 0 });
    await ProductService.getProducts({ storeId: null, limit: 10, offset: 0 });
    expect(calls).toBe(1);

    await ProductService.getProducts({ storeId: null, limit: 10, offset: 10 });
    await ProductService.getProducts({ storeId: null, limit: 10, offset: 10 });
    expect(calls).toBe(3);
  });
});
