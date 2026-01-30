import { supabase } from '@/integrations/supabase/client';
import { SessionValidator } from './session-validation';

/**
 * Получить токен аутентификации из текущей сессии
 * Включает валидацию через SessionValidator для совместимости с существующим кодом
 * @throws {Error} Если токен недоступен или сессия невалидна
 */
export async function getAuthToken(): Promise<string> {
  // КРИТИЧНО: Валидация сессии через SessionValidator (как в оригинальном коде)
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    // Обрабатываем error любого типа
    let errorMsg = 'Session validation failed';
    try {
      const err = validation.error;
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMsg = String((err as { message: string }).message);
      }
    } catch {
      // Если не удалось получить сообщение, используем дефолтное
    }
    throw new Error(`Invalid session: ${errorMsg}`);
  }
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error(`Session error: ${error.message}`);
  }
  
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }
  
  return session.access_token;
}

/**
 * Получить заголовки для авторизованных запросов
 * Совместимо с оригинальным getAuthHeaders из template-service.ts
 * @throws {Error} Если токен недоступен
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Проверить валидность текущей сессии
 * Использует SessionValidator для консистентности
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const validation = await SessionValidator.ensureValidSession();
    return validation.isValid;
  } catch {
    return false;
  }
}

const CATEGORY_TEMPLATES_TABLE = "category_templates";
const TEMPLATE_ATTRIBUTES_TABLE = "template_attributes";
const ATTRIBUTE_VALUES_TABLE = "attribute_values";
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

async function ensureValidSessionOrThrow(): Promise<void> {
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    const msg = typeof validation.error === "string" && validation.error.trim() ? validation.error : "Unauthorized";
    throw Object.assign(new Error(msg), { status: 401 });
  }
}

function toDbError(error: unknown, fallback: string): Error {
  if (!error) return new Error(fallback);
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  return Object.assign(new Error(e?.message || fallback), { code: e?.code, details: e?.details, hint: e?.hint });
}

export type CategoryTemplate = {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type TemplateAttribute = {
  id: number;
  template_id: number;
  name: string;
  paramid: string | null;
  attribute_type: string;
  is_required: boolean;
  unit: string | null;
  default_value: string | null;
  is_filterable: boolean;
  is_active: boolean;
  display_order: number | null;
};

export type AttributeValue = {
  id: number;
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number | null;
  is_active: boolean;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
};

type CategoryTemplateDbRow = CategoryTemplate & {
  created_at?: string | null;
  updated_at?: string | null;
};

type TemplateAttributeDbRow = TemplateAttribute & {
  validation_rules?: Record<string, unknown> | null;
  help_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AttributeValueDbRow = AttributeValue & {
  created_at?: string | null;
};

async function listTemplatesDb(): Promise<CategoryTemplate[]> {
  await ensureValidSessionOrThrow();
  const { data, error } = await db.from(CATEGORY_TEMPLATES_TABLE).select("*").order("id", { ascending: true });
  if (error) throw toDbError(error, "Failed to load templates");
  return (Array.isArray(data) ? data : []) as CategoryTemplate[];
}

async function listTemplatesByCategoryDb(categoryId: number): Promise<CategoryTemplate[]> {
  await ensureValidSessionOrThrow();
  const { data, error } = await db
    .from(CATEGORY_TEMPLATES_TABLE)
    .select("*")
    .eq("category_id", categoryId)
    .order("id", { ascending: true });
  if (error) throw toDbError(error, "Failed to load templates");
  return (Array.isArray(data) ? data : []) as CategoryTemplate[];
}

async function getTemplateByIdDb(id: number): Promise<CategoryTemplate> {
  await ensureValidSessionOrThrow();
  const { data, error } = await db.from(CATEGORY_TEMPLATES_TABLE).select("*").eq("id", id).single();
  if (error) throw toDbError(error, "Failed to load template");
  if (!data) throw new Error("Template not found");
  return data as CategoryTemplate;
}

async function createTemplateDb(data: { category_id: number; name: string; description: string | null; is_active: boolean }): Promise<CategoryTemplate> {
  await ensureValidSessionOrThrow();
  const { data: row, error } = await db
    .from(CATEGORY_TEMPLATES_TABLE)
    .insert(data)
    .select("*")
    .single();
  if (error) throw toDbError(error, "Failed to create template");
  return row as CategoryTemplate;
}

async function updateTemplateDb(
  id: number,
  updates: { category_id: number; name: string; description: string | null },
): Promise<CategoryTemplate> {
  await ensureValidSessionOrThrow();
  const { data, error } = await db
    .from(CATEGORY_TEMPLATES_TABLE)
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toDbError(error, "Failed to update template");
  return data as CategoryTemplate;
}

async function deleteTemplateDb(id: number): Promise<void> {
  await ensureValidSessionOrThrow();
  const { error } = await db.from(CATEGORY_TEMPLATES_TABLE).delete().eq("id", id);
  if (error) throw toDbError(error, "Failed to delete template");
}

async function toggleTemplateActiveDb(id: number, isActive: boolean): Promise<void> {
  await ensureValidSessionOrThrow();
  const { error } = await db.from(CATEGORY_TEMPLATES_TABLE).update({ is_active: isActive }).eq("id", id);
  if (error) throw toDbError(error, "Failed to update template");
}

async function listAttributeCountsDb(templateIds: number[]): Promise<Record<number, number>> {
  const ids = Array.from(new Set((templateIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return {};
  await ensureValidSessionOrThrow();
  const { data, error } = await db
    .from(TEMPLATE_ATTRIBUTES_TABLE)
    .select("template_id")
    .in("template_id", ids)
    .eq("is_active", true);
  if (error) throw toDbError(error, "Failed to load attribute counts");
  const counts: Record<number, number> = {};
  for (const row of Array.isArray(data) ? data : []) {
    const templateId = Number((row as { template_id?: number }).template_id);
    if (!Number.isFinite(templateId)) continue;
    counts[templateId] = (counts[templateId] ?? 0) + 1;
  }
  return counts;
}

async function getTemplateAttributesDb(templateId: number): Promise<Array<TemplateAttribute & { values: AttributeValue[] }>> {
  await ensureValidSessionOrThrow();
  const { data: attrs, error: attrErr } = await db
    .from(TEMPLATE_ATTRIBUTES_TABLE)
    .select("*")
    .eq("template_id", templateId)
    .order("display_order", { ascending: true });
  if (attrErr) throw toDbError(attrErr, "Failed to load template attributes");
  const attrRows = (Array.isArray(attrs) ? attrs : []) as TemplateAttributeDbRow[];
  if (attrRows.length === 0) return [];
  const attrIds = attrRows.map((a) => Number(a.id)).filter((n) => Number.isFinite(n));
  const { data: values, error: valErr } = await db
    .from(ATTRIBUTE_VALUES_TABLE)
    .select("*")
    .in("attribute_id", attrIds)
    .order("display_order", { ascending: true });
  if (valErr) throw toDbError(valErr, "Failed to load attribute values");
  const valueRows = (Array.isArray(values) ? values : []) as AttributeValueDbRow[];
  const valuesByAttr = new Map<number, AttributeValue[]>();
  for (const row of valueRows) {
    const attrId = Number(row.attribute_id);
    if (!Number.isFinite(attrId)) continue;
    const list = valuesByAttr.get(attrId) ?? [];
    list.push(row);
    valuesByAttr.set(attrId, list);
  }
  return attrRows.map((row) => ({
    ...row,
    values: valuesByAttr.get(Number(row.id)) ?? [],
  }));
}

async function getApplyPreviewDb(
  templateId: number,
  categoryId: number,
): Promise<{ products: number; attributes: number; required: number; optional: number }> {
  await ensureValidSessionOrThrow();
  const { count: productCount, error: productError } = await supabase
    .from("store_products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  if (productError) throw toDbError(productError, "Failed to load preview");
  const { data: attrs, error: attrError } = await db
    .from(TEMPLATE_ATTRIBUTES_TABLE)
    .select("id,is_required")
    .eq("template_id", templateId)
    .eq("is_active", true);
  if (attrError) throw toDbError(attrError, "Failed to load preview");
  const rows = Array.isArray(attrs) ? attrs : [];
  const attributes = rows.length;
  const required = rows.filter((r) => (r as { is_required?: boolean }).is_required === true).length;
  const optional = Math.max(0, attributes - required);
  return { products: Number(productCount ?? 0), attributes, required, optional };
}

async function applyTemplateToCategoryDb(templateId: number, categoryId: number): Promise<number> {
  await ensureValidSessionOrThrow();
  const { data, error } = await db.rpc("apply_template_to_products", {
    p_template_id: templateId,
    p_category_id: categoryId,
  });
  if (error) throw toDbError(error, "Failed to apply template");
  return Number(data ?? 0);
}

async function duplicateTemplateDb(tpl: CategoryTemplate): Promise<void> {
  await ensureValidSessionOrThrow();
  const { data: attrs, error: attrErr } = await db
    .from(TEMPLATE_ATTRIBUTES_TABLE)
    .select("*")
    .eq("template_id", tpl.id)
    .order("display_order", { ascending: true });
  if (attrErr) throw toDbError(attrErr, "Failed to duplicate template");
  const newName = `${tpl.name} (копія)`;
  const { data: newTpl, error: tplErr } = await db
    .from(CATEGORY_TEMPLATES_TABLE)
    .insert({ category_id: tpl.category_id, name: newName, description: tpl.description, is_active: tpl.is_active })
    .select("*")
    .single();
  if (tplErr) throw toDbError(tplErr, "Failed to duplicate template");
  const attrRows = (Array.isArray(attrs) ? attrs : []) as TemplateAttributeDbRow[];
  if (attrRows.length === 0) return;
  const attrPayload = attrRows.map((row) => ({
    template_id: (newTpl as CategoryTemplateDbRow).id,
    name: row.name,
    paramid: row.paramid,
    attribute_type: row.attribute_type,
    is_required: row.is_required,
    display_order: row.display_order ?? 0,
    unit: row.unit,
    validation_rules: row.validation_rules ?? null,
    default_value: row.default_value,
    help_text: row.help_text ?? null,
    is_filterable: row.is_filterable,
    is_active: row.is_active,
  }));
  const { data: newAttrs, error: newAttrErr } = await db
    .from(TEMPLATE_ATTRIBUTES_TABLE)
    .insert(attrPayload)
    .select("*");
  if (newAttrErr) throw toDbError(newAttrErr, "Failed to duplicate template");
  const oldIds = attrRows.map((row) => Number(row.id)).filter((n) => Number.isFinite(n));
  const { data: values, error: valErr } = await db
    .from(ATTRIBUTE_VALUES_TABLE)
    .select("*")
    .in("attribute_id", oldIds)
    .order("display_order", { ascending: true });
  if (valErr) throw toDbError(valErr, "Failed to duplicate template values");
  const newAttrRows = (Array.isArray(newAttrs) ? newAttrs : []) as TemplateAttributeDbRow[];
  const attrMap = new Map<number, number>();
  for (let i = 0; i < attrRows.length; i += 1) {
    const oldId = Number(attrRows[i]?.id);
    const newId = Number(newAttrRows[i]?.id);
    if (Number.isFinite(oldId) && Number.isFinite(newId)) attrMap.set(oldId, newId);
  }
  const valueRows = (Array.isArray(values) ? values : []) as AttributeValueDbRow[];
  const valuePayload = valueRows
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
    const { error: insertValsErr } = await db.from(ATTRIBUTE_VALUES_TABLE).insert(valuePayload);
    if (insertValsErr) throw toDbError(insertValsErr, "Failed to duplicate template values");
  }
}

export const CategoryTemplateService = {
  async listTemplates(): Promise<CategoryTemplate[]> {
    return await listTemplatesDb();
  },
  async listByCategory(categoryId: number): Promise<CategoryTemplate[]> {
    return await listTemplatesByCategoryDb(categoryId);
  },
  async listAttributeCounts(templateIds: number[]): Promise<Record<number, number>> {
    return await listAttributeCountsDb(templateIds);
  },
  async getTemplateById(id: number): Promise<CategoryTemplate> {
    return await getTemplateByIdDb(id);
  },
  async createTemplate(data: { category_id: number; name: string; description: string | null; is_active: boolean }): Promise<CategoryTemplate> {
    return await createTemplateDb(data);
  },
  async updateTemplate(id: number, updates: { category_id: number; name: string; description: string | null }): Promise<CategoryTemplate> {
    return await updateTemplateDb(id, updates);
  },
  async deleteTemplate(id: number): Promise<void> {
    await deleteTemplateDb(id);
  },
  async duplicateTemplate(tpl: CategoryTemplate): Promise<void> {
    await duplicateTemplateDb(tpl);
  },
  async toggleTemplateActive(id: number, isActive: boolean): Promise<void> {
    await toggleTemplateActiveDb(id, isActive);
  },
  async getTemplateAttributes(templateId: number): Promise<Array<TemplateAttribute & { values: AttributeValue[] }>> {
    return await getTemplateAttributesDb(templateId);
  },
  async getApplyPreview(templateId: number, categoryId: number): Promise<{ products: number; attributes: number; required: number; optional: number }> {
    return await getApplyPreviewDb(templateId, categoryId);
  },
  async applyTemplateToCategory(templateId: number, categoryId: number): Promise<number> {
    return await applyTemplateToCategoryDb(templateId, categoryId);
  },
};

export const TemplateAttributeService = {
  async createAttribute(
    templateId: number,
    data: {
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
  ): Promise<TemplateAttribute> {
    await ensureValidSessionOrThrow();
    const payload = { ...data, template_id: templateId, display_order: displayOrder ?? 0 };
    const { data: row, error } = await db
      .from(TEMPLATE_ATTRIBUTES_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw toDbError(error, "Failed to create attribute");
    return row as TemplateAttribute;
  },
  async updateAttribute(attrId: number, updates: Partial<TemplateAttribute>): Promise<TemplateAttribute> {
    await ensureValidSessionOrThrow();
    const { data: row, error } = await db
      .from(TEMPLATE_ATTRIBUTES_TABLE)
      .update(updates)
      .eq("id", attrId)
      .select("*")
      .single();
    if (error) throw toDbError(error, "Failed to update attribute");
    return row as TemplateAttribute;
  },
  async deleteAttribute(attrId: number): Promise<void> {
    await ensureValidSessionOrThrow();
    const { error } = await db.from(TEMPLATE_ATTRIBUTES_TABLE).delete().eq("id", attrId);
    if (error) throw toDbError(error, "Failed to delete attribute");
  },
  async reorderAttributes(updates: Array<{ id: number; display_order: number }>): Promise<void> {
    await ensureValidSessionOrThrow();
    const payload = updates.map((row) => ({ id: row.id, display_order: row.display_order }));
    const { error } = await db.from(TEMPLATE_ATTRIBUTES_TABLE).upsert(payload, { onConflict: "id" });
    if (error) throw toDbError(error, "Failed to reorder attributes");
  },
};

export const AttributeValueService = {
  async createValue(data: {
    attribute_id: number;
    value: string;
    valueid: string | null;
    display_value: string | null;
    display_order: number | null;
    value_lang?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
    is_active: boolean;
  }): Promise<AttributeValue> {
    await ensureValidSessionOrThrow();
    const { data: row, error } = await db.from(ATTRIBUTE_VALUES_TABLE).insert(data).select("*").single();
    if (error) throw toDbError(error, "Failed to create value");
    return row as AttributeValue;
  },
  async updateValue(
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
  ): Promise<AttributeValue> {
    await ensureValidSessionOrThrow();
    const { data: row, error } = await db
      .from(ATTRIBUTE_VALUES_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toDbError(error, "Failed to update value");
    return row as AttributeValue;
  },
  async deleteValue(id: number): Promise<void> {
    await ensureValidSessionOrThrow();
    const { error } = await db.from(ATTRIBUTE_VALUES_TABLE).delete().eq("id", id);
    if (error) throw toDbError(error, "Failed to delete value");
  },
  async duplicateValue(data: {
    attribute_id: number;
    value: string;
    valueid: string | null;
    display_value: string | null;
    display_order: number;
    value_lang?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
    is_active: boolean;
  }): Promise<AttributeValue> {
    await ensureValidSessionOrThrow();
    const { data: row, error } = await db.from(ATTRIBUTE_VALUES_TABLE).insert(data).select("*").single();
    if (error) throw toDbError(error, "Failed to duplicate value");
    return row as AttributeValue;
  },
  async bulkCreateValues(items: Array<{
    attribute_id: number;
    value: string;
    valueid: string | null;
    display_value: string | null;
    display_order: number;
    value_lang?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
    is_active: boolean;
  }>): Promise<AttributeValue[]> {
    await ensureValidSessionOrThrow();
    const { data, error } = await db.from(ATTRIBUTE_VALUES_TABLE).insert(items).select("*");
    if (error) throw toDbError(error, "Failed to create values");
    return (Array.isArray(data) ? data : []) as AttributeValue[];
  },
  async reorderValues(updates: Array<{ id: number; display_order: number }>): Promise<void> {
    await ensureValidSessionOrThrow();
    const payload = updates.map((row) => ({ id: row.id, display_order: row.display_order }));
    const { error } = await db.from(ATTRIBUTE_VALUES_TABLE).upsert(payload, { onConflict: "id" });
    if (error) throw toDbError(error, "Failed to reorder values");
  },
  async toggleValueActive(id: number, isActive: boolean): Promise<void> {
    await ensureValidSessionOrThrow();
    const { error } = await db.from(ATTRIBUTE_VALUES_TABLE).update({ is_active: isActive }).eq("id", id);
    if (error) throw toDbError(error, "Failed to update value");
  },
};
