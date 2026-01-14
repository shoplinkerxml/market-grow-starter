import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

function extractFunctionBlock(source: string, needle: string): string {
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`Function signature not found: ${needle}`);

  const findPrevNonSpace = (idx: number): string => {
    for (let i = idx - 1; i >= 0; i -= 1) {
      const c = source[i];
      if (!/\s/.test(c)) return c;
    }
    return "";
  };

  let openBrace = -1;
  let parenDepth = 0;
  let paramsEnded = false;
  let typeCurlyDepth = 0;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") parenDepth += 1;
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      if (parenDepth === 0) paramsEnded = true;
    }

    if (!paramsEnded) continue;

    if (ch === "{") {
      const prev = findPrevNonSpace(i);
      const looksLikeTypeLiteral =
        prev === "<" || prev === ":" || prev === "," || prev === "|" || prev === "&" || prev === "=";
      if (typeCurlyDepth === 0 && !looksLikeTypeLiteral) {
        openBrace = i;
        break;
      }
      typeCurlyDepth += 1;
      continue;
    }

    if (ch === "}" && typeCurlyDepth > 0) {
      typeCurlyDepth -= 1;
      continue;
    }
  }

  if (openBrace < 0) throw new Error(`Opening brace not found for: ${needle}`);

  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(openBrace, i + 1);
    }
  }

  throw new Error(`Unterminated block for: ${needle}`);
}

function readLib(relFromSrcLib: string): string {
  const libDir = path.resolve(process.cwd(), "src", "lib");
  const abs = path.resolve(libDir, relFromSrcLib);
  return fs.readFileSync(abs, "utf8");
}

