import { cache, withCache } from "@/lib/cache-helper";
import * as TemplatesDb from "./db/templates";
import * as AttributesDb from "./db/attributes";
import * as ValuesDb from "./db/values";

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
  return await withCache(key, async () => await AttributesDb.countByTemplateIds(ids));
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
  const attrs = await AttributesDb.getByTemplate(tpl.id);
  const newName = `${tpl.name} (копія)`;
  const newTpl = await TemplatesDb.create({
    category_id: tpl.category_id,
    name: newName,
    description: tpl.description,
    is_active: tpl.is_active,
  });
  if (attrs.length === 0) {
    cache.clearByPrefix("template:");
    return;
  }
  const attrPayload = attrs.map((row) => ({
    template_id: newTpl.id,
    name: row.name,
    paramid: row.paramid ?? null,
    attribute_type: row.attribute_type,
    is_required: row.is_required,
    display_order: row.display_order ?? 0,
    unit: row.unit,
    default_value: row.default_value,
    is_filterable: row.is_filterable,
    is_active: row.is_active,
  }));
  const insertedAttrs = await AttributesDb.bulkCreate(attrPayload);
  const oldIds = attrs.map((row) => Number(row.id)).filter((n) => Number.isFinite(n));
  const values = await ValuesDb.getByAttributes(oldIds);
  if (values.length > 0) {
    const attrMap = new Map<number, number>();
    for (let i = 0; i < attrs.length; i += 1) {
      const oldId = Number(attrs[i]?.id);
      const newId = Number(insertedAttrs[i]?.id);
      if (Number.isFinite(oldId) && Number.isFinite(newId)) attrMap.set(oldId, newId);
    }
    const valuePayload = values
      .map((row) => {
        const mappedId = attrMap.get(Number(row.attribute_id));
        if (!mappedId) return null;
        return {
          attribute_id: mappedId,
          value: row.value,
          valueid: row.valueid ?? null,
          display_value: row.display_value ?? null,
          display_order: row.display_order ?? 0,
          value_lang: row.value_lang ?? null,
          metadata: row.metadata ?? null,
          is_active: row.is_active ?? true,
        };
      })
      .filter(Boolean) as Array<{
      attribute_id: number;
      value: string;
      valueid: string | null;
      display_value: string | null;
      display_order: number;
      value_lang: Record<string, string> | null;
      metadata: Record<string, unknown> | null;
      is_active: boolean;
    }>;
    if (valuePayload.length > 0) {
      await ValuesDb.bulkCreate(valuePayload);
    }
  }
  cache.clearByPrefix("template:");
  void insertedAttrs;
}

export async function getTemplateAttributes(templateId: number) {
  return await withCache(`template:attrs:${Number(templateId)}`, async () => {
    const attrs = await AttributesDb.getByTemplate(templateId);
    if (attrs.length === 0) return [];
    const attrIds = attrs.map((a) => Number(a.id)).filter((n) => Number.isFinite(n));
    const values = await ValuesDb.getByAttributes(attrIds);
    const valuesByAttr = new Map<number, typeof values>();
    for (const v of values) {
      const attrId = Number(v.attribute_id);
      if (!valuesByAttr.has(attrId)) valuesByAttr.set(attrId, []);
      valuesByAttr.get(attrId)?.push(v);
    }
    return attrs.map((attr) => ({
      ...attr,
      values: valuesByAttr.get(Number(attr.id)) || [],
    }));
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
