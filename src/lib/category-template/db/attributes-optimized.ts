import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";
import type { TemplateAttribute, AttributeValue } from "../types";

const db = supabase as unknown as { from: (table: string) => any };

export async function getTemplateAttributesOptimized(
  templateId: number,
): Promise<Array<TemplateAttribute & { values: AttributeValue[] }>> {
  await ensureValidSession();
  const { data, error } = await db
    .from("template_attributes")
    .select(
      `
      *,
      attribute_values (*)
    `,
    )
    .eq("template_id", templateId)
    .order("display_order", { ascending: true });
  if (error) throw toDbError(error, "Failed to load attributes with values", { templateId });
  if (!data || !Array.isArray(data)) return [];
  return data.map((attr: any) => ({
    id: attr.id,
    template_id: attr.template_id,
    name: attr.name,
    paramid: attr.paramid,
    attribute_type: attr.attribute_type,
    is_required: attr.is_required,
    unit: attr.unit,
    default_value: attr.default_value,
    is_filterable: attr.is_filterable,
    is_active: attr.is_active,
    display_order: attr.display_order,
    values: Array.isArray(attr.attribute_values)
      ? attr.attribute_values.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      : [],
  }));
}
