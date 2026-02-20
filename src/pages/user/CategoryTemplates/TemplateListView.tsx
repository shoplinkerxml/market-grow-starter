import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Form as RHFForm,
  FormControl as RHFFormControl,
  FormField as RHFFormField,
  FormItem as RHFFormItem,
  FormLabel as RHFFormLabel,
  FormMessage as RHFFormMessage,
} from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Copy, CircleCheckBig, MoreVertical, Layers, Folder, FileText, AlignLeft, Power, Save, X } from "lucide-react";
import type { CategoryTemplateRow } from "./types";
import { useCategories } from "./hooks/useCategories";
import { useTemplates } from "./hooks/useTemplates";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import { cache } from "@/lib/cache-helper";
import { createAuthenticatedClient } from "@/lib/session-validation";

export function TemplateListView() {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategories();
  const { templates, attributeCounts, loadTemplates, createTemplate, deleteTemplate, deleteTemplates, duplicateTemplate, toggleTemplateActive } = useTemplates(t);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [productsCount, setProductsCount] = useState(0);

  const createTemplateSchema = z.object({
    category_id: z.string().min(1),
    name: z.string().min(2),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
  });

  const createTemplateForm = useForm<z.infer<typeof createTemplateSchema>>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      category_id: "",
      name: "",
      description: "",
      is_active: true,
    },
  });

  const title = useMemo(() => t("menu_category_templates"), [t]);
  const normalizeKey = useCallback((value: string) => value.trim().toLowerCase(), []);
  const categoriesById = useMemo(
    () =>
      new Map(
        (categories || []).map((c) => [String(c.id), String(c.name || c.external_id || c.id)]),
      ),
    [categories],
  );
  const templatesView = useMemo(() => {
    const seen = new Set<string>();
    const result: CategoryTemplateRow[] = [];
    for (const tpl of templates || []) {
      const catName = categoriesById.get(String(tpl.category_id)) || "";
      const key = `${normalizeKey(catName || String(tpl.category_id))}::${normalizeKey(String(tpl.name || ""))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tpl);
    }
    return result;
  }, [categoriesById, normalizeKey, templates]);

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((id) => templatesView.some((tpl) => Number(tpl.id) === Number(id))));
  }, [templatesView]);

  const loadProductsCount = useCallback(async () => {
    const client = await createAuthenticatedClient();
    const { count, error } = await client.from("store_products").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    setProductsCount(Math.max(0, Number(count ?? 0)));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      cache.clearByPrefix("template:");
      await Promise.all([loadCategories(), loadTemplates(), loadProductsCount()]);
    } catch (error: any) {
      toast.error(error?.message || t("failed_load_menu_item"));
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadProductsCount, loadTemplates, t]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleRefresh = useCallback(async () => {
    cache.clearByPrefix("template:");
    await refreshAll();
  }, [refreshAll]);

  const onCreateSubmit = useCallback(
    async (data: z.infer<typeof createTemplateSchema>) => {
      setCreating(true);
      const ok = await createTemplate({
        category_id: data.category_id,
        name: data.name,
        description: data.description || "",
        is_active: data.is_active,
      });
      if (ok) {
        setCreateDialogOpen(false);
        createTemplateForm.reset({ category_id: "", name: "", description: "", is_active: true });
      }
      setCreating(false);
    },
    [createTemplate, createTemplateForm],
  );

  const openEditor = useCallback(
    (tpl: CategoryTemplateRow) => {
      navigate(`/user/category-templates/${tpl.id}/edit`);
    },
    [navigate],
  );

  const openApply = useCallback(
    (tpl: CategoryTemplateRow) => {
      navigate(`/user/category-templates/${tpl.id}/apply`);
    },
    [navigate],
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={breadcrumbs}
        actions={
          <div className="flex items-center gap-2">
            <RefreshDataButton onRefresh={handleRefresh} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0 border border-border hover:border-emerald-500 hover:text-emerald-600 hover:bg-transparent shadow-none hover:shadow-none"
              title={t("back")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <Card className="bg-transparent border-transparent shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-600" />
            {t("menu_category_templates")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : templatesView.length === 0 ? (
            <div className="flex justify-center">
              <Empty className="border max-w-md bg-transparent">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers />
                  </EmptyMedia>
                  <EmptyTitle>{t("no_templates")}</EmptyTitle>
                  <EmptyDescription>
                    {productsCount === 0 && categories.length === 0
                      ? t("no_templates_add_products")
                      : t("no_templates_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="mt-4"
                  disabled={productsCount === 0 && categories.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("create_template")}
                </Button>
              </Empty>
            </div>
          ) : (
            <div>
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center justify-end gap-2 mb-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCreateDialogOpen(true)}
                        aria-label={t("create_template")}
                        className="text-muted-foreground hover:text-emerald-600 hover:bg-transparent shadow-none hover:shadow-none"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("create_template")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={selectedRowIds.length !== 1}
                        aria-label={t("edit_template")}
                        onClick={() => {
                          const id = selectedRowIds[0];
                          const tpl = templatesView.find((r) => r.id === id);
                          if (tpl) openEditor(tpl);
                        }}
                        className="text-muted-foreground hover:text-emerald-600 hover:bg-transparent shadow-none hover:shadow-none"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("edit_template")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={selectedRowIds.length !== 1}
                        aria-label={t("apply_template")}
                        onClick={() => {
                          const id = selectedRowIds[0];
                          const tpl = templatesView.find((r) => r.id === id);
                          if (tpl) openApply(tpl);
                        }}
                        className="text-muted-foreground hover:text-emerald-600 hover:bg-transparent shadow-none hover:shadow-none"
                      >
                        <CircleCheckBig className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("apply_template")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={selectedRowIds.length !== 1}
                        aria-label={t("duplicate")}
                        onClick={() => {
                          const id = selectedRowIds[0];
                          const tpl = templatesView.find((r) => r.id === id);
                          if (tpl) duplicateTemplate(tpl);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("duplicate")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={selectedRowIds.length === 0}
                        aria-label={t("delete")}
                        onClick={async () => {
                          const ids = selectedRowIds;
                          if (ids.length === 0) return;
                          const ok = await deleteTemplates(ids);
                          if (ok) setSelectedRowIds([]);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("delete")}</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={templatesView.length > 0 && selectedRowIds.length === templatesView.length}
                            onCheckedChange={(v) => {
                              if (v === true) {
                                setSelectedRowIds(templatesView.map((r) => Number(r.id)));
                              } else {
                                setSelectedRowIds([]);
                              }
                            }}
                          />
                        </div>
                      </TableHead>
                      <TableHead>{t("menu_categories")}</TableHead>
                      <TableHead>{t("menu_product_templates")}</TableHead>
                      <TableHead>{t("attributes")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="w-[72px] text-center">{t("table_actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesView.map((tpl) => {
                      const catName = categoriesById.get(String(tpl.category_id)) || String(tpl.category_id);
                      return (
                        <TableRow key={tpl.id} className={selectedRowIds.includes(Number(tpl.id)) ? "bg-muted/40" : ""}>
                          <TableCell className="p-2 align-middle">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selectedRowIds.includes(Number(tpl.id))}
                                onCheckedChange={(v) => {
                                  setSelectedRowIds((prev) => {
                                    const id = Number(tpl.id);
                                    const included = prev.includes(id);
                                    if (v === true && !included) return [...prev, id];
                                    if (v === false && included) return prev.filter((x) => x !== id);
                                    return prev;
                                  });
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="truncate">
                            <button
                              type="button"
                              className="text-left font-medium break-words line-clamp-2 w-full transition-colors hover:text-emerald-600 hover:font-semibold"
                              title={catName}
                              onClick={() => openEditor(tpl)}
                            >
                              {catName}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">{tpl.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{attributeCounts[tpl.id] ?? 0}</TableCell>
                          <TableCell className="truncate text-sm text-muted-foreground">{tpl.description || "—"}</TableCell>
                          <TableCell>
                            <Switch checked={!!tpl.is_active} onCheckedChange={(v) => toggleTemplateActive(tpl, !!v)} />
                          </TableCell>
                          <TableCell className="w-[72px] p-0 align-middle">
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          aria-label={t("table_actions")}
                                          onClick={() => setSelectedRowIds([Number(tpl.id)])}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">{t("table_actions")}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditor(tpl)} className="cursor-pointer">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {t("edit_template")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openApply(tpl)} className="cursor-pointer">
                                    <CircleCheckBig className="mr-2 h-4 w-4" />
                                    {t("apply_template")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicateTemplate(tpl)} className="cursor-pointer">
                                    <Copy className="mr-2 h-4 w-4" />
                                    {t("duplicate")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => deleteTemplate(tpl)} className="cursor-pointer focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t("delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto w-[calc(100%-1rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("create_template")}</DialogTitle>
            <DialogDescription className="sr-only">{t("create_template")}</DialogDescription>
          </DialogHeader>
          <RHFForm {...createTemplateForm}>
            <form onSubmit={createTemplateForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <RHFFormField
                control={createTemplateForm.control}
                name="category_id"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Folder className="h-4 w-4 text-emerald-600" />
                      {t("menu_categories")} *
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="ct-category">
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
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={createTemplateForm.control}
                name="name"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      {t("template_name")} *
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input id="ct-name" placeholder="Напр.: Шаблон смартфонів" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={createTemplateForm.control}
                name="description"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <AlignLeft className="h-4 w-4 text-emerald-600" />
                      {t("description")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input id="ct-desc" placeholder="Напр.: Атрибути для категорії" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={createTemplateForm.control}
                name="is_active"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Power className="h-4 w-4 text-emerald-600" />
                      {t("status")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm font-medium">{t("status")}</span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </div>
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={creating}>
                  <Save className="h-4 w-4 mr-2" />
                  {creating ? t("please_wait") : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </RHFForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
