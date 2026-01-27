import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AttributeValue, CategoryTemplate, TemplateAttribute } from "@/lib/template-service";
import type { ApplyPreview, CategoryTemplateRow, CreateTemplateForm } from "../types";

type Translator = (key: string) => string;

export function useTemplates(t: Translator) {
  const [templates, setTemplates] = useState<CategoryTemplateRow[]>([]);
  const [attributeCounts, setAttributeCounts] = useState<Record<number, number>>({});
  const loadTemplatesRequestIdRef = useRef(0);

  const loadTemplates = useCallback(async () => {
    loadTemplatesRequestIdRef.current += 1;
    const requestId = loadTemplatesRequestIdRef.current;
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    if (error) throw new Error(error.message);
    const rows = (data || []) as CategoryTemplateRow[];
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    setTemplates(rows);
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: attrs, error: attrErr } = await (supabase as any)
        .from("template_attributes")
        .select("id, template_id")
        .in("template_id", ids);
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      if (attrErr) {
        setAttributeCounts({});
      } else {
        const map: Record<number, number> = {};
        for (const a of (attrs || []) as Array<{ id: number; template_id: number }>) {
          const key = Number((a as any).template_id);
          map[key] = (map[key] || 0) + 1;
        }
        setAttributeCounts(map);
      }
    } else {
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      setAttributeCounts({});
    }
  }, []);

  const getTemplateById = useCallback(
    async (id: number) => {
      const found = templates.find((tpl) => Number(tpl.id) === id);
      if (found) return found;
      const { data, error } = await (supabase as any)
        .from("category_templates")
        .select("id,category_id,name,description,is_active,created_at,updated_at")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as CategoryTemplate;
    },
    [templates],
  );

  const createTemplate = useCallback(
    async (form: CreateTemplateForm) => {
      if (!form.category_id || !form.name.trim()) {
        toast.error(t("failed_save"));
        return false;
      }
      try {
        const { error } = await (supabase as any).from("category_templates").insert({
          category_id: Number(form.category_id),
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
        if (error) throw new Error(error.message);
        await loadTemplates();
        toast.success(t("template_saved"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [loadTemplates, t],
  );

  const updateTemplate = useCallback(
    async (id: number, form: { category_id: string; name: string; description: string }) => {
      try {
        const { error } = await (supabase as any)
          .from("category_templates")
          .update({
            category_id: Number(form.category_id),
            name: form.name.trim(),
            description: form.description.trim() || null,
          })
          .eq("id", id);
        if (error) throw new Error(error.message);
        setTemplates((prev) =>
          prev.map((tpl) =>
            tpl.id === id
              ? { ...tpl, category_id: Number(form.category_id), name: form.name.trim(), description: form.description.trim() || null }
              : tpl,
          ),
        );
        toast.success(t("template_saved"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const deleteTemplate = useCallback(
    async (tpl: CategoryTemplate) => {
      try {
        const { error } = await (supabase as any).from("category_templates").delete().eq("id", tpl.id);
        if (error) throw new Error(error.message);
        await loadTemplates();
        toast.success(t("template_deleted"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_delete_template"));
        return false;
      }
    },
    [loadTemplates, t],
  );

  const duplicateTemplate = useCallback(
    async (tpl: CategoryTemplateRow) => {
      try {
        const { data: newTplData, error: insErr } = await (supabase as any)
          .from("category_templates")
          .insert({
            category_id: tpl.category_id,
            name: `${tpl.name} (копія)`,
            description: tpl.description || null,
            is_active: tpl.is_active ?? true,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        const newTemplateId = Number((newTplData as any)?.id);

        const { data: oldAttrs, error: oldAttrsErr } = await (supabase as any)
          .from("template_attributes")
          .select("id, template_id, name, paramid, attribute_type, is_required, display_order, unit, default_value, is_filterable, is_active")
          .eq("template_id", tpl.id)
          .order("display_order", { ascending: true });
        if (oldAttrsErr) throw new Error(oldAttrsErr.message);
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
          if (insertAttrsErr) throw new Error(insertAttrsErr.message);

          const { data: newAttrs, error: newAttrsErr } = await (supabase as any)
            .from("template_attributes")
            .select("id, display_order")
            .eq("template_id", newTemplateId)
            .order("display_order", { ascending: true });
          if (newAttrsErr) throw new Error(newAttrsErr.message);
          const newAttrRows = (newAttrs || []) as Array<{ id: number; display_order: number | null }>;

          const oldAttrIds = oldAttrRows.map((a) => a.id);
          const { data: oldValues, error: oldValuesErr } = await (supabase as any)
            .from("attribute_values")
            .select("id, attribute_id, value, valueid, display_value, value_lang, display_order, is_active, metadata")
            .in("attribute_id", oldAttrIds)
            .order("display_order", { ascending: true });
          if (oldValuesErr) throw new Error(oldValuesErr.message);
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
            if (insValsErr) throw new Error(insValsErr.message);
          }
        }

        await loadTemplates();
        toast.success(t("duplicate_tariff"));
        return true;
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
        return false;
      }
    },
    [loadTemplates, t],
  );

  const toggleTemplateActive = useCallback(
    async (tpl: CategoryTemplateRow, active: boolean) => {
      try {
        const { error } = await (supabase as any).from("category_templates").update({ is_active: active }).eq("id", tpl.id);
        if (error) throw new Error(error.message);
        setTemplates((prev) => prev.map((r) => (r.id === tpl.id ? { ...r, is_active: active } : r)));
        toast.success(t("currency_status_updated"));
        return true;
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const getApplyPreview = useCallback(
    async (templateId: number, categoryId: number) => {
      try {
        const { count: productsCount, error: productsError } = await (supabase as any)
          .from("store_products")
          .select("id", { count: "exact", head: true })
          .eq("category_id", Number(categoryId));
        if (productsError) throw new Error(productsError.message);
        const { data: attrsData, error: attrsError } = await (supabase as any)
          .from("template_attributes")
          .select("id,is_required")
          .eq("template_id", templateId)
          .eq("is_active", true);
        if (attrsError) throw new Error(attrsError.message);
        const attrs = (attrsData || []) as Array<{ id: number; is_required: boolean | null }>;
        const total = attrs.length;
        const required = attrs.filter((a) => !!a.is_required).length;
        const optional = Math.max(0, total - required);
        return { products: productsCount || 0, attributes: total, required, optional } as ApplyPreview;
      } catch (error: any) {
        toast.error(error?.message || t("operation_failed"));
        return null;
      }
    },
    [t],
  );

  const applyTemplateToCategory = useCallback(
    async (templateId: number, categoryId: number) => {
      try {
        const { data, error } = await (supabase as any).rpc("apply_template_to_products", {
          p_template_id: Number(templateId),
          p_category_id: Number(categoryId),
        });
        if (error) throw new Error(error.message);
        return typeof data === "number" ? data : 0;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return null;
      }
    },
    [t],
  );

  return {
    templates,
    attributeCounts,
    loadTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    toggleTemplateActive,
    getApplyPreview,
    applyTemplateToCategory,
    setTemplates,
  };
}
