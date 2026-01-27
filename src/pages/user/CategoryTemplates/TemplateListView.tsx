import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Loader2, Plus, Pencil, Trash2, Copy, CircleCheckBig, MoreVertical, Layers, Folder, FileText, AlignLeft, Power } from "lucide-react";
import type { CategoryTemplateRow } from "./types";
import { useCategories } from "./hooks/useCategories";
import { useTemplateForms } from "./hooks/useTemplateForms";
import { useTemplates } from "./hooks/useTemplates";
import { FormField, SwitchField } from "./components/Fields";

export function TemplateListView() {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategories();
  const { templates, attributeCounts, loadTemplates, createTemplate, deleteTemplate, duplicateTemplate, toggleTemplateActive } = useTemplates(t);
  const { createForm, setCreateForm } = useTemplateForms();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);

  const title = useMemo(() => t("menu_category_templates"), [t]);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadCategories(), loadTemplates()]);
    } catch (error: any) {
      toast.error(error?.message || t("failed_load_menu_item"));
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadTemplates, t]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleCreateTemplate = useCallback(async () => {
    setCreating(true);
    const ok = await createTemplate(createForm);
    if (ok) {
      setCreateDialogOpen(false);
      setCreateForm({ category_id: "", name: "", description: "", is_active: true });
    }
    setCreating(false);
  }, [createForm, createTemplate, setCreateForm]);

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
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("create_template")}
          </Button>
        }
      />
      <Card>
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
          ) : templates.length === 0 ? (
            <div className="flex justify-center">
              <Empty className="border max-w-md">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers />
                  </EmptyMedia>
                  <EmptyTitle>{t("no_templates")}</EmptyTitle>
                  <EmptyDescription>{t("no_templates_description")}</EmptyDescription>
                </EmptyHeader>
                <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("create_template")}
                </Button>
              </Empty>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button variant="ghost" size="icon" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={selectedRowIds.length === 0}
                  onClick={() => {
                    const id = selectedRowIds[0];
                    const tpl = templates.find((r) => r.id === id);
                    if (tpl) openEditor(tpl);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={selectedRowIds.length === 0}
                  onClick={() => {
                    const id = selectedRowIds[0];
                    const tpl = templates.find((r) => r.id === id);
                    if (tpl) openApply(tpl);
                  }}
                >
                  <CircleCheckBig className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={selectedRowIds.length === 0}
                  onClick={() => {
                    const id = selectedRowIds[0];
                    const tpl = templates.find((r) => r.id === id);
                    if (tpl) duplicateTemplate(tpl);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  disabled={selectedRowIds.length === 0}
                  onClick={() => {
                    const ids = selectedRowIds;
                    if (ids.length === 0) return;
                    const tpl = templates.find((r) => r.id === ids[0]);
                    if (tpl) deleteTemplate(tpl);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={templates.length > 0 && selectedRowIds.length === templates.length}
                            onCheckedChange={(v) => {
                              if (v === true) {
                                setSelectedRowIds(templates.map((r) => Number(r.id)));
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
                    {templates.map((tpl) => {
                      const catName = categories.find((c) => String(c.id) === String(tpl.category_id))?.name || String(tpl.category_id);
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
                          <TableCell className="truncate">{catName}</TableCell>
                          <TableCell className="font-medium">{tpl.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{attributeCounts[tpl.id] ?? 0}</TableCell>
                          <TableCell className="truncate text-sm text-muted-foreground">{tpl.description || "—"}</TableCell>
                          <TableCell>
                            <Switch checked={!!tpl.is_active} onCheckedChange={(v) => toggleTemplateActive(tpl, !!v)} />
                          </TableCell>
                          <TableCell className="w-[72px] p-0 align-middle">
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedRowIds([Number(tpl.id)])}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create_template")}</DialogTitle>
            <DialogDescription className="sr-only">{t("create_template")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={t("menu_categories")} htmlFor="ct-category" icon={Folder}>
              <Select value={createForm.category_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, category_id: v }))}>
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
            </FormField>
            <FormField label={t("template_name")} htmlFor="ct-name" icon={FileText}>
              <Input id="ct-name" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField label={t("description")} htmlFor="ct-desc" icon={AlignLeft}>
              <Input id="ct-desc" value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} />
            </FormField>
            <SwitchField
              label={t("status")}
              icon={Power}
              checked={createForm.is_active}
              onCheckedChange={(v) => setCreateForm((p) => ({ ...p, is_active: !!v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreateTemplate} disabled={creating}>
              {creating ? t("please_wait") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
