import { describe, expect, it } from "vitest";
import { normalizeCategoryName, sanitizeCategoryInputs, simulateDedup } from "../../supabase/functions/_shared/category-dedup";

describe("category dedup helpers", () => {
  it("normalizes names case-insensitively and trims", () => {
    expect(normalizeCategoryName("  Fruit ")).toBe("fruit");
    expect(normalizeCategoryName("Фрукты")).toBe("фрукты");
    expect(normalizeCategoryName("  ")).toBe(null);
  });

  it("sanitizes inputs and skips invalid rows", () => {
    const { cleaned, skipped } = sanitizeCategoryInputs([
      { supplier_id: 1, external_id: "ext-1", name: "A", parent_external_id: null },
      { supplier_id: "x", external_id: "ext-2", name: "B", parent_external_id: null },
      { supplier_id: 2, external_id: "  ", name: "C", parent_external_id: null },
      { supplier_id: 3, external_id: "ext-3", name: "  ", parent_external_id: null },
    ]);
    expect(cleaned.length).toBe(1);
    expect(cleaned[0]).toMatchObject({ supplier_id: 1, external_id: "ext-1", name: "A" });
    expect(skipped).toBe(3);
  });

  it("computes dedup counts across existing names and input", () => {
    const report = simulateDedup(["Books", "Toys"], [
      { supplier_id: 1, external_id: "e1", name: "Books", parent_external_id: null },
      { supplier_id: 2, external_id: "e2", name: "Toys", parent_external_id: null },
      { supplier_id: 3, external_id: "e3", name: "books", parent_external_id: null },
      { supplier_id: 4, external_id: "e4", name: "Games", parent_external_id: null },
      { supplier_id: 5, external_id: "e5", name: "Games", parent_external_id: null },
    ]);
    expect(report.total_input).toBe(5);
    expect(report.valid_input).toBe(5);
    expect(report.inserted).toBe(1);
    expect(report.duplicates).toBe(4);
  });
});
