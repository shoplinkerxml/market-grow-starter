import { cache, withCache } from "@/lib/cache-helper";
import * as TemplatesDb from "./db/templates";
import * as AttributesDb from "./db/attributes";
import * as ValuesDb from "./db/values";
import { getTemplateAttributesOptimized } from "./db/attributes-optimized";
import { countByTemplateIdsOptimized } from "./db/attributes-count-optimized";
import { duplicateTemplateOptimized } from "./db/templates-optimized";

export type { CategoryTemplate, TemplateAttribute, AttributeValue } from "./types";

export async function listTemplates() {
  return await withCache("template:list", () => TemplatesDb.getAll());
}

export async function listTemplatesByCategory(categoryId: number) {
  return await withCache(`template:category:${Number(categoryId)}`, () => TemplatesDb.getByCategory(categoryId));
}

export async function listAttributeCounts(templateIds: number[]): Promise<Record<number, number>> {
  const ids = Array.from(new Set((templateIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
  if (ids.length === 0) return {};
  const key = `template:counts:${ids.join(",")}`;
  return await withCache(key, async () => await countByTemplateIdsOptimized(ids));
}

export async function getTemplate(id: number) {
  return await withCache(`template:${Number(id)}`, () => TemplatesDb.getById(id));
}

export async function createTemplate(input: {
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}) {
  const result = await TemplatesDb.create(input);
  cache.clearByPrefix("template:");
  return result;
}

export async function updateTemplate(
  id: number,
  updates: {
    category_id: number;
    name: string;
    description: string | null;
  },
) {
  const result = await TemplatesDb.update(id, updates);
  cache.clearByPrefix("template:");
  return result;
}

export async function deleteTemplate(id: number) {
  await TemplatesDb.remove(id);
  cache.clearByPrefix("template:");
}

export async function toggleTemplate(id: number, isActive: boolean) {
  await TemplatesDb.toggleActive(id, isActive);
  cache.clearByPrefix("template:");
}

export async function applyTemplate(templateId: number, categoryId: number) {
  const result = await TemplatesDb.applyToCategory(templateId, categoryId);
  cache.clearByPrefix("template:");
  return result;
}

export async function getApplyPreview(templateId: number, categoryId: number) {
  return await withCache(
    `template:preview:${Number(templateId)}:${Number(categoryId)}`,
    () => TemplatesDb.getApplyPreview(templateId, categoryId),
  );
}

export async function duplicateTemplate(tpl: { id: number; category_id: number; name: string; description: string | null; is_active: boolean }) {
  await duplicateTemplateOptimized(tpl.id, `${tpl.name} (копія)`);
  cache.clearByPrefix("template:");
}

export async function getTemplateAttributes(templateId: number) {
  return await withCache(`template:attrs:${Number(templateId)}`, async () => {
    return await getTemplateAttributesOptimized(templateId);
  });
}

export async function createAttribute(
  templateId: number,
  input: {
    name: string;
    paramid?: string;
    attribute_type: string;
    is_required: boolean;
    unit?: string;
    default_value?: string;
    is_filterable: boolean;
    is_active: boolean;
  },
  displayOrder?: number,
) {
  const result = await AttributesDb.create(templateId, input, displayOrder);
  cache.clearByPrefix("template:");
  return result;
}

export async function updateAttribute(attrId: number, updates: any) {
  const result = await AttributesDb.update(attrId, updates);
  cache.clearByPrefix("template:");
  return result;
}

export async function deleteAttribute(attrId: number) {
  await AttributesDb.remove(attrId);
  cache.clearByPrefix("template:");
}

export async function reorderAttributes(
  updates: Array<{
    id: number;
    display_order: number;
    template_id: number;
    name: string;
    attribute_type?: string | null;
    is_required?: boolean | null;
    unit?: string | null;
    default_value?: string | null;
    is_filterable?: boolean | null;
    is_active?: boolean | null;
    paramid?: string | null;
  }>,
) {
  await AttributesDb.reorder(updates);
  cache.clearByPrefix("template:");
}

export async function createValue(input: {
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number | null;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
}) {
  const result = await ValuesDb.create(input);
  cache.clearByPrefix("template:");
  return result;
}

export async function duplicateValue(input: {
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
}) {
  const result = await ValuesDb.create(input);
  cache.clearByPrefix("template:");
  return result;
}

export async function bulkCreateValues(
  items: Array<{
    attribute_id: number;
    value: string;
    valueid: string | null;
    display_value: string | null;
    display_order: number;
    value_lang?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
    is_active: boolean;
  }>,
) {
  const result = await ValuesDb.bulkCreate(items);
  cache.clearByPrefix("template:");
  return result;
}

export async function updateValue(
  id: number,
  updates: {
    value?: string;
    valueid?: string | null;
    display_value?: string | null;
    display_order?: number | null;
    value_lang?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
    is_active?: boolean;
  },
) {
  const result = await ValuesDb.update(id, updates);
  cache.clearByPrefix("template:");
  return result;
}

export async function deleteValue(id: number) {
  await ValuesDb.remove(id);
  cache.clearByPrefix("template:");
}

export async function toggleValue(id: number, isActive: boolean) {
  await ValuesDb.toggleActive(id, isActive);
  cache.clearByPrefix("template:");
}

export async function reorderValues(updates: Array<{ id: number; display_order: number }>) {
  await ValuesDb.reorder(updates);
  cache.clearByPrefix("template:");
}
