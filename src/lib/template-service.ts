import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { SessionValidator } from './session-validation';
import { AppError } from "./error-handler";

export type TemplateServiceErrorCode = 'unauthorized' | 'validation_failed' | 'delete_failed';

export class TemplateServiceError extends AppError {
  declare code: TemplateServiceErrorCode;
  details?: unknown;
  constructor(code: TemplateServiceErrorCode, message: string, details?: unknown) {
    const status = code === "unauthorized" ? 401 : code === "validation_failed" ? 422 : 500;
    super(code, message, { status, retryable: status >= 500, context: details ? { details } : undefined, cause: details, name: "TemplateServiceError" });
    this.details = details;
  }
}

export type CategoryTemplate = {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TemplateAttribute = {
  id: number;
  template_id: number;
  name: string;
  paramid?: string | null;
  attribute_type: string;
  is_required?: boolean | null;
  display_order?: number | null;
  unit?: string | null;
  default_value?: string | null;
  is_filterable?: boolean | null;
  is_active?: boolean | null;
};

export type AttributeValue = {
  id: number;
  attribute_id: number;
  value: string;
  valueid?: string | null;
  display_value?: string | null;
  value_lang?: Record<string, string> | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

export type CreateCategoryTemplateInput = {
  category_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
};

export type UpdateCategoryTemplateInput = {
  category_id: number;
  name: string;
  description?: string | null;
};

export type CreateTemplateAttributeInput = {
  name: string;
  paramid?: string | null;
  attribute_type: string;
  is_required?: boolean | null;
  unit?: string | null;
  default_value?: string | null;
  is_filterable?: boolean | null;
  is_active?: boolean | null;
};

export type CreateAttributeValueInput = {
  attribute_id: number;
  value: string;
  valueid?: string | null;
  display_value?: string | null;
  display_order?: number | null;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean | null;
};

export type UpdateAttributeValueInput = Omit<CreateAttributeValueInput, "attribute_id">;

export async function getAuthHeaders(): Promise<HeadersInit> {
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    throw new TemplateServiceError('unauthorized', 'Invalid session', validation.error);
  }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new TemplateServiceError('unauthorized', 'No authentication token available');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export class CategoryTemplateService {
  static async listTemplates(): Promise<CategoryTemplate[]> {
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to load templates", { code: error.code });
    }
    return Array.isArray(data) ? (data as CategoryTemplate[]) : [];
  }

  static async getTemplateById(id: number): Promise<CategoryTemplate> {
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .eq("id", id)
      .single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to load template", { code: error.code });
    }
    return data as CategoryTemplate;
  }

  static async listAttributeCounts(templateIds: number[]): Promise<Record<number, number>> {
    if (templateIds.length === 0) return {};
    const { data, error } = await (supabase as any).from("template_attributes").select("id, template_id").in("template_id", templateIds);
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to load attribute counts", { code: error.code });
    }
    const map: Record<number, number> = {};
    for (const a of (data || []) as Array<{ id: number; template_id: number }>) {
      const key = Number((a as any).template_id);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }

  static async createTemplate(input: CreateCategoryTemplateInput): Promise<CategoryTemplate> {
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .insert({
        category_id: Number(input.category_id),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
      })
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to create template", { code: error.code });
    }
    return data as CategoryTemplate;
  }

  static async updateTemplate(id: number, input: UpdateCategoryTemplateInput): Promise<CategoryTemplate> {
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .update({
        category_id: Number(input.category_id),
        name: input.name.trim(),
        description: input.description?.trim() || null,
      })
      .eq("id", id)
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update template", { code: error.code });
    }
    return data as CategoryTemplate;
  }

  static async deleteTemplate(id: number): Promise<void> {
    const { error } = await (supabase as any).from("category_templates").delete().eq("id", id);
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to delete template", { code: error.code });
    }
  }

  static async toggleTemplateActive(id: number, active: boolean): Promise<void> {
    const { error } = await (supabase as any).from("category_templates").update({ is_active: active }).eq("id", id);
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update template status", { code: error.code });
    }
  }

  static async duplicateTemplate(template: CategoryTemplate): Promise<void> {
    const { data: newTplData, error: insErr } = await (supabase as any)
      .from("category_templates")
      .insert({
        category_id: template.category_id,
        name: `${template.name} (копія)`,
        description: template.description || null,
        is_active: template.is_active ?? true,
      })
      .select("id")
      .single();
    if (insErr) {
      throw new TemplateServiceError("delete_failed", insErr.message || "Failed to duplicate template", { code: insErr.code });
    }
    const newTemplateId = Number((newTplData as any)?.id);
    const { data: oldAttrs, error: oldAttrsErr } = await (supabase as any)
      .from("template_attributes")
      .select("id, template_id, name, paramid, attribute_type, is_required, display_order, unit, default_value, is_filterable, is_active")
      .eq("template_id", template.id)
      .order("display_order", { ascending: true });
    if (oldAttrsErr) {
      throw new TemplateServiceError("delete_failed", oldAttrsErr.message || "Failed to duplicate template attributes", { code: oldAttrsErr.code });
    }
    const oldAttrRows = (oldAttrs || []) as TemplateAttribute[];
    if (oldAttrRows.length > 0) {
      const insertAttrs = oldAttrRows.map((a, idx) => ({
        template_id: newTemplateId,
        name: a.name,
        paramid: a.paramid || null,
        attribute_type: a.attribute_type,
        is_required: a.is_required ?? false,
        unit: a.unit || null,
        default_value: a.default_value || null,
        is_filterable: a.is_filterable ?? true,
        is_active: a.is_active ?? true,
        display_order: typeof a.display_order === "number" ? a.display_order : idx,
      }));
      const { error: insertAttrsErr } = await (supabase as any).from("template_attributes").insert(insertAttrs);
      if (insertAttrsErr) {
        throw new TemplateServiceError("delete_failed", insertAttrsErr.message || "Failed to duplicate template attributes", {
          code: insertAttrsErr.code,
        });
      }
      const { data: newAttrs, error: newAttrsErr } = await (supabase as any)
        .from("template_attributes")
        .select("id, display_order")
        .eq("template_id", newTemplateId)
        .order("display_order", { ascending: true });
      if (newAttrsErr) {
        throw new TemplateServiceError("delete_failed", newAttrsErr.message || "Failed to duplicate template attributes", { code: newAttrsErr.code });
      }
      const newAttrRows = (newAttrs || []) as Array<{ id: number; display_order: number | null }>;
      const oldAttrIds = oldAttrRows.map((a) => a.id);
      const { data: oldValues, error: oldValuesErr } = await (supabase as any)
        .from("attribute_values")
        .select("id, attribute_id, value, valueid, display_value, value_lang, display_order, is_active, metadata")
        .in("attribute_id", oldAttrIds)
        .order("display_order", { ascending: true });
      if (oldValuesErr) {
        throw new TemplateServiceError("delete_failed", oldValuesErr.message || "Failed to duplicate attribute values", { code: oldValuesErr.code });
      }
      const valuesByAttr = new Map<number, AttributeValue[]>();
      for (const v of (oldValues || []) as AttributeValue[]) {
        const list = valuesByAttr.get(Number(v.attribute_id)) || [];
        list.push(v);
        valuesByAttr.set(Number(v.attribute_id), list);
      }
      const valueInserts: Array<Record<string, unknown>> = [];
      for (let i = 0; i < oldAttrRows.length; i++) {
        const oldAttr = oldAttrRows[i];
        const newAttr = newAttrRows[i];
        if (!newAttr) continue;
        const oldList = valuesByAttr.get(Number(oldAttr.id)) || [];
        for (let j = 0; j < oldList.length; j++) {
          const v = oldList[j];
          valueInserts.push({
            attribute_id: newAttr.id,
            value: v.value,
            valueid: v.valueid || null,
            display_value: v.display_value || null,
            value_lang: (v as any).value_lang || null,
            display_order: typeof v.display_order === "number" ? v.display_order : j,
            is_active: v.is_active ?? true,
            metadata: (v as any).metadata || null,
          });
        }
      }
      if (valueInserts.length > 0) {
        const { error: insValsErr } = await (supabase as any).from("attribute_values").insert(valueInserts);
        if (insValsErr) {
          throw new TemplateServiceError("delete_failed", insValsErr.message || "Failed to duplicate attribute values", { code: insValsErr.code });
        }
      }
    }
  }

  static async getApplyPreview(templateId: number, categoryId: number): Promise<{ products: number; attributes: number; required: number; optional: number }> {
    const { count: productsCount, error: productsError } = await (supabase as any)
      .from("store_products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", Number(categoryId));
    if (productsError) {
      throw new TemplateServiceError("delete_failed", productsError.message || "Failed to load products count", { code: productsError.code });
    }
    const { data: attrsData, error: attrsError } = await (supabase as any)
      .from("template_attributes")
      .select("id,is_required")
      .eq("template_id", templateId)
      .eq("is_active", true);
    if (attrsError) {
      throw new TemplateServiceError("delete_failed", attrsError.message || "Failed to load attributes", { code: attrsError.code });
    }
    const attrs = (attrsData || []) as Array<{ id: number; is_required: boolean | null }>;
    const total = attrs.length;
    const required = attrs.filter((a) => !!a.is_required).length;
    const optional = Math.max(0, total - required);
    return { products: productsCount || 0, attributes: total, required, optional };
  }

  static async applyTemplateToCategory(templateId: number, categoryId: number): Promise<number> {
    const { data, error } = await (supabase as any).rpc("apply_template_to_products", {
      p_template_id: Number(templateId),
      p_category_id: Number(categoryId),
    });
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to apply template", { code: error.code });
    }
    return typeof data === "number" ? data : 0;
  }
  static async listByCategory(categoryId: string | number): Promise<CategoryTemplate[]> {
    const normalized = Number(categoryId);
    if (!Number.isFinite(normalized)) return [];
    const { data, error } = await (supabase as any)
      .from('category_templates')
      .select('id, category_id, name, description, is_active')
      .eq('category_id', normalized)
      .eq('is_active', true)
      .order('id', { ascending: true });
    if (error) {
      throw new TemplateServiceError('delete_failed', error.message || 'Failed to load templates', { code: error.code });
    }
    return Array.isArray(data) ? (data as CategoryTemplate[]) : [];
  }

  static async getTemplateAttributes(templateId: string | number): Promise<Array<TemplateAttribute & { values: AttributeValue[] }>> {
    const normalized = Number(templateId);
    if (!Number.isFinite(normalized)) return [];
    const { data: attributes, error: attrError } = await (supabase as any)
      .from('template_attributes')
      .select('id, template_id, name, paramid, attribute_type, is_required, display_order, unit, default_value, is_filterable, is_active')
      .eq('template_id', normalized)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (attrError) {
      throw new TemplateServiceError('delete_failed', attrError.message || 'Failed to load attributes', { code: attrError.code });
    }
    const attrRows = Array.isArray(attributes) ? (attributes as TemplateAttribute[]) : [];
    if (attrRows.length === 0) return [];
    const attrIds = attrRows.map((a) => a.id);
    const { data: values, error: valuesError } = await (supabase as any)
      .from('attribute_values')
      .select('id, attribute_id, value, valueid, display_value, value_lang, display_order, is_active')
      .in('attribute_id', attrIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (valuesError) {
      throw new TemplateServiceError('delete_failed', valuesError.message || 'Failed to load attribute values', { code: valuesError.code });
    }
    const valuesByAttr = new Map<number, AttributeValue[]>();
    for (const v of Array.isArray(values) ? (values as AttributeValue[]) : []) {
      const key = Number((v as any).attribute_id);
      if (!Number.isFinite(key)) continue;
      const list = valuesByAttr.get(key) || [];
      list.push(v);
      valuesByAttr.set(key, list);
    }
    return attrRows.map((attr) => ({
      ...attr,
      values: valuesByAttr.get(attr.id) || [],
    }));
  }
}

