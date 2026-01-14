import { describe, expect, it } from "vitest";
import { isCategoryBase, isCategoryFull } from "@/lib/category-service";

describe("category-service guards", () => {
  it("accepts base category without id and supplier_id", () => {
    const v = { external_id: "ext-1", name: "Name", parent_external_id: null };
    expect(isCategoryBase(v)).toBe(true);
    expect(isCategoryFull(v)).toBe(false);
  });

  it("accepts full category with id and supplier_id", () => {
    const v = { id: 1, supplier_id: 2, external_id: "ext-1", name: "Name", parent_external_id: null };
    expect(isCategoryBase(v)).toBe(true);
    expect(isCategoryFull(v)).toBe(true);
  });

  it("rejects base category with empty external_id", () => {
    const v = { external_id: "   ", name: "Name", parent_external_id: null };
    expect(isCategoryBase(v)).toBe(false);
  });

  it("rejects base category without parent_external_id", () => {
    const v = { external_id: "ext-1", name: "Name" };
    expect(isCategoryBase(v)).toBe(false);
  });
});

