import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
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
  Asterisk,
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
} from "lucide-react";
import type { AttributeValue, CategoryTemplate, TemplateAttribute } from "@/lib/template-service";
import { FormField, SwitchField } from "./components/Fields";
import { SortableAttributeRow } from "./components/SortableAttributeRow";
import { useCategories } from "./hooks/useCategories";
import { useTemplateAttributes } from "./hooks/useTemplateAttributes";
import { useTemplateForms } from "./hooks/useTemplateForms";
import { useTemplates } from "./hooks/useTemplates";

type TemplateEditViewProps = {
  templateId: number;
};

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
    saveValue,
    deleteValue,
    duplicateValue,
    toggleValueActive,
    bulkSaveValues,
    reorderAttributes,
  } = useTemplateAttributes(t);
  const {
    editForm,
    setEditForm,
    attrForm,
    setAttrForm,
    valueForm,
    setValueForm,
    bulkAttribute,
    setBulkAttribute,
    bulkValuesText,
    setBulkValuesText,
    bulkSuffix,
    setBulkSuffix,
    bulkGenerateValueId,
    setBulkGenerateValueId,
    bulkPrefix,
    setBulkPrefix,
  } = useTemplateForms();
  const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [attrDialogOpen, setAttrDialogOpen] = useState(false);
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
        setEditForm({
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
  }, [getTemplateById, loadCategories, loadTemplateDetails, setEditForm, t, templateId]);

  const handleSaveTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    const ok = await updateTemplate(selectedTemplate.id, editForm);
    if (ok) {
      setSelectedTemplate((prev) =>
        prev
          ? {
              ...prev,
              category_id: Number(editForm.category_id),
              name: editForm.name.trim(),
              description: editForm.description.trim() || null,
            }
          : prev,
      );
    }
  }, [editForm, selectedTemplate, updateTemplate]);

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
    setValueForm({
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
  }, [setValueForm]);

  const openBulkAddValueDialog = useCallback((attribute: TemplateAttribute) => {
    setBulkAttribute(attribute);
    setBulkValuesText("");
    setBulkSuffix("");
    setBulkPrefix("");
    setBulkGenerateValueId(true);
    setBulkDialogOpen(true);
  }, [setBulkAttribute, setBulkGenerateValueId, setBulkPrefix, setBulkSuffix, setBulkValuesText]);

  const openEditValueDialog = useCallback((attribute: TemplateAttribute, value: AttributeValue) => {
    const lang = (value as any).value_lang || {};
    setValueForm({
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
  }, [setValueForm]);

  const handleSaveValue = useCallback(async () => {
    const ok = await saveValue(valueForm);
    if (ok) {
      setValueDialogOpen(false);
      setValueForm({
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
  }, [saveValue, setValueForm, valueForm]);

  const handleBulkSaveValues = useCallback(async () => {
    const ok = await bulkSaveValues({
      attribute: bulkAttribute,
      valuesText: bulkValuesText,
      prefix: bulkPrefix,
      suffix: bulkSuffix,
      generateValueId: bulkGenerateValueId,
    });
    if (ok) {
      setBulkDialogOpen(false);
      setBulkValuesText("");
      setBulkPrefix("");
      setBulkSuffix("");
      setBulkGenerateValueId(true);
    }
  }, [bulkAttribute, bulkGenerateValueId, bulkPrefix, bulkSaveValues, bulkSuffix, bulkValuesText, setBulkGenerateValueId, setBulkPrefix, setBulkSuffix, setBulkValuesText]);

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
          <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="tpl-category">{t("menu_categories")}</Label>
              <Select value={editForm.category_id} onValueChange={(v) => setEditForm((p) => ({ ...p, category_id: v }))}>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{t("menu_product_templates")}</Label>
              <Input id="tpl-name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="tpl-desc">{t("description")}</Label>
              <Input id="tpl-desc" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="md:col-span-1 md:col-start-3">
              <div className="flex justify-end">
                <Button onClick={handleSaveTemplate}>
                  <Check className="h-4 w-4" />
                  {t("save")}
                </Button>
              </div>
            </div>
          </div>
          <Tabs defaultValue="attributes">
            <TabsList>
              <TabsTrigger value="attributes">{t("attributes")}</TabsTrigger>
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
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("btn_add")}</DialogTitle>
            <DialogDescription className="sr-only">{t("btn_add")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={t("characteristic_name")} htmlFor="attr-name" icon={Tag}>
              <Input id="attr-name" value={attrForm.name} onChange={(e) => setAttrForm((p) => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField label={t("attribute_param_id")} htmlFor="attr-paramid" icon={Hash}>
              <Input id="attr-paramid" value={attrForm.paramid || ""} onChange={(e) => setAttrForm((p) => ({ ...p, paramid: e.target.value }))} />
            </FormField>
            <FormField label={t("attribute_type")} icon={List}>
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
              <Input id="attr-unit" value={attrForm.unit || ""} onChange={(e) => setAttrForm((p) => ({ ...p, unit: e.target.value }))} />
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
              {t("cancel")}
            </Button>
            <Button onClick={handleAddAttribute}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{valueForm.id ? t("edit_value") : t("add_value")}</DialogTitle>
            <DialogDescription className="sr-only">{t("add_value")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={t("value")} htmlFor="value-name" icon={Type}>
              <Input id="value-name" value={valueForm.value} onChange={(e) => setValueForm((p) => ({ ...p, value: e.target.value }))} />
            </FormField>
            <FormField label={t("value_display")} htmlFor="value-display" icon={Eye}>
              <Input
                id="value-display"
                value={valueForm.display_value || ""}
                onChange={(e) => setValueForm((p) => ({ ...p, display_value: e.target.value }))}
              />
            </FormField>
            <FormField label={t("value_id_optional")} htmlFor="value-id" icon={KeyRound}>
              <Input id="value-id" value={valueForm.valueid || ""} onChange={(e) => setValueForm((p) => ({ ...p, valueid: e.target.value }))} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValueDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveValue} disabled={valueSaving}>
              {valueSaving ? t("please_wait") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("bulk_add_value")}</DialogTitle>
            <DialogDescription className="sr-only">{t("bulk_add_value")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={t("value")} icon={List}>
              <Textarea value={bulkValuesText} onChange={(e) => setBulkValuesText(e.target.value)} placeholder="Значення з нового рядка" rows={6} />
            </FormField>
            <FormField label={t("prefix")} icon={ArrowLeft}>
              <Input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} />
            </FormField>
            <FormField label={t("suffix")} icon={ArrowRight}>
              <Input value={bulkSuffix} onChange={(e) => setBulkSuffix(e.target.value)} />
            </FormField>
            <SwitchField
              label="Згенерувати value_id"
              icon={Sparkles}
              checked={bulkGenerateValueId}
              onCheckedChange={(v) => setBulkGenerateValueId(!!v)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleBulkSaveValues} disabled={bulkSaving}>
              {bulkSaving ? t("please_wait") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