export class TemplateAttributeService {
  static async createAttribute(templateId: number, input: CreateTemplateAttributeInput, displayOrder: number): Promise<TemplateAttribute> {
    const { data, error } = await (supabase as any)
      .from("template_attributes")
      .insert({
        template_id: templateId,
        name: input.name.trim(),
        paramid: input.paramid?.trim() || null,
        attribute_type: input.attribute_type,
        is_required: input.is_required ?? false,
        unit: input.unit?.trim() || null,
        default_value: input.default_value?.trim() || null,
        is_filterable: input.is_filterable ?? true,
        is_active: input.is_active ?? true,
        display_order: displayOrder,
      })
      .select()
      .single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to create attribute", { code: error.code });
    }
    return data as TemplateAttribute;
  }

  static async updateAttribute(attrId: number, updates: Partial<TemplateAttribute>): Promise<TemplateAttribute> {
    const { data, error } = await (supabase as any)
      .from("template_attributes")
      .update({
        name: (updates.name || "").trim(),
        paramid: updates.paramid ? String(updates.paramid).trim() : null,
        attribute_type: updates.attribute_type,
        unit: updates.unit ? String(updates.unit).trim() : null,
        default_value: updates.default_value ? String(updates.default_value).trim() : null,
        is_active: updates.is_active ?? true,
      })
      .eq("id", attrId)
      .select()
      .single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update attribute", { code: error.code });
    }
    return data as TemplateAttribute;
  }

  static async reorderAttributes(updates: Array<{ id: number; display_order: number }>): Promise<void> {
    if (updates.length === 0) return;
    const { error } = await (supabase as any).from("template_attributes").upsert(updates, { onConflict: "id" });
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update attribute order", { code: error.code });
    }
  }
}

