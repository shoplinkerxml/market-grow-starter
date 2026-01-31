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
import { ArrowLeft, Check, Layers, PencilLine, X } from "lucide-react";
import type { CategoryTemplate } from "@/lib/category-template";
import { getTemplateAttributes } from "@/lib/category-template";
import { createAuthenticatedClient } from "@/lib/session-validation";
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
  const [applyOverwriteExisting, setApplyOverwriteExisting] = useState(true);
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

  const applyMissingAttributes = useCallback(
    async (templateId: number, categoryId: number) => {
      const attrs = await getTemplateAttributes(templateId);
      const activeAttrs = attrs.filter((attr) => attr.is_active !== false);
      if (activeAttrs.length === 0) return 0;
      const authenticatedClient = await createAuthenticatedClient();
      const { data: products, error: productsError } = await authenticatedClient
        .from("store_products")
        .select("id")
        .eq("category_id", categoryId);
      if (productsError) throw productsError;
      const productIds = (products || [])
        .map((row: { id?: string | number | null }) => (row?.id != null ? String(row.id) : ""))
        .filter((id: string) => id.length > 0);
      if (productIds.length === 0) return 0;
      const existingByProduct = new Map<string, { maxOrder: number; keys: Set<string> }>();
      const paramsChunkSize = 200;
      for (let i = 0; i < productIds.length; i += paramsChunkSize) {
        const batch = productIds.slice(i, i + paramsChunkSize);
        const { data: params, error: paramsError } = await authenticatedClient
          .from("store_product_params")
          .select("product_id,name,paramid,order_index")
          .in("product_id", batch);
        if (paramsError) throw paramsError;
        for (const row of params || []) {
          const pid = row?.product_id != null ? String(row.product_id) : "";
          if (!pid) continue;
          const key = row?.paramid ? `paramid:${String(row.paramid)}` : `name:${String(row?.name ?? "")}`;
          const rawOrder = typeof row?.order_index === "number" ? row.order_index : Number(row?.order_index);
          const order = Number.isFinite(rawOrder) ? rawOrder : -1;
          let entry = existingByProduct.get(pid);
          if (!entry) {
            entry = { maxOrder: -1, keys: new Set<string>() };
            existingByProduct.set(pid, entry);
          }
          if (key) entry.keys.add(key);
          if (order > entry.maxOrder) entry.maxOrder = order;
        }
      }
      for (const pid of productIds) {
        if (!existingByProduct.has(pid)) {
          existingByProduct.set(pid, { maxOrder: -1, keys: new Set<string>() });
        }
      }
      const rows: Array<{
        product_id: string;
        name: string;
        value: string;
        paramid: string | null;
        valueid: string | null;
        order_index: number;
      }> = [];
      for (const pid of productIds) {
        const entry = existingByProduct.get(pid);
        if (!entry) continue;
        for (const attr of activeAttrs) {
          const name = String(attr.name || "").trim();
          if (!name) continue;
          const key = attr.paramid ? `paramid:${String(attr.paramid)}` : `name:${name}`;
          if (entry.keys.has(key)) continue;
          const options = Array.isArray(attr.values) ? attr.values : [];
          const defaultOption = attr.default_value ? options.find((o) => o.value === attr.default_value) : options[0];
          const value = defaultOption?.value || attr.default_value || "";
          const valueid = defaultOption?.valueid ?? null;
          const nextOrder = entry.maxOrder + 1;
          entry.maxOrder = nextOrder;
          entry.keys.add(key);
          rows.push({
            product_id: pid,
            name,
            value,
            paramid: attr.paramid ? String(attr.paramid) : null,
            valueid: valueid != null ? String(valueid) : null,
            order_index: nextOrder,
          });
        }
      }
      if (rows.length === 0) return 0;
      const insertChunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += insertChunkSize) {
        const slice = rows.slice(i, i + insertChunkSize);
        const { error: insertError } = await authenticatedClient.from("store_product_params").insert(slice);
        if (insertError) throw insertError;
        inserted += slice.length;
      }
      return inserted;
    },
    [],
  );

  const handleApplyTemplateAction = useCallback(async () => {
    if (!selectedTemplate || !applyCategoryId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const createdCount = await applyTemplateToCategory(selectedTemplate.id, Number(applyCategoryId));
      if (createdCount == null) return;
      const extraCount = await applyMissingAttributes(selectedTemplate.id, Number(applyCategoryId));
      setApplyResult(`${createdCount + extraCount}`);
      await refreshPreview(selectedTemplate, applyCategoryId);
    } finally {
      setApplying(false);
    }
  }, [applyCategoryId, applyMissingAttributes, applyTemplateToCategory, refreshPreview, selectedTemplate]);

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
        <Button
          variant="ghost"
          onClick={() => navigate("/user/category-templates")}
          className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
          title={t("back")}
        >
          <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-7 h-7 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
            <ArrowLeft className="h-4 w-4" />
          </span>
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
            <Button
              variant="ghost"
              onClick={() => navigate("/user/category-templates")}
              className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
              title={t("back")}
            >
              <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-7 h-7 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/user/category-templates/${selectedTemplate.id}/edit`)}
              className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
              title={t("edit_template")}
              aria-label={t("edit_template")}
            >
              <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-7 h-7 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                <PencilLine className="h-4 w-4" />
              </span>
            </Button>
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
                <Switch checked={applyOverwriteExisting} onCheckedChange={(v) => setApplyOverwriteExisting(!!v)} />
                <span className="text-sm">{t("apply_overwrite_existing")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={applyToExisting} onCheckedChange={(v) => setApplyToExisting(!!v)} />
                <span className="text-sm">{t("apply_to_existing_products")}</span>
              </div>
            </div>
          </div>
          <div className="rounded-md border p-4 space-y-2">
            <div className="text-sm font-medium">Превʼю</div>
            <div className="text-sm text-muted-foreground">
              {t("apply_preview_apply_to")} {applyPreview.products} {t("apply_preview_products_in_category")} {catName}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("apply_preview_attributes_created")}: {applyPreview.attributes} • {t("apply_preview_required")}: {applyPreview.required} • {t("apply_preview_optional")}: {applyPreview.optional}
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
              <X className="h-4 w-4" />
              {t("cancel")}
            </Button>
            <Button onClick={handleApplyTemplateAction} disabled={applying || !applyCategoryId}>
              <Check className="h-4 w-4" />
              {applying ? t("please_wait") : t("apply_template")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
