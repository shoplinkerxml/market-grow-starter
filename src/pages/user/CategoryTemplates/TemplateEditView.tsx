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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form as RHFForm,
  FormControl as RHFFormControl,
  FormField as RHFFormField,
  FormItem as RHFFormItem,
  FormLabel as RHFFormLabel,
  FormMessage as RHFFormMessage,
} from "@/components/ui/form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Check,
  CheckCircle2,
  Hash,
  Layers,
  List,
  Plus,
  Ruler,
  Eye,
  KeyRound,
  Type,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Tag,
  Save,
  X,
} from "lucide-react";
import type { AttributeValue, CategoryTemplate, TemplateAttribute } from "@/lib/category-template";
import { FormField, SwitchField } from "./components/Fields";
import { SortableAttributeRow } from "./components/SortableAttributeRow";
import { useCategories } from "./hooks/useCategories";
import { useTemplateAttributes } from "./hooks/useTemplateAttributes";
import { useTemplates } from "./hooks/useTemplates";
import type { AttributeForm } from "./types";

type TemplateEditViewProps = {
  templateId: number;
};

const editTemplateSchema = z.object({
  category_id: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
});

const valueSchema = z.object({
  id: z.number().optional(),
  attribute_id: z.number().optional(),
  value: z.string().min(1),
  valueid: z.string().optional(),
  display_value: z.string().optional(),
  display_order: z.string().optional(),
  value_lang_uk: z.string().optional(),
  value_lang_en: z.string().optional(),
  value_lang_ru: z.string().optional(),
  metadata: z.string().optional(),
  is_active: z.boolean().default(true),
});

const bulkValuesSchema = z.object({
  valuesText: z.string().min(1),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  generateValueId: z.boolean().default(true),
});