vi.mock("@/lib/request-handler", () => ({
  EdgeClient: { invokeWithRetry: vi.fn(), configure: vi.fn(), use: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  SUPABASE_URL: "http://localhost",
  SUPABASE_PUBLISHABLE_KEY: "test-key",
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock("@/lib/persistent-cache-service", () => ({
  PersistentCacheService: {
    invalidateMenu: vi.fn(),
    invalidateShops: vi.fn(),
  },
}));

vi.mock("@/lib/user-auth-service", () => ({
  UserAuthService: { clearAuthMeCache: vi.fn() },
}));

import { EdgeClient } from "@/lib/request-handler";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { ShopCountsService } from "@/lib/shop-counts";
import { UserMenuService } from "@/lib/user-menu-service";
import { ShopCurrenciesService } from "@/lib/shop-currencies";
import { ShopCategoriesService } from "@/lib/shop-categories";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionValidationService } from "@/lib/subscription-validation-service";

describe("Service cache invalidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("invalidates caches on menu create", async () => {
    vi.mocked(EdgeClient.invokeWithRetry).mockImplementation(async (fn: any, body: any) => {
      if (fn !== "user-menu-items") throw new Error("Unexpected edge function");
      if (body?.action === "get_by_path") return { item: null };
      if (body?.action === "list") return { items: [] };
      if (body?.action === "create") return { item: { id: 1 } as any };
      throw new Error("Unexpected action");
    });

    await UserMenuService.createMenuItem("u1", { title: "Test", path: "/test" });

    expect(PersistentCacheService.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
  });

  it("invalidates caches on menu update", async () => {
    vi.mocked(EdgeClient.invokeWithRetry).mockResolvedValue({ item: { id: 1 } } as any);

    await UserMenuService.updateMenuItem(1, "u1", { title: "Test", icon_name: "FileText" });

    expect(PersistentCacheService.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
  });

  it("invalidates caches on menu delete", async () => {
    vi.mocked(EdgeClient.invokeWithRetry).mockResolvedValue({ ok: true } as any);

    await UserMenuService.deleteMenuItem(1, "u1");

    expect(PersistentCacheService.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
  });

  it("invalidates shop-related caches on store currency mutation", async () => {
    vi.spyOn(ShopCurrenciesService as any, "ensureSession").mockResolvedValue(undefined);
    vi.mocked(EdgeClient.invokeWithRetry).mockResolvedValue({ ok: true } as any);

    await ShopCurrenciesService.addStoreCurrency("s1", "USD", 1);

    expect(PersistentCacheService.invalidateShops).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
  });

  it("invalidates shop-related caches on store category mutation", async () => {
    vi.mocked(EdgeClient.invokeWithRetry).mockResolvedValue({ ok: true } as any);

    await ShopCategoriesService.updateStoreCategory({ id: 123, is_active: true });

    expect(PersistentCacheService.invalidateShops).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
  });

  it("clears auth-me + shops persistent caches on ShopCountsService.invalidate", async () => {
    const invalidateQueries = vi.fn();
    const removeQueries = vi.fn();

    ShopCountsService.invalidate(
      { invalidateQueries, removeQueries } as any,
      "u1",
      ["s1", "s2"],
      "test",
    );

    expect(invalidateQueries).toHaveBeenCalled();
    expect(removeQueries).toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(UserAuthService.clearAuthMeCache).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateShops).toHaveBeenCalledTimes(1);
  });

  it("keeps cache invalidation contract for core mutations", () => {
    const productService = readLib("product-service.ts");
    for (const fn of [
      "static async createProduct",
      "static async duplicateProduct",
      "static async updateProduct",
      "static async deleteProduct",
      "static async bulkDeleteProducts",
      "static async saveStoreProductEdit",
      "static async bulkAddStoreProductLinks",
      "static async bulkRemoveStoreProductLinks",
      "static async removeStoreProductLink",
    ]) {
      const body = extractFunctionBlock(productService, fn);
      expect(body).toContain("invalidateRelatedAfterProductMutation");
    }

    const menuService = readLib("user-menu-service.ts");
    for (const fn of [
      "static async createMenuItem",
      "static async updateMenuItem",
      "static async deleteMenuItem",
      "static async reorderMenuItems",
    ]) {
      const body = extractFunctionBlock(menuService, fn);
      expect(body).toContain("invalidateMenuCaches");
    }

    const shopCore = readLib("shop-core.ts");
    for (const fn of ["static async createShop", "static async updateShop", "static async deleteShop"]) {
      const body = extractFunctionBlock(shopCore, fn);
      expect(body).toContain("clearShopsCaches");
    }

    const shopCurrencies = readLib("shop-currencies.ts");
    for (const fn of [
      "static async addStoreCurrency",
      "static async updateStoreCurrencyRate",
      "static async setBaseStoreCurrency",
      "static async deleteStoreCurrency",
    ]) {
      const body = extractFunctionBlock(shopCurrencies, fn);
      expect(body).toContain("clearShopsCaches");
    }

    const shopCategories = readLib("shop-categories.ts");
    for (const fn of ["static async updateStoreCategory", "static async deleteStoreCategoryWithProducts", "static async ensureStoreCategory"]) {
      const body = extractFunctionBlock(shopCategories, fn);
      expect(body).toContain("clearShopsCaches");
    }

    const supplierService = readLib("supplier-service.ts");
    for (const fn of ["static async createSupplier", "static async updateSupplier", "static async deleteSupplier"]) {
      const body = extractFunctionBlock(supplierService, fn);
      expect(body).toContain("invalidateSuppliers");
    }

    const limitService = readLib("limit-service.ts");
    for (const fn of ["static async createLimit", "static async updateLimit", "static async deleteLimit", "static async updateLimitsOrder"]) {
      const body = extractFunctionBlock(limitService, fn);
      expect(body).toContain("invalidateCache");
    }

    const tariffService = readLib("tariff-service.ts");
    for (const fn of [
      "static async createTariff",
      "static async updateTariff",
      "static async deleteTariff",
      "static async addTariffFeature",
      "static async addTariffFeatures",
      "static async updateTariffFeature",
      "static async deleteTariffFeature",
      "static async addTariffLimit",
      "static async addTariffLimits",
      "static async updateTariffLimit",
      "static async deleteTariffLimit",
    ]) {
      const body = extractFunctionBlock(tariffService, fn);
      expect(body).toContain("invalidateTariffsCaches");
    }
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SubscriptionValidationService", () => {
  beforeEach(() => {
    SubscriptionValidationService.clearAllCaches();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("dedupes concurrent subscription state fetches by userId", async () => {
    const d = deferred<{ data: any; error: any }>();

    const selectBuilder: any = {
      select: vi.fn(() => selectBuilder),
      eq: vi.fn(() => selectBuilder),
      order: vi.fn(() => selectBuilder),
      limit: vi.fn(() => selectBuilder),
      maybeSingle: vi.fn(() => d.promise),
    };

    const fromBuilder: any = {
      select: vi.fn((..._args: any[]) => selectBuilder),
      update: vi.fn((_patch: any) => {
        throw new Error("Unexpected update");
      }),
    };

    vi.mocked(supabase.from).mockImplementation((_table: any) => fromBuilder);

    const p1 = SubscriptionValidationService.getSubscriptionState("u1");
    const p2 = SubscriptionValidationService.getSubscriptionState("u1");

    await Promise.resolve();
    expect(selectBuilder.maybeSingle).toHaveBeenCalledTimes(1);

    d.resolve({
      data: {
        id: 1,
        is_active: true,
        start_date: "1970-01-01T00:00:00.000Z",
        end_date: "2999-01-01T00:00:00.000Z",
        tariffs: { is_free: false, visible: true },
      },
      error: null,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.hasValidSubscription).toBe(true);
    expect(r2.hasValidSubscription).toBe(true);
    expect(r1.subscription?.id).toBe(1);
    expect(r2.subscription?.id).toBe(1);
  });

  it("uses cache within TTL and supports forceRefresh", async () => {
    const selectBuilder: any = {
      select: vi.fn(() => selectBuilder),
      eq: vi.fn(() => selectBuilder),
      order: vi.fn(() => selectBuilder),
      limit: vi.fn(() => selectBuilder),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 1,
          is_active: true,
          start_date: "1970-01-01T00:00:00.000Z",
          end_date: "2999-01-01T00:00:00.000Z",
          tariffs: { is_free: false, visible: true },
        },
        error: null,
      })),
    };

    const fromBuilder: any = {
      select: vi.fn((..._args: any[]) => selectBuilder),
      update: vi.fn((_patch: any) => {
        throw new Error("Unexpected update");
      }),
    };

    vi.mocked(supabase.from).mockImplementation((_table: any) => fromBuilder);

    await expect(SubscriptionValidationService.getSubscriptionState("u1")).resolves.toMatchObject({
      hasValidSubscription: true,
    });
    await expect(SubscriptionValidationService.getSubscriptionState("u1")).resolves.toMatchObject({
      hasValidSubscription: true,
    });

    expect(selectBuilder.maybeSingle).toHaveBeenCalledTimes(1);

    await expect(SubscriptionValidationService.getSubscriptionState("u1", { forceRefresh: true })).resolves.toMatchObject({
      hasValidSubscription: true,
    });
    expect(selectBuilder.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("deactivates expired subscription once under concurrency", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000));

    const d = deferred<{ data: any; error: any }>();
    const updateEqCalls: Array<[string, any]> = [];

    const selectBuilder: any = {
      select: vi.fn(() => selectBuilder),
      eq: vi.fn(() => selectBuilder),
      order: vi.fn(() => selectBuilder),
      limit: vi.fn(() => selectBuilder),
      maybeSingle: vi.fn(() => d.promise),
    };

    const updateAfter: any = {
      eq: vi.fn((col: any, val: any) => {
        updateEqCalls.push([String(col), val]);
        return updateAfter;
      }),
      select: vi.fn(async () => ({ data: [{ id: 1 }], error: null })),
    };

    const fromBuilder: any = {
      select: vi.fn((..._args: any[]) => selectBuilder),
      update: vi.fn((_patch: any) => updateAfter),
    };

    vi.mocked(supabase.from).mockImplementation((_table: any) => fromBuilder);

    const p1 = SubscriptionValidationService.getSubscriptionState("u1");
    const p2 = SubscriptionValidationService.getSubscriptionState("u1");

    await Promise.resolve();
    expect(selectBuilder.maybeSingle).toHaveBeenCalledTimes(1);

    d.resolve({
      data: {
        id: 1,
        is_active: true,
        start_date: "1970-01-01T00:00:00.000Z",
        end_date: "1970-01-01T00:00:01.000Z",
        tariffs: { is_free: false, visible: true },
      },
      error: null,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.hasValidSubscription).toBe(false);
    expect(r2.hasValidSubscription).toBe(false);

    expect(updateAfter.select).toHaveBeenCalledTimes(1);
    expect(updateEqCalls).toEqual([
      ["id", 1],
      ["is_active", true],
    ]);
    expect(vi.mocked(UserAuthService.clearAuthMeCache)).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
