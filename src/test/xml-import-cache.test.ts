import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("@/lib/product/product-cache-manager", () => ({
  ProductCacheManager: { clearAllProductsCaches: vi.fn() },
}));
vi.mock("@/lib/persistent-cache-service", () => ({
  PersistentCacheService: {
    invalidateShops: vi.fn(),
    invalidateSuppliers: vi.fn(),
    invalidateAuthMe: vi.fn(),
  },
}));
vi.mock("@/lib/shop-counts", () => ({
  ShopCountsService: {
    suppressAllRealtimeForUser: vi.fn(),
    isRealtimeSuppressedForUser: vi.fn(() => false),
    invalidate: vi.fn(),
  },
}));

import { handleImportRunFinish } from "@/lib/xml-import-cache";
import { ShopCountsService } from "@/lib/shop-counts";
import { ProductCacheManager } from "@/lib/product/product-cache-manager";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import type { SupplierImportRun } from "@/lib/xml-import-service";

function makeRun(overrides: Partial<SupplierImportRun> = {}): SupplierImportRun {
  return {
    id: overrides.id ?? "run-" + Math.random().toString(16).slice(2),
    user_id: "u1",
    supplier_id: 42,
    trigger: "manual",
    status: "succeeded",
    xml_url: null,
    total_rows: 10,
    processed_rows: 10,
    created_count: 3,
    updated_count: 2,
    skipped_count: 0,
    failed_count: 0,
    error: null,
    started_at: null,
    finished_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("handleImportRunFinish", () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient();
  });

  it("does nothing for non-terminal statuses", () => {
    handleImportRunFinish(qc, "u1", makeRun({ status: "running" }));
    expect(ShopCountsService.suppressAllRealtimeForUser).not.toHaveBeenCalled();
    expect(ProductCacheManager.clearAllProductsCaches).not.toHaveBeenCalled();
  });

  it("does nothing for null run", () => {
    handleImportRunFinish(qc, "u1", null);
    expect(ShopCountsService.suppressAllRealtimeForUser).not.toHaveBeenCalled();
  });

  it("skips no-op runs (not-modified)", () => {
    handleImportRunFinish(qc, "u1", makeRun({ error: "not-modified", created_count: 0, updated_count: 0, failed_count: 0 }));
    expect(ProductCacheManager.clearAllProductsCaches).not.toHaveBeenCalled();
  });

  it("skips runs with no created/updated/failed counters", () => {
    handleImportRunFinish(qc, "u1", makeRun({ created_count: 0, updated_count: 0, failed_count: 0 }));
    expect(ProductCacheManager.clearAllProductsCaches).not.toHaveBeenCalled();
  });

  it("invalidates caches on terminal run with changes", () => {
    const run = makeRun({ id: "run-a", status: "succeeded" });
    handleImportRunFinish(qc, "u1", run);
    expect(ShopCountsService.suppressAllRealtimeForUser).toHaveBeenCalledWith("u1", 3000);
    expect(ProductCacheManager.clearAllProductsCaches).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateShops).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateSuppliers).toHaveBeenCalledTimes(1);
    expect(PersistentCacheService.invalidateAuthMe).toHaveBeenCalledTimes(1);
    expect(ShopCountsService.invalidate).toHaveBeenCalledTimes(1);
  });

  it("is idempotent for the same run+status", () => {
    const run = makeRun({ id: "run-b" });
    handleImportRunFinish(qc, "u1", run);
    handleImportRunFinish(qc, "u1", run);
    handleImportRunFinish(qc, "u1", run);
    expect(ProductCacheManager.clearAllProductsCaches).toHaveBeenCalledTimes(1);
  });

  it("also fires for failed runs with partial writes", () => {
    handleImportRunFinish(qc, "u1", makeRun({ id: "run-c", status: "failed", created_count: 0, updated_count: 1, failed_count: 5 }));
    expect(ProductCacheManager.clearAllProductsCaches).toHaveBeenCalledTimes(1);
  });

  it("falls back to 'current' when userId missing", () => {
    handleImportRunFinish(qc, null, makeRun({ id: "run-d" }));
    expect(ShopCountsService.suppressAllRealtimeForUser).toHaveBeenCalledWith("current", 3000);
  });
});
