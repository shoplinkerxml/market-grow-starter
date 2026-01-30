import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AttributeValueService, CategoryTemplateService, TemplateAttributeService } from "@/lib/template-service";
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
    const rows = await CategoryTemplateService.getTemplateAttributes(tpl.id);
    setAttributes(rows.map((a) => ({ ...a, values: a.values || [] })));
  }, []);

  const addAttribute = useCallback(
    async (templateId: number, form: AttributeForm) => {
      if (!form.name.trim()) {
        toast.error(t("failed_save"));
        return false;
      }
      try {
        const row = await TemplateAttributeService.createAttribute(
          templateId,
          {
            name: form.name,
            paramid: form.paramid,
            attribute_type: form.attribute_type,
            is_required: form.is_required,
            unit: form.unit,
            default_value: form.default_value,
            is_filterable: form.is_filterable,
            is_active: form.is_active,
          },
          attributes.length,
        );
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
        const updated = await TemplateAttributeService.updateAttribute(attrId, updates);
        setAttributes((prev) => prev.map((row) => (row.id === attrId ? { ...row, ...updated } : row)));
        toast.success(t("feature_saved_successfully"));
        return true;
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
        return false;
      }
    },
    [t],
  );

  const deleteAttribute = useCallback(
    async (attribute: TemplateAttributeWithValues) => {
      try {
        const next = attributes
          .filter((attr) => attr.id !== attribute.id)
          .map((attr, idx) => ({ ...attr, display_order: idx }));
        await TemplateAttributeService.deleteAttribute(attribute.id);
        setAttributes(next);
        await TemplateAttributeService.reorderAttributes(
          next.map((row) => ({
            id: row.id,
            display_order: row.display_order ?? 0,
            template_id: row.template_id,
            name: row.name,
            attribute_type: row.attribute_type,
            is_required: row.is_required,
            unit: row.unit,
            default_value: row.default_value,
            is_filterable: row.is_filterable,
            is_active: row.is_active,
            paramid: row.paramid,
          })),
        );
        toast.success(t("attribute_deleted"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_delete_template"));
        return false;
      }
    },
    [attributes, t],
  );

  const duplicateAttribute = useCallback(
    async (attribute: TemplateAttributeWithValues) => {
      try {
        const newAttr = await TemplateAttributeService.createAttribute(
          attribute.template_id,
          {
            name: `${attribute.name} (копія)`,
            paramid: attribute.paramid || undefined,
            attribute_type: attribute.attribute_type,
            is_required: attribute.is_required ?? false,
            unit: attribute.unit || undefined,
            default_value: attribute.default_value || undefined,
            is_filterable: attribute.is_filterable ?? true,
            is_active: attribute.is_active ?? true,
          },
          attributes.length,
        );
        let newValues: AttributeValue[] = [];
        if (attribute.values.length > 0) {
          const rows = attribute.values.map((value, idx) => ({
            attribute_id: newAttr.id,
            value: value.value,
            valueid: value.valueid ? `${value.valueid}-copy` : null,
            display_value: value.display_value || null,
            display_order: idx,
            value_lang: (value as any).value_lang || null,
            metadata: (value as any).metadata || null,
            is_active: value.is_active ?? true,
          }));
          newValues = await AttributeValueService.bulkCreateValues(rows);
        }
        setAttributes((prev) => [...prev, { ...newAttr, values: newValues }]);
        toast.success(t("attribute_duplicated"));
        return true;
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        return false;
      }
    },
    [attributes.length, t],
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
          const row = await AttributeValueService.updateValue(form.id, {
            value: form.value.trim(),
            valueid: form.valueid?.trim() || null,
            display_value: form.display_value?.trim() || null,
            display_order: displayOrder,
            value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
            metadata,
            is_active: form.is_active,
          });
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
          const row = await AttributeValueService.createValue({
            attribute_id: attributeId,
            value: form.value.trim(),
            valueid: form.valueid?.trim() || null,
            display_value: form.display_value?.trim() || null,
            display_order: form.display_order?.trim() ? Number(form.display_order) : fallbackOrder,
            value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
            metadata,
            is_active: form.is_active,
          });
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
        await AttributeValueService.deleteValue(value.id);
        const remaining = (attribute.values || []).filter((v) => v.id !== value.id);
        const reordered = remaining.map((v, idx) => ({ ...v, display_order: idx }));
        if (reordered.length > 0) {
          await AttributeValueService.reorderValues(reordered.map((v) => ({ id: v.id, display_order: v.display_order ?? 0 })));
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
        const row = await AttributeValueService.duplicateValue({
          attribute_id: attribute.id,
          value: value.value,
          valueid: value.valueid ? `${value.valueid}-copy` : null,
          display_value: value.display_value || null,
          display_order: displayOrder,
          value_lang: (value as any).value_lang || null,
          metadata: (value as any).metadata || null,
          is_active: value.is_active ?? true,
        });
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
        await AttributeValueService.toggleValueActive(valueId, nextActive);
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
        const inserted = await AttributeValueService.bulkCreateValues(rows);
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
        const updates = next.map((a, idx) => ({
          id: a.id,
          display_order: idx,
          template_id: a.template_id,
          name: a.name,
          attribute_type: a.attribute_type,
          is_required: a.is_required,
          unit: a.unit,
          default_value: a.default_value,
          is_filterable: a.is_filterable,
          is_active: a.is_active,
          paramid: a.paramid,
        }));
        await TemplateAttributeService.reorderAttributes(updates);
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
    deleteAttribute,
    duplicateAttribute,
    saveValue,
    deleteValue,
    duplicateValue,
    toggleValueActive,
    bulkSaveValues,
    reorderAttributes,
  };
}