export function TemplateEditView({ templateId }: TemplateEditViewProps) {
  const { t } = useI18n();
  const breadcrumbsBase = useBreadcrumbs();
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategories();
  const { getTemplateById, updateTemplate } = useTemplates(t);
  const {
    attributes,
    valueSaving,
    bulkSaving,
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
  } = useTemplateAttributes(t);
  const [attrForm, setAttrForm] = useState<AttributeForm>({
    name: "",
    paramid: "",
    attribute_type: "select",
    is_required: false,
    unit: "",
    default_value: "",
    is_filterable: true,
    is_active: true,
  });
  const [bulkAttribute, setBulkAttribute] = useState<TemplateAttribute | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [attrDialogOpen, setAttrDialogOpen] = useState(false);
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const editForm = useForm<z.infer<typeof editTemplateSchema>>({
    resolver: zodResolver(editTemplateSchema),
    defaultValues: {
      category_id: "",
      name: "",
      description: "",
    },
  });

  const valueForm = useForm<z.infer<typeof valueSchema>>({
    resolver: zodResolver(valueSchema),
    defaultValues: {
      value: "",
      valueid: "",
      display_value: "",
      display_order: "",
      value_lang_uk: "",
      value_lang_en: "",
      value_lang_ru: "",
      metadata: "",
      is_active: true,
    },
  });

  const bulkForm = useForm<z.infer<typeof bulkValuesSchema>>({
    resolver: zodResolver(bulkValuesSchema),
    defaultValues: {
      valuesText: "",
      prefix: "",
      suffix: "",
      generateValueId: true,
    },
  });

  useEffect(() => {
    valueForm.register("id");
    valueForm.register("attribute_id");
    valueForm.register("display_order");
    valueForm.register("value_lang_uk");
    valueForm.register("value_lang_en");
    valueForm.register("value_lang_ru");
    valueForm.register("metadata");
    valueForm.register("is_active");
  }, [valueForm]);

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
        editForm.reset({
          category_id: String((tpl as any).category_id || ""),
          name: String((tpl as any).name || ""),
          description: String((tpl as any).description || ""),
        });
        await loadTemplateDetails(tpl as CategoryTemplate);
      } catch (e: any) {
        toast.error(e?.message || t("operation_failed"));
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [editForm, getTemplateById, loadCategories, loadTemplateDetails, t, templateId]);

  const onEditSubmit = useCallback(
    async (data: z.infer<typeof editTemplateSchema>) => {
      if (!selectedTemplate) return;
      const ok = await updateTemplate(selectedTemplate.id, {
        ...data,
        description: data.description || "",
      });
      if (ok) {
        setSelectedTemplate((prev) =>
          prev
            ? {
                ...prev,
                category_id: Number(data.category_id),
                name: data.name.trim(),
                description: data.description?.trim() || null,
              }
            : prev,
        );
      }
    },
    [selectedTemplate, updateTemplate],
  );

  const handleAddAttribute = useCallback(async () => {
    if (!selectedTemplate) return;
    const ok = await addAttribute(selectedTemplate.id, attrForm);
    if (ok) {
      setAttrDialogOpen(false);
      setAttrForm({
        name: "",
        paramid: "",
        attribute_type: "select",
        is_required: false,
        unit: "",
        default_value: "",
        is_filterable: true,
        is_active: true,
      });
    }
  }, [addAttribute, attrForm, selectedTemplate, setAttrForm]);

  const openAddValueDialog = useCallback((attribute: TemplateAttribute) => {
    valueForm.reset({
      attribute_id: attribute.id,
      value: "",
      valueid: "",
      display_value: "",
      display_order: "",
      value_lang_uk: "",
      value_lang_en: "",
      value_lang_ru: "",
      metadata: "",
      is_active: true,
    });
    setValueDialogOpen(true);
  }, [valueForm]);

  const openBulkAddValueDialog = useCallback((attribute: TemplateAttribute) => {
    setBulkAttribute(attribute);
    bulkForm.reset({
      valuesText: "",
      prefix: "",
      suffix: "",
      generateValueId: true,
    });
    setBulkDialogOpen(true);
  }, [bulkForm]);

  const openEditValueDialog = useCallback((attribute: TemplateAttribute, value: AttributeValue) => {
    const lang = (value as any).value_lang || {};
    valueForm.reset({
      id: value.id,
      attribute_id: attribute.id,
      value: value.value,
      valueid: value.valueid || "",
      display_value: value.display_value || "",
      display_order: value.display_order != null ? String(value.display_order) : "",
      value_lang_uk: lang.uk || "",
      value_lang_en: lang.en || "",
      value_lang_ru: lang.ru || "",
      metadata: (value as any).metadata ? JSON.stringify((value as any).metadata) : "",
      is_active: value.is_active ?? true,
    });
    setValueDialogOpen(true);
  }, [valueForm]);

  const onValueSubmit = useCallback(
    async (data: z.infer<typeof valueSchema>) => {
      const ok = await saveValue(data);
      if (ok) {
        setValueDialogOpen(false);
        valueForm.reset({
          value: "",
          valueid: "",
          display_value: "",
          display_order: "",
          value_lang_uk: "",
          value_lang_en: "",
          value_lang_ru: "",
          metadata: "",
          is_active: true,
        });
      }
    },
    [saveValue, valueForm],
  );

  const onBulkSubmit = useCallback(
    async (data: z.infer<typeof bulkValuesSchema>) => {
      if (!bulkAttribute) {
        toast.error(t("failed_save"));
        return;
      }
      const ok = await bulkSaveValues({
        attribute: bulkAttribute,
        valuesText: data.valuesText,
        prefix: data.prefix || "",
        suffix: data.suffix || "",
        generateValueId: data.generateValueId,
      });
      if (ok) {
        setBulkDialogOpen(false);
        bulkForm.reset({
          valuesText: "",
          prefix: "",
          suffix: "",
          generateValueId: true,
        });
      }
    },
    [bulkAttribute, bulkForm, bulkSaveValues, t],
  );

  const handleAttrsDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = attributes.findIndex((a) => a.id === active.id);
      const newIndex = attributes.findIndex((a) => a.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = attributes.slice();
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      await reorderAttributes(next, selectedTemplate);
    },
    [attributes, reorderAttributes, selectedTemplate],
  );

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

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("menu_category_templates")}
        breadcrumbItems={computedBreadcrumbs}
        actions={
          <div className="flex items-center gap-2 justify-end flex-nowrap">
            <Button variant="outline" onClick={() => navigate("/user/category-templates")}>
              {t("back")}
            </Button>
            <Button onClick={() => setAttrDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("btn_add")}
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
        <CardContent>
          <RHFForm {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 mb-6 items-end"
            >
              <RHFFormField
                control={editForm.control}
                name="category_id"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel>{t("menu_categories")} *</RHFFormLabel>
                    <RHFFormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="tpl-category">
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
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel>{t("menu_product_templates")} *</RHFFormLabel>
                    <RHFFormControl>
                      <Input id="tpl-name" placeholder="Напр.: Шаблон смартфонів" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel>{t("description")}</RHFFormLabel>
                    <RHFFormControl>
                      <Input id="tpl-desc" placeholder="Напр.: Атрибути для категорії" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <div className="md:col-span-1 md:col-start-4 flex justify-end">
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  {t("save")}
                </Button>
              </div>
            </form>
          </RHFForm>
          <Tabs defaultValue="attributes">
            <TabsList className="bg-transparent p-0 h-auto">
              <TabsTrigger
                value="attributes"
                className="px-0 py-0 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none shadow-none"
              >
                Характеристики
              </TabsTrigger>
            </TabsList>
            <TabsContent value="attributes" className="space-y-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAttrsDragEnd}>
                <SortableContext items={attributes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  <Accordion type="multiple" className="space-y-2">
                    {attributes.map((a, i) => (
                      <SortableAttributeRow
                        key={a.id}
                        attribute={a}
                        index={i}
                        onAddValue={openAddValueDialog}
                        onBulkAddValue={openBulkAddValueDialog}
                        onEditValue={openEditValueDialog}
                        onDeleteValue={deleteValue}
                        onDuplicateValue={duplicateValue}
                        onDeleteAttribute={deleteAttribute}
                        onDuplicateAttribute={duplicateAttribute}
                        onToggleValueActive={toggleValueActive}
                        onUpdateAttribute={async (attrId, updates) => {
                          const nextUpdates = {
                            name: (updates.name || a.name || "").trim(),
                            paramid: (updates.paramid || a.paramid || "") ? String(updates.paramid || a.paramid).trim() : null,
                            attribute_type: updates.attribute_type || a.attribute_type,
                            unit: (updates.unit || a.unit || "") ? String(updates.unit || a.unit).trim() : null,
                            default_value: (updates.default_value || a.default_value || "") ? String(updates.default_value || a.default_value).trim() : null,
                            is_active: updates.is_active ?? a.is_active ?? true,
                          };
                          await updateAttribute(attrId, nextUpdates);
                        }}
                      />
                    ))}
                  </Accordion>
                </SortableContext>
              </DndContext>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Dialog open={attrDialogOpen} onOpenChange={setAttrDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto w-[calc(100%-1rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("btn_add")}</DialogTitle>
            <DialogDescription className="sr-only">{t("btn_add")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={`${t("characteristic_name")} *`} htmlFor="attr-name" icon={Tag}>
              <Input
                id="attr-name"
                placeholder="Напр.: Вбудована пам’ять"
                value={attrForm.name}
                onChange={(e) => setAttrForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label={t("attribute_param_id")} htmlFor="attr-paramid" icon={Hash}>
              <Input
                id="attr-paramid"
                placeholder="Напр.: memory"
                value={attrForm.paramid || ""}
                onChange={(e) => setAttrForm((p) => ({ ...p, paramid: e.target.value }))}
              />
            </FormField>
            <FormField label={`${t("attribute_type")} *`} icon={List}>
              <Select value={attrForm.attribute_type} onValueChange={(v) => setAttrForm((p) => ({ ...p, attribute_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("attribute_type_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">{t("attribute_type_select")}</SelectItem>
                  <SelectItem value="multiselect">{t("attribute_type_multiselect")}</SelectItem>
                  <SelectItem value="text">{t("attribute_type_text")}</SelectItem>
                  <SelectItem value="number">{t("attribute_type_number")}</SelectItem>
                  <SelectItem value="boolean">{t("attribute_type_boolean")}</SelectItem>
                  <SelectItem value="range">{t("attribute_type_range")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("attribute_unit")} htmlFor="attr-unit" icon={Ruler}>
              <Input
                id="attr-unit"
                placeholder="Напр.: ГБ"
                value={attrForm.unit || ""}
                onChange={(e) => setAttrForm((p) => ({ ...p, unit: e.target.value }))}
              />
            </FormField>
            <SwitchField
              label={t("attribute_active")}
              icon={CheckCircle2}
              checked={attrForm.is_active}
              onCheckedChange={(v) => setAttrForm((p) => ({ ...p, is_active: !!v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttrDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              {t("cancel")}
            </Button>
            <Button onClick={handleAddAttribute}>
              <Save className="h-4 w-4 mr-2" />
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto w-[calc(100%-1rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{valueForm.getValues("id") ? t("edit_value") : t("add_value")}</DialogTitle>
            <DialogDescription className="sr-only">{t("add_value")}</DialogDescription>
          </DialogHeader>
          <RHFForm {...valueForm}>
            <form onSubmit={valueForm.handleSubmit(onValueSubmit)} className="space-y-4">
              <RHFFormField
                control={valueForm.control}
                name="value"
                render={({ field }) => (
                  <RHFFormItem>
                  <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Type className="h-4 w-4 text-emerald-600" />
                    {t("value")} *
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input id="value-name" placeholder="Напр.: 128 ГБ" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={valueForm.control}
                name="display_value"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Eye className="h-4 w-4 text-emerald-600" />
                      {t("value_display")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input id="value-display" placeholder="Напр.: 128 GB" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={valueForm.control}
                name="valueid"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="h-4 w-4 text-emerald-600" />
                      {t("value_id_optional")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input id="value-id" placeholder="Напр.: mem_128" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setValueDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={valueSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {valueSaving ? t("please_wait") : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </RHFForm>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto w-[calc(100%-1rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("bulk_add_value")}</DialogTitle>
            <DialogDescription className="sr-only">{t("bulk_add_value")}</DialogDescription>
          </DialogHeader>
          <RHFForm {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
              <RHFFormField
                control={bulkForm.control}
                name="valuesText"
                render={({ field }) => (
                  <RHFFormItem>
                  <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <List className="h-4 w-4 text-emerald-600" />
                    {t("value")} *
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Textarea {...field} placeholder={"Напр.: 64 ГБ\n128 ГБ\n256 ГБ"} rows={6} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={bulkForm.control}
                name="prefix"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <ArrowLeft className="h-4 w-4 text-emerald-600" />
                      {t("prefix")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input placeholder="Напр.: mem_" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={bulkForm.control}
                name="suffix"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <ArrowRight className="h-4 w-4 text-emerald-600" />
                      {t("suffix")}
                    </RHFFormLabel>
                    <RHFFormControl>
                      <Input placeholder="Напр.: _gb" {...field} />
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <RHFFormField
                control={bulkForm.control}
                name="generateValueId"
                render={({ field }) => (
                  <RHFFormItem>
                    <RHFFormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Згенерувати value_id
                    </RHFFormLabel>
                    <RHFFormControl>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm font-medium">Згенерувати value_id</span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </div>
                    </RHFFormControl>
                    <RHFFormMessage />
                  </RHFFormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={bulkSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {bulkSaving ? t("please_wait") : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </RHFForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