export class AttributeValueService {
  static async createValue(input: CreateAttributeValueInput): Promise<AttributeValue> {
    const { data, error } = await (supabase as any).from("attribute_values").insert(input).select().single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to create value", { code: error.code });
    }
    return data as AttributeValue;
  }

  static async updateValue(id: number, input: UpdateAttributeValueInput): Promise<AttributeValue> {
    const { data, error } = await (supabase as any).from("attribute_values").update(input).eq("id", id).select().single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update value", { code: error.code });
    }
    return data as AttributeValue;
  }

  static async deleteValue(id: number): Promise<void> {
    const { error } = await (supabase as any).from("attribute_values").delete().eq("id", id);
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to delete value", { code: error.code });
    }
  }

  static async bulkCreateValues(rows: CreateAttributeValueInput[]): Promise<AttributeValue[]> {
    if (rows.length === 0) return [];
    const { data, error } = await (supabase as any).from("attribute_values").insert(rows).select();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to create values", { code: error.code });
    }
    return (data || []) as AttributeValue[];
  }

  static async duplicateValue(input: CreateAttributeValueInput): Promise<AttributeValue> {
    const { data, error } = await (supabase as any).from("attribute_values").insert(input).select().single();
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to duplicate value", { code: error.code });
    }
    return data as AttributeValue;
  }

  static async toggleValueActive(id: number, active: boolean): Promise<void> {
    const { error } = await (supabase as any).from("attribute_values").update({ is_active: active }).eq("id", id);
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to update value status", { code: error.code });
    }
  }

  static async reorderValues(updates: Array<{ id: number; display_order: number }>): Promise<void> {
    if (updates.length === 0) return;
    const { error } = await (supabase as any).from("attribute_values").upsert(updates, { onConflict: "id" });
    if (error) {
      throw new TemplateServiceError("delete_failed", error.message || "Failed to reorder values", { code: error.code });
    }
  }
}

export class TemplateService {
  private static async getAccessToken(): Promise<string> {
    const validation = await SessionValidator.ensureValidSession();
    if (!validation.isValid) {
      throw new TemplateServiceError('unauthorized', 'Invalid session', validation.error);
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new TemplateServiceError('unauthorized', 'No authentication token available');
    }
    return token;
  }

  static async deleteTemplate(id: string): Promise<{ success: boolean }> {
    if (!id) {
      throw new TemplateServiceError('validation_failed', 'Template ID is required');
    }

    await this.getAccessToken();

    const { error } = await supabase
      .from('store_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new TemplateServiceError('delete_failed', error.message || 'Failed to delete template', { code: (error as unknown as { code?: string }).code });
    }

    return { success: true };
  }
}
