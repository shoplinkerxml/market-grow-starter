import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AttributeValue, CategoryTemplate, TemplateAttribute } from "@/lib/template-service";
import type { AttributeForm, TemplateAttributeWithValues, ValueForm } from "../types";

type Translator = (key: string) => string;

type BulkValuesInput = {
  attribute: TemplateAttribute | null;
  valuesText: string;
  prefix: string;
  suffix: string;
  generateValueId: boolean;
};

function buildGeneratedValueId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function useTemplateAttributes(t: Translator) {
  const [attributes, setAttributes] = useState<TemplateAttributeWithValues[]>([]);
  const [valueSaving, setValueSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadTemplateDetails = useCallback(async (tpl: CategoryTemplate) => {
    const { data: attrs, error: attrError } = await (supabase as any)
      .from("template_attributes")
      .select("id, template_id, name, paramid, attribute_type, is_required, display_order, unit, default_value, is_filterable, is_active")
      .eq("template_id", tpl.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (attrError) throw new Error(attrError.message);
    const attrRows = (attrs || []) as TemplateAttribute[];
    if (attrRows.length === 0) {
      setAttributes([]);
      return;
    }
    const attrIds = attrRows.map((a) => a.id);
    const { data: values, error: valuesError } = await (supabase as any)
      .from("attribute_values")
      .select("id, attribute_id, value, valueid, display_value, value_lang, display_order, is_active")
      .in("attribute_id", attrIds)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (valuesError) throw new Error(valuesError.message);
    const byAttr = new Map<number, AttributeValue[]>();
    for (const v of (values || []) as AttributeValue[]) {
      const key = Number((v as any).attribute_id);
      const list = byAttr.get(key) || [];
      list.push(v);
      byAttr.set(key, list);
    }
    setAttributes(attrRows.map((a) => ({ ...a, values: byAttr.get(a.id) || [] })));
  }, []);

  const addAttribute = useCallback(
    async (templateId: number, form: AttributeForm) => {
      if (!form.name.trim()) {
        toast.error(t("failed_save"));
        return false;
      }
      try {
        const { data, error } = await (supabase as any)
          .from("template_attributes")
          .insert({
            template_id: templateId,
            name: form.name.trim(),
            paramid: (form.paramid || "").trim() || null,
            attribute_type: form.attribute_type,
            is_required: form.is_required,
            unit: (form.unit || "").trim() || null,
            default_value: (form.default_value || "").trim() || null,
            is_filterable: form.is_filterable,
            is_active: form.is_active,
            display_order: attributes.length,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        const row = data as TemplateAttribute;
        setAttributes((prev) => [...prev, { ...row, values: [] }]);
        toast.success(t("feature_saved_successfully"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [attributes.length, t],
  );

  const updateAttribute = useCallback(
    async (attrId: number, updates: Partial<TemplateAttribute>) => {
      try {
        const { error } = await (supabase as any)
          .from("template_attributes")
          .update({
            name: (updates.name || "").trim(),
            paramid: updates.paramid ? String(updates.paramid).trim() : null,
            attribute_type: updates.attribute_type,
            unit: updates.unit ? String(updates.unit).trim() : null,
            default_value: updates.default_value ? String(updates.default_value).trim() : null,
            is_active: updates.is_active ?? true,
          })
          .eq("id", attrId);
        if (error) throw new Error(error.message);
        setAttributes((prev) => prev.map((row) => (row.id === attrId ? { ...row, ...updates } : row)));
        toast.success(t("feature_saved_successfully"));
        return true;
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const saveValue = useCallback(
    async (form: ValueForm) => {
      const attributeId = form.attribute_id;
      if (!attributeId || !form.value.trim()) {
        toast.error(t("failed_save"));
        return false;
      }
      try {
        const valueLang: Record<string, string> = {};
        if (form.value_lang_uk?.trim()) valueLang.uk = form.value_lang_uk.trim();
        if (form.value_lang_en?.trim()) valueLang.en = form.value_lang_en.trim();
        if (form.value_lang_ru?.trim()) valueLang.ru = form.value_lang_ru.trim();
        const metadataText = form.metadata?.trim();
        let metadata: Record<string, unknown> | null = null;
        if (metadataText) {
          try {
            metadata = JSON.parse(metadataText);
          } catch (error) {
            toast.error(t("failed_save"));
            return false;
          }
        }
        const displayOrder = form.display_order?.trim() ? Number(form.display_order) : null;
        setValueSaving(true);
        if (form.id) {
          const { data, error } = await (supabase as any)
            .from("attribute_values")
            .update({
              value: form.value.trim(),
              valueid: form.valueid?.trim() || null,
              display_value: form.display_value?.trim() || null,
              display_order: displayOrder,
              value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
              metadata,
              is_active: form.is_active,
            })
            .eq("id", form.id)
            .select()
            .single();
          if (error) throw new Error(error.message);
          const row = data as AttributeValue;
          setAttributes((prev) =>
            prev.map((attr) =>
              attr.id === attributeId
                ? {
                    ...attr,
                    values: attr.values.map((v) => (v.id === row.id ? { ...v, ...row } : v)),
                  }
                : attr,
            ),
          );
        } else {
          const target = attributes.find((a) => a.id === attributeId);
          const fallbackOrder = target?.values?.length ?? 0;
          const { data, error } = await (supabase as any)
            .from("attribute_values")
            .insert({
              attribute_id: attributeId,
              value: form.value.trim(),
              valueid: form.valueid?.trim() || null,
              display_value: form.display_value?.trim() || null,
              display_order: form.display_order?.trim() ? Number(form.display_order) : fallbackOrder,
              value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
              metadata,
              is_active: form.is_active,
            })
            .select()
            .single();
          if (error) throw new Error(error.message);
          const row = data as AttributeValue;
          setAttributes((prev) =>
            prev.map((attr) => (attr.id === attributeId ? { ...attr, values: [...attr.values, row] } : attr)),
          );
        }
        toast.success(t("value_saved"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      } finally {
        setValueSaving(false);
      }
    },
    [attributes, t],
  );

  const deleteValue = useCallback(
    async (attribute: TemplateAttributeWithValues, value: AttributeValue) => {
      try {
        const { error } = await (supabase as any).from("attribute_values").delete().eq("id", value.id);
        if (error) throw new Error(error.message);
        const remaining = (attribute.values || []).filter((v) => v.id !== value.id);
        const reordered = remaining.map((v, idx) => ({ ...v, display_order: idx }));
        if (reordered.length > 0) {
          await Promise.all(
            reordered.map((v) =>
              (supabase as any).from("attribute_values").update({ display_order: v.display_order }).eq("id", v.id),
            ),
          );
        }
        setAttributes((prev) => prev.map((attr) => (attr.id === attribute.id ? { ...attr, values: reordered } : attr)));
        toast.success(t("value_deleted"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_delete_template"));
        return false;
      }
    },
    [t],
  );

  const duplicateValue = useCallback(
    async (attribute: TemplateAttributeWithValues, value: AttributeValue) => {
      try {
        const displayOrder = (attribute.values || []).length;
        const { data, error } = await (supabase as any)
          .from("attribute_values")
          .insert({
            attribute_id: attribute.id,
            value: value.value,
            valueid: value.valueid ? `${value.valueid}-copy` : null,
            display_value: value.display_value || null,
            display_order: displayOrder,
            value_lang: (value as any).value_lang || null,
            metadata: (value as any).metadata || null,
            is_active: value.is_active ?? true,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        const row = data as AttributeValue;
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === attribute.id ? { ...attr, values: [...attr.values, row] } : attr)),
        );
        toast.success(t("value_saved"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const toggleValueActive = useCallback(
    async (attributeId: number, valueId: number, nextActive: boolean) => {
      try {
        const { error } = await (supabase as any).from("attribute_values").update({ is_active: nextActive }).eq("id", valueId);
        if (error) throw new Error(error.message);
        setAttributes((prev) =>
          prev.map((attr) =>
            attr.id === attributeId
              ? { ...attr, values: attr.values.map((v) => (v.id === valueId ? { ...v, is_active: nextActive } : v)) }
              : attr,
          ),
        );
        toast.success(t("feature_saved_successfully"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const bulkSaveValues = useCallback(
    async ({ attribute, valuesText, prefix, suffix, generateValueId }: BulkValuesInput) => {
      if (!attribute) return false;
      const rawValues = valuesText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (rawValues.length === 0) {
        toast.error(t("failed_save"));
        return false;
      }
      const existing = attributes.find((attr) => attr.id === attribute.id);
      const baseOrder = existing?.values?.length ?? 0;
      const rows = rawValues.map((value, idx) => {
        const trimmedPrefix = prefix.trim();
        const trimmedSuffix = suffix.trim();
        const finalValue = `${trimmedPrefix}${value}${trimmedSuffix}`.trim();
        const generatedValueId = generateValueId ? buildGeneratedValueId(finalValue) : null;
        return {
          attribute_id: attribute.id,
          value: finalValue,
          valueid: generatedValueId || null,
          display_value: null,
          display_order: baseOrder + idx,
          is_active: true,
        };
      });
      try {
        setBulkSaving(true);
        const { data, error } = await (supabase as any).from("attribute_values").insert(rows).select();
        if (error) throw new Error(error.message);
        const inserted = (data || []) as AttributeValue[];
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === attribute.id ? { ...attr, values: [...attr.values, ...inserted] } : attr)),
        );
        toast.success(t("value_saved"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      } finally {
        setBulkSaving(false);
      }
    },
    [attributes, t],
  );

  const reorderAttributes = useCallback(
    async (next: TemplateAttributeWithValues[], template: CategoryTemplate | null) => {
      setAttributes(next);
      if (!template) return;
      try {
        const updates = next.map((a, idx) => ({ id: a.id, display_order: idx }));
        const results = await Promise.all(
          updates.map(async (u) => {
            const { error } = await (supabase as any).from("template_attributes").update({ display_order: u.display_order }).eq("id", u.id);
            return { id: u.id, error };
          }),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw new Error("Failed to update order");
        toast.success(t("attributes_order_updated"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        await loadTemplateDetails(template);
        return false;
      }
    },
    [loadTemplateDetails, t],
  );

  return {
    attributes,
    valueSaving,
    bulkSaving,
    setAttributes,
    loadTemplateDetails,
    addAttribute,
    updateAttribute,
    saveValue,
    deleteValue,
    duplicateValue,
    toggleValueActive,
    bulkSaveValues,
    reorderAttributes,
  };
}
