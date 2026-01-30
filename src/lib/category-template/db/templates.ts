import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";
import type { CategoryTemplate } from "../types";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export async function getAll(): Promise<CategoryTemplate[]> {
  await ensureValidSession();
  const { data, error } = await db.from("category_templates").select("*").order("id", { ascending: true });
  if (error) throw toDbError(error, "Failed to load templates");
  return (Array.isArray(data) ? data : []) as CategoryTemplate[];
}

export async function getByCategory(categoryId: number): Promise<CategoryTemplate[]> {
  await ensureValidSession();
  const { data, error } = await db
    .from("category_templates")
    .select("*")
    .eq("category_id", categoryId)
    .order("id", { ascending: true });
  if (error) throw toDbError(error, "Failed to load templates", { categoryId });
  return (Array.isArray(data) ? data : []) as CategoryTemplate[];
}

export async function getById(id: number): Promise<CategoryTemplate> {
  await ensureValidSession();
  const { data, error } = await db.from("category_templates").select("*").eq("id", id).single();
  if (error) throw toDbError(error, "Failed to load template", { id });
  if (!data) throw new Error("Template not found");
  return data as CategoryTemplate;
}

export async function create(input: {
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}): Promise<CategoryTemplate> {
  await ensureValidSession();
  const { data, error } = await db.from("category_templates").insert(input).select("*").single();
  if (error) throw toDbError(error, "Failed to create template", { category_id: input.category_id });
  return data as CategoryTemplate;
}

export async function update(
  id: number,
  updates: { category_id: number; name: string; description: string | null },
): Promise<CategoryTemplate> {
  await ensureValidSession();
  const { data, error } = await db
    .from("category_templates")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toDbError(error, "Failed to update template", { id });
  return data as CategoryTemplate;
}

export async function remove(id: number): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("category_templates").delete().eq("id", id);
  if (error) throw toDbError(error, "Failed to delete template", { id });
}

export async function toggleActive(id: number, isActive: boolean): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("category_templates").update({ is_active: isActive }).eq("id", id);
  if (error) throw toDbError(error, "Failed to update template", { id, isActive });
}

export async function applyToCategory(templateId: number, categoryId: number): Promise<number> {
  await ensureValidSession();
  const { data, error } = await db.rpc("apply_template_to_products", {
    p_template_id: templateId,
    p_category_id: categoryId,
  });
  if (error) throw toDbError(error, "Failed to apply template", { templateId, categoryId });
  return Number(data ?? 0);
}

export async function getApplyPreview(templateId: number, categoryId: number): Promise<{
  products: number;
  attributes: number;
  required: number;
  optional: number;
}> {
  await ensureValidSession();
  const [productsRes, attrsRes] = await Promise.all([
    db.from("store_products").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
    db.from("template_attributes").select("id,is_required").eq("template_id", templateId).eq("is_active", true),
  ]);
  const { count: productCount, error: productError } = productsRes;
  if (productError) throw toDbError(productError, "Failed to load preview", { templateId, categoryId });
  const { data: attrs, error: attrError } = attrsRes;
  if (attrError) throw toDbError(attrError, "Failed to load preview", { templateId, categoryId });
  const rows = Array.isArray(attrs) ? attrs : [];
  const attributes = rows.length;
  const required = rows.filter((r) => (r as { is_required?: boolean }).is_required === true).length;
  const optional = Math.max(0, attributes - required);
  return { products: Number(productCount ?? 0), attributes, required, optional };
}
