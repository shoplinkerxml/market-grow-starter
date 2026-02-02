import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

export async function duplicateTemplateOptimized(templateId: number, newName?: string) {
  await ensureValidSession();
  const { data, error } = await db.rpc("duplicate_template_with_attributes", {
    p_template_id: templateId,
    p_new_name: newName ?? null,
  });
  if (error) throw toDbError(error, "Failed to duplicate template", { templateId });
  return data;
}
