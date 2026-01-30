import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";
import type { TemplateAttribute } from "../types";

const db = supabase as unknown as { from: (table: string) => any };

export async function getByTemplate(templateId: number): Promise<TemplateAttribute[]> {
  await ensureValidSession();
  const { data, error } = await db
    .from("template_attributes")
    .select("*")
    .eq("template_id", templateId)
    .order("display_order", { ascending: true });
  if (error) throw toDbError(error, "Failed to load attributes", { templateId });
  return (Array.isArray(data) ? data : []) as TemplateAttribute[];
}

export async function create(
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
): Promise<TemplateAttribute> {
  await ensureValidSession();
  const payload = { ...input, template_id: templateId, display_order: displayOrder ?? 0 };
  const { data, error } = await db.from("template_attributes").insert(payload).select("*").single();
  if (error) throw toDbError(error, "Failed to create attribute", { templateId });
  return data as TemplateAttribute;
}

export async function update(attrId: number, updates: Partial<TemplateAttribute>): Promise<TemplateAttribute> {
  await ensureValidSession();
  const { data, error } = await db.from("template_attributes").update(updates).eq("id", attrId).select("*").single();
  if (error) throw toDbError(error, "Failed to update attribute", { attrId });
  return data as TemplateAttribute;
}

export async function remove(attrId: number): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("template_attributes").delete().eq("id", attrId);
  if (error) throw toDbError(error, "Failed to delete attribute", { attrId });
}

export async function reorder(
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
): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("template_attributes").upsert(updates, { onConflict: "id" });
  if (error) throw toDbError(error, "Failed to reorder attributes");
}

export async function bulkCreate(
  items: Array<{
    template_id: number;
    name: string;
    paramid?: string | null;
    attribute_type: string;
    is_required: boolean;
    display_order: number;
    unit?: string | null;
    default_value?: string | null;
    is_filterable: boolean;
    is_active: boolean;
  }>,
): Promise<TemplateAttribute[]> {
  await ensureValidSession();
  const { data, error } = await db.from("template_attributes").insert(items).select("*");
  if (error) throw toDbError(error, "Failed to create attributes");
  return (Array.isArray(data) ? data : []) as TemplateAttribute[];
}

export async function countByTemplateIds(templateIds: number[]): Promise<Record<number, number>> {
  const ids = Array.from(new Set((templateIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return {};
  await ensureValidSession();
  const { data, error } = await db
    .from("template_attributes")
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
