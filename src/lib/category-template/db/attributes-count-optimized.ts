import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession } from "../utils/validation";
import { toDbError } from "../utils/errors";

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => any };

type CountRow = {
  template_id?: number;
  total_count?: number | string | null;
  active_count?: number | string | null;
  inactive_count?: number | string | null;
};

export async function countByTemplateIdsOptimized(templateIds: number[]): Promise<Record<number, number>> {
  const ids = Array.from(new Set((templateIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return {};
  await ensureValidSession();
  const { data, error } = await db.rpc("count_attributes_by_templates", { p_template_ids: ids });
  if (error) throw toDbError(error, "Failed to load attribute counts", { templateIds: ids });
  const counts: Record<number, number> = {};
  for (const row of Array.isArray(data) ? (data as CountRow[]) : []) {
    const templateId = Number(row.template_id);
    if (!Number.isFinite(templateId)) continue;
    const active = row.active_count ?? row.total_count ?? 0;
    counts[templateId] = Number(active) || 0;
  }
  return counts;
}
