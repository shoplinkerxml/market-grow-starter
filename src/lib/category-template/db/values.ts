import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";
import type { AttributeValue } from "../types";

const db = supabase as unknown as { from: (table: string) => any };

export async function getByAttributes(attributeIds: number[]): Promise<AttributeValue[]> {
  if (attributeIds.length === 0) return [];
  await ensureValidSession();
  const { data, error } = await db
    .from("attribute_values")
    .select("*")
    .in("attribute_id", attributeIds)
    .order("display_order", { ascending: true });
  if (error) throw toDbError(error, "Failed to load values");
  return (Array.isArray(data) ? data : []) as AttributeValue[];
}

export async function create(input: {
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number | null;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
}): Promise<AttributeValue> {
  await ensureValidSession();
  const { data, error } = await db.from("attribute_values").insert(input).select("*").single();
  if (error) throw toDbError(error, "Failed to create value", { attribute_id: input.attribute_id });
  return data as AttributeValue;
}

export async function bulkCreate(items: Array<{
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
}>): Promise<AttributeValue[]> {
  await ensureValidSession();
  const { data, error } = await db.from("attribute_values").insert(items).select("*");
  if (error) throw toDbError(error, "Failed to create values");
  return (Array.isArray(data) ? data : []) as AttributeValue[];
}

export async function update(
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
  await ensureValidSession();
  const { data, error } = await db.from("attribute_values").update(updates).eq("id", id).select("*").single();
  if (error) throw toDbError(error, "Failed to update value", { id });
  return data as AttributeValue;
}

export async function remove(id: number): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("attribute_values").delete().eq("id", id);
  if (error) throw toDbError(error, "Failed to delete value", { id });
}

export async function toggleActive(id: number, isActive: boolean): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("attribute_values").update({ is_active: isActive }).eq("id", id);
  if (error) throw toDbError(error, "Failed to update value", { id, isActive });
}

export async function reorder(updates: Array<{ id: number; display_order: number }>): Promise<void> {
  await ensureValidSession();
  const { error } = await db.from("attribute_values").upsert(updates, { onConflict: "id" });
  if (error) throw toDbError(error, "Failed to reorder values");
}
