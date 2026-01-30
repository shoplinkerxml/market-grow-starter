import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Layers } from "lucide-react";
import type { CategoryTemplate } from "@/lib/category-template";
import type { ApplyPreview } from "./types";
import { useCategories } from "./hooks/useCategories";
import { useTemplates } from "./hooks/useTemplates";

type TemplateApplyViewProps = {
  templateId: number;
};

const emptyPreview: ApplyPreview = {
  products: 0,
  attributes: 0,
  required: 0,
  optional: 0,
};

export function TemplateApplyView({ templateId }: TemplateApplyViewProps) {
  const { t } = useI18n();
  const breadcrumbsBase = useBreadcrumbs();
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategories();
  const { getTemplateById, getApplyPreview, applyTemplateToCategory } = useTemplates(t);
  const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCategoryId, setApplyCategoryId] = useState<string>("");
  const [applyOnlyRequired, setApplyOnlyRequired] = useState(true);
  const [applyOverwriteExisting, setApplyOverwriteExisting] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [applyPreview, setApplyPreview] = useState<ApplyPreview>(emptyPreview);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState(0);

  const computedBreadcrumbs = useMemo(() => {
    const catName =
      categories.find((c) => String(c.id) === String(selectedTemplate?.category_id))?.name ||
      (selectedTemplate ? String(selectedTemplate.category_id) : "");
    const items = [
      { label: t("breadcrumb_home"), href: "/user/dashboard" },
      { label: t("menu_directories"), href: "/user/directory" },
      { label: t("menu_category_templates"), href: "/user/category-templates" },
    ] as Array<{ label: string; href?: string; current?: boolean }>;
    if (catName) {
      items.push({ label: catName, href: "/user/category-templates" });
    }
    return items;
  }, [categories, selectedTemplate, t]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        setLoading(true);
        await loadCategories();
        const tpl = await getTemplateById(templateId);
        if (!isActive) return;
        setSelectedTemplate(tpl as CategoryTemplate);
        setApplyCategoryId(String((tpl as any).category_id || ""));
      } catch (e: any) {
        toast.error(e?.message || t("operation_failed"));
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [getTemplateById, loadCategories, t, templateId]);

  const refreshPreview = useCallback(
    async (tpl: CategoryTemplate | null, categoryId: string | null) => {
      if (!tpl || !categoryId) {
        setApplyPreview(emptyPreview);
        return;
      }
      const preview = await getApplyPreview(tpl.id, Number(categoryId));
      if (preview) {
        setApplyPreview(preview);
      } else {
        setApplyPreview(emptyPreview);
      }
    },
    [getApplyPreview],
  );

  useEffect(() => {
    void refreshPreview(selectedTemplate, applyCategoryId);
  }, [applyCategoryId, refreshPreview, selectedTemplate]);

  useEffect(() => {
    if (!applying) {
      setApplyProgress(0);
      return;
    }
    setApplyProgress(10);
    const interval = window.setInterval(() => {
      setApplyProgress((prev) => {
        const next = prev + 10;
        return next >= 90 ? 90 : next;
      });
    }, 500);
    return () => window.clearInterval(interval);
  }, [applying]);

  const handleApplyTemplateAction = useCallback(async () => {
    if (!selectedTemplate || !applyCategoryId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const createdCount = await applyTemplateToCategory(selectedTemplate.id, Number(applyCategoryId));
      if (createdCount == null) return;
      setApplyResult(`${createdCount}`);
      await refreshPreview(selectedTemplate, applyCategoryId);
    } finally {
      setApplying(false);
    }
  }, [applyCategoryId, applyTemplateToCategory, refreshPreview, selectedTemplate]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-48">
          <Layers className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate("/user/category-templates")}>
          {t("back")}
        </Button>
      </div>
    );
  }

  const catName =
    categories.find((c) => String(c.id) === String(applyCategoryId))?.name ||
    categories.find((c) => String(c.id) === String(selectedTemplate.category_id))?.name ||
    String(applyCategoryId || selectedTemplate.category_id);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("apply_template")}
        breadcrumbItems={computedBreadcrumbs}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/user/category-templates")}>
              {t("back")}
            </Button>
            <Button onClick={() => navigate(`/user/category-templates/${selectedTemplate.id}/edit`)}>{t("edit_template")}</Button>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-600" />
            {selectedTemplate.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>{t("menu_categories")}</Label>
              <Select value={applyCategoryId || String(selectedTemplate.category_id || "")} onValueChange={setApplyCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("menu_categories")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || c.external_id || String(c.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>{t("settings")}</Label>
              <div className="flex items-center gap-2">
                <Switch checked={applyOnlyRequired} onCheckedChange={(v) => setApplyOnlyRequired(!!v)} />
                <span className="text-sm">Тільки обовʼязкові параметри</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={applyOverwriteExisting} onCheckedChange={(v) => setApplyOverwriteExisting(!!v)} />
                <span className="text-sm">Перезаписати існуючі</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={applyToExisting} onCheckedChange={(v) => setApplyToExisting(!!v)} />
                <span className="text-sm">Застосувати до існуючих товарів</span>
              </div>
            </div>
          </div>
          <div className="rounded-md border p-4 space-y-2">
            <div className="text-sm font-medium">Превʼю</div>
            <div className="text-sm text-muted-foreground">
              Буде застосовано до {applyPreview.products} товарів у категорії {catName}
            </div>
            <div className="text-sm text-muted-foreground">
              Буде створено характеристик: {applyPreview.attributes} • Обовʼязкових: {applyPreview.required} • Опціональних: {applyPreview.optional}
            </div>
          </div>
          {applying ? (
            <div className="space-y-2">
              <Progress value={applyProgress} className="h-3" />
              <div className="text-xs text-muted-foreground">{t("applying_template")}</div>
            </div>
          ) : applyResult ? (
            <div className="rounded-md border p-3 text-sm">Створено параметрів: {applyResult}</div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/user/category-templates")}>
              {t("cancel")}
            </Button>
            <Button onClick={handleApplyTemplateAction} disabled={applying || !applyCategoryId}>
              {applying ? t("please_wait") : t("apply_template")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
