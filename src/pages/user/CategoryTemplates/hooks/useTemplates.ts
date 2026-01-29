import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryTemplateService } from "@/lib/template-service";
import type { CategoryTemplate } from "@/lib/template-service";
import type { ApplyPreview, CategoryTemplateRow, CreateTemplateForm } from "../types";

type Translator = (key: string) => string;

export function useTemplates(t: Translator) {
  const [templates, setTemplates] = useState<CategoryTemplateRow[]>([]);
  const [attributeCounts, setAttributeCounts] = useState<Record<number, number>>({});
  const loadTemplatesRequestIdRef = useRef(0);

  const loadTemplates = useCallback(async () => {
    loadTemplatesRequestIdRef.current += 1;
    const requestId = loadTemplatesRequestIdRef.current;
    const rows = (await CategoryTemplateService.listTemplates()) as CategoryTemplateRow[];
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    setTemplates(rows);
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      const map = await CategoryTemplateService.listAttributeCounts(ids);
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      setAttributeCounts(map);
    } else {
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      setAttributeCounts({});
    }
  }, []);

  const getTemplateById = useCallback(
    async (id: number) => {
      const found = templates.find((tpl) => Number(tpl.id) === id);
      if (found) return found;
      return (await CategoryTemplateService.getTemplateById(id)) as CategoryTemplate;
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
        await CategoryTemplateService.createTemplate({
          category_id: Number(form.category_id),
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
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
        const updated = await CategoryTemplateService.updateTemplate(id, {
          category_id: Number(form.category_id),
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        setTemplates((prev) =>
          prev.map((tpl) =>
            tpl.id === id
              ? { ...tpl, category_id: updated.category_id, name: updated.name, description: updated.description ?? null }
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
        await CategoryTemplateService.deleteTemplate(tpl.id);
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
        await CategoryTemplateService.duplicateTemplate(tpl);
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
        await CategoryTemplateService.toggleTemplateActive(tpl.id, active);
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
        return (await CategoryTemplateService.getApplyPreview(templateId, categoryId)) as ApplyPreview;
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
        return await CategoryTemplateService.applyTemplateToCategory(templateId, categoryId);
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
