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
