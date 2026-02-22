import { describe, expect, it } from "vitest";
import {
  applyExternalRefsToDesiredMap,
  diffStoreCategoryRows,
  extractCategoryRefsFromLinks,
  normalizeExternalId,
} from "../../supabase/functions/_shared/store-category-sync";

describe("store-category sync unit", () => {
  it("extracts category ids into desired map", () => {
    const { desiredByStore, externalRefs } = extractCategoryRefsFromLinks([
      { store_id: "s1", store_products: { category_id: 10 } },
    ]);
    expect(Array.from(desiredByStore.get("s1") || [])).toEqual([10]);
    expect(externalRefs.length).toBe(0);
  });

  it("extracts external refs from custom category ids", () => {
    const { desiredByStore, externalRefs, externalIdList } = extractCategoryRefsFromLinks([
      { store_id: "s1", custom_category_id: " Ext-1 ", store_products: { supplier_id: 5 } },
    ]);
    expect(desiredByStore.size).toBe(0);
    expect(externalRefs).toEqual([
      { storeId: "s1", externalId: "ext-1", supplierId: 5 },
    ]);
    expect(externalIdList).toEqual(["Ext-1"]);
  });

  it("extracts external refs from base category external id", () => {
    const { desiredByStore, externalRefs, externalIdList } = extractCategoryRefsFromLinks([
      { store_id: "s1", store_products: { category_external_id: " Cat-1 ", supplier_id: 7 } },
    ]);
    expect(desiredByStore.size).toBe(0);
    expect(externalRefs).toEqual([
      { storeId: "s1", externalId: "cat-1", supplierId: 7 },
    ]);
    expect(externalIdList).toEqual(["Cat-1"]);
  });

  it("applies external refs using store-specific categories", () => {
    const desiredByStore = new Map<string, Set<number>>();
    const externalRefs = [{ storeId: "s1", externalId: "ext-1", supplierId: 9 }];
    const categories = [
      { id: 11, external_id: "ext-1", store_id: "s1", supplier_id: 9 },
      { id: 12, external_id: "ext-1", supplier_id: 9 },
    ];
    applyExternalRefsToDesiredMap(desiredByStore, externalRefs, categories);
    expect(Array.from(desiredByStore.get("s1") || [])).toEqual([11]);
  });

  it("normalizes external ids", () => {
    expect(normalizeExternalId("  AbC  ")).toBe("abc");
    expect(normalizeExternalId("")).toBe(null);
  });
});

describe("store-category sync integration", () => {
  it("adds missing categories and removes unused ones", () => {
    const links = [
      {
        store_id: "s1",
        custom_category_id: "A-1",
        store_products: { supplier_id: 2 },
      },
    ];
    const { desiredByStore, externalRefs, externalIdList } = extractCategoryRefsFromLinks(links);
    const categories = [
      { id: 11, external_id: "a-1", store_id: "s1", supplier_id: 2 },
    ];
    applyExternalRefsToDesiredMap(desiredByStore, externalRefs, categories);

    const existingRows = [
      { id: 201, store_id: "s1", category_id: 99 },
    ];

    const { toInsert, toDeleteIds } = diffStoreCategoryRows(desiredByStore, existingRows);
    expect(toInsert).toEqual([{ store_id: "s1", category_id: 11 }]);
    expect(toDeleteIds).toEqual([201]);
    expect(externalIdList).toEqual(["A-1"]);
  });

  it("diffs categories per store without cross-delete", () => {
    const desiredByStore = new Map<string, Set<number>>([
      ["s1", new Set([1, 2])],
      ["s2", new Set([3])],
    ]);
    const existingRows = [
      { id: 1, store_id: "s1", category_id: 1 },
      { id: 2, store_id: "s1", category_id: 99 },
      { id: 3, store_id: "s2", category_id: 3 },
      { id: 4, store_id: "s2", category_id: 4 },
    ];
    const { toInsert, toDeleteIds } = diffStoreCategoryRows(desiredByStore, existingRows);
    expect(toInsert).toEqual([{ store_id: "s1", category_id: 2 }]);
    expect(toDeleteIds.sort()).toEqual([2, 4]);
  });

  it("removes all categories when store has no active links", () => {
    const { desiredByStore } = extractCategoryRefsFromLinks([]);
    const existingRows = [
      { id: 101, store_id: "s1", category_id: 10 },
      { id: 102, store_id: "s1", category_id: 11 },
    ];
    const { toInsert, toDeleteIds } = diffStoreCategoryRows(desiredByStore, existingRows);
    expect(toInsert).toEqual([]);
    expect(toDeleteIds.sort()).toEqual([101, 102]);
  });
});
