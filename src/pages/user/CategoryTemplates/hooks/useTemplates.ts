import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  applyTemplate,
  createTemplate as createTemplateApi,
  deleteTemplate as deleteTemplateApi,
  duplicateTemplate as duplicateTemplateApi,
  getApplyPreview as getApplyPreviewApi,
  getTemplate as getTemplateApi,
  listAttributeCounts,
  listTemplates,
  toggleTemplate,
  updateTemplate as updateTemplateApi,
} from "@/lib/category-template";
import type { CategoryTemplate } from "@/lib/category-template";
import type { ApplyPreview, CategoryTemplateRow, CreateTemplateForm } from "../types";

type Translator = (key: string) => string;

export function useTemplates(t: Translator) {
  const [templates, setTemplates] = useState<CategoryTemplateRow[]>([]);
  const [attributeCounts, setAttributeCounts] = useState<Record<number, number>>({});
  const loadTemplatesRequestIdRef = useRef(0);

  const getErrorMessage = useCallback(
    (error: unknown, fallbackKey: string) => {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "";
      const normalized = message.toLowerCase();
      const knownMappings: Array<{ match: string; key: string }> = [
        { match: "could not find the function public.apply_template_to_products", key: "apply_template_function_missing" },
        { match: "failed to load preview", key: "operation_failed" },
        { match: "failed to apply template", key: "failed_save" },
        { match: "failed to load templates", key: "operation_failed" },
        { match: "failed to load template", key: "operation_failed" },
        { match: "failed to create template", key: "failed_save_template" },
        { match: "failed to update template", key: "failed_save_template" },
        { match: "failed to delete template", key: "failed_delete_template" },
      ];
      const mappedKey = knownMappings.find((item) => normalized.includes(item.match))?.key;
      if (mappedKey) return t(mappedKey);
      return message || t(fallbackKey);
    },
    [t],
  );

  const loadTemplates = useCallback(async () => {
    loadTemplatesRequestIdRef.current += 1;
    const requestId = loadTemplatesRequestIdRef.current;
    const rows = (await listTemplates()) as CategoryTemplateRow[];
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    setTemplates(rows);
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      const map = await listAttributeCounts(ids);
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
      try {
        return (await getTemplateApi(id)) as CategoryTemplate;
      } catch (error) {
        throw new Error(getErrorMessage(error, "operation_failed"));
      }
    },
    [getErrorMessage, templates],
  );

  const createTemplate = useCallback(
    async (form: CreateTemplateForm) => {
      if (!form.category_id || !form.name.trim()) {
        toast.error(t("failed_save"));
        return false;
      }
      try {
        await createTemplateApi({
          category_id: Number(form.category_id),
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_active: form.is_active,
        });
        await loadTemplates();
        toast.success(t("template_saved"));
        return true;
      } catch (error: any) {
        toast.error(getErrorMessage(error, "failed_save"));
        return false;
      }
    },
    [getErrorMessage, loadTemplates, t],
  );

  const updateTemplate = useCallback(
    async (id: number, form: { category_id: string; name: string; description: string }) => {
      try {
        const updated = await updateTemplateApi(id, {
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
        toast.error(getErrorMessage(error, "failed_save"));
        return false;
      }
    },
    [getErrorMessage, t],
  );

  const deleteTemplate = useCallback(
    async (tpl: CategoryTemplate) => {
      try {
        await deleteTemplateApi(tpl.id);
        await loadTemplates();
        toast.success(t("template_deleted"));
        return true;
      } catch (error: any) {
        toast.error(getErrorMessage(error, "failed_delete_template"));
        return false;
      }
    },
    [getErrorMessage, loadTemplates, t],
  );

  const duplicateTemplate = useCallback(
    async (tpl: CategoryTemplateRow) => {
      try {
        await duplicateTemplateApi(tpl);
        await loadTemplates();
        toast.success(t("duplicate_tariff"));
        return true;
      } catch (e: any) {
        toast.error(getErrorMessage(e, "failed_save"));
        return false;
      }
    },
    [getErrorMessage, loadTemplates, t],
  );

  const toggleTemplateActive = useCallback(
    async (tpl: CategoryTemplateRow, active: boolean) => {
      try {
        await toggleTemplate(tpl.id, active);
        setTemplates((prev) => prev.map((r) => (r.id === tpl.id ? { ...r, is_active: active } : r)));
        toast.success(t("currency_status_updated"));
        return true;
      } catch (e: any) {
        toast.error(getErrorMessage(e, "failed_save"));
        return false;
      }
    },
    [getErrorMessage, t],
  );

  const getApplyPreview = useCallback(
    async (templateId: number, categoryId: number) => {
      try {
        return (await getApplyPreviewApi(templateId, categoryId)) as ApplyPreview;
      } catch (error: any) {
        toast.error(getErrorMessage(error, "operation_failed"));
        return null;
      }
    },
    [getErrorMessage],
  );

  const applyTemplateToCategory = useCallback(
    async (templateId: number, categoryId: number) => {
      try {
        return await applyTemplate(templateId, categoryId);
      } catch (error: any) {
        toast.error(getErrorMessage(error, "failed_save"));
        return null;
      }
    },
    [getErrorMessage],
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
