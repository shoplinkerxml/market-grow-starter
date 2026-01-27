import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { format } from "date-fns";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MoreVertical,
  CircleCheckBig,
  Check,
  Tag,
  Hash,
  List,
  Ruler,
  Type,
  Asterisk,
  Filter,
  CheckCircle2,
  Eye,
  KeyRound,
  AlignLeft,
  Folder,
  FileText,
  Power,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { CategoryTemplate, TemplateAttribute, AttributeValue } from "@/lib/template-service";

type UserDashboardContextType = {
  user: { id?: string } | null;
  menuItems: unknown[];
};

type CategoryRow = {
  id: number;
  name: string;
  external_id: string | null;
};

type ViewMode = "list" | "edit" | "apply";

type CategoryTemplateRow = CategoryTemplate & {
  created_at?: string | null;
  updated_at?: string | null;
};

type CreateTemplateForm = {
  category_id: string;
  name: string;
  description: string;
  is_active: boolean;
};

type AttributeForm = {
  id?: number;
  name: string;
  paramid?: string;
  attribute_type: string;
  is_required: boolean;
  unit?: string;
  default_value?: string;
  help_text?: string;
  validation_rules?: string;
  is_filterable: boolean;
  is_active: boolean;
};

type ValueForm = {
  id?: number;
  attribute_id?: number;
  value: string;
  valueid?: string;
  display_value?: string;
  display_order?: string;
  value_lang_uk?: string;
  value_lang_en?: string;
  value_lang_ru?: string;
  metadata?: string;
  is_active: boolean;
};

type TemplateAttributeWithValues = TemplateAttribute & {
  help_text?: string | null;
  validation_rules?: Record<string, unknown> | null;
  values: AttributeValue[];
};

type FieldIcon = ComponentType<{ className?: string }>;

function FormField({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor?: string;
  icon?: FieldIcon;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

function SwitchField({
  label,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  label: string;
  icon?: FieldIcon;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
        <span>{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SortableAttrRow({
  attribute,
  index,
  onAddValue,
  onBulkAddValue,
  onEditValue,
  onDeleteValue,
  onDuplicateValue,
  onToggleValueActive,
  onUpdateAttribute,
}: {
  attribute: TemplateAttributeWithValues;
  index: number;
  onAddValue: (attr: TemplateAttribute) => void;
  onBulkAddValue: (attr: TemplateAttribute) => void;
  onEditValue: (attr: TemplateAttribute, value: AttributeValue) => void;
  onDeleteValue: (attr: TemplateAttributeWithValues, value: AttributeValue) => void;
  onDuplicateValue: (attr: TemplateAttributeWithValues, value: AttributeValue) => void;
  onToggleValueActive: (attributeId: number, valueId: number, nextActive: boolean) => void;
  onUpdateAttribute: (attrId: number, updates: Partial<TemplateAttribute>) => Promise<void>;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: attribute.id });
  const [form, setForm] = useState({
    name: attribute.name || "",
    paramid: attribute.paramid || "",
    attribute_type: attribute.attribute_type || "select",
    unit: attribute.unit || "",
  });
  useEffect(() => {
    setForm({
      name: attribute.name || "",
      paramid: attribute.paramid || "",
      attribute_type: attribute.attribute_type || "select",
      unit: attribute.unit || "",
    });
  }, [attribute]);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const values = attribute.values || [];
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border">
      <AccordionItem value={`attr-${attribute.id}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="cursor-move touch-none" {...attributes} {...listeners}>
              <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </div>
            <div className="text-sm font-medium">
              {index + 1}. {attribute.name}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              {attribute.attribute_type} • {attribute.is_required ? t("attribute_required_short") : t("attribute_optional_short")}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("attribute_active")}</span>
              <Switch
                checked={attribute.is_active ?? true}
                onCheckedChange={(v) =>
                  onUpdateAttribute(attribute.id, {
                    is_active: !!v,
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await onUpdateAttribute(attribute.id, {
                  name: form.name.trim(),
                  paramid: form.paramid.trim() || null,
                  attribute_type: form.attribute_type,
                  unit: form.unit.trim() || null,
                });
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AccordionTrigger className="px-4">{t("attribute_details")}</AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-4">
            <FormField label={t("attribute_name")} htmlFor={`attr-name-${attribute.id}`} icon={Tag}>
              <Input
                id={`attr-name-${attribute.id}`}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label={t("attribute_param_id")} htmlFor={`attr-paramid-${attribute.id}`} icon={Hash}>
              <Input
                id={`attr-paramid-${attribute.id}`}
                value={form.paramid}
                onChange={(e) => setForm((p) => ({ ...p, paramid: e.target.value }))}
              />
            </FormField>
            <FormField label={t("attribute_type")} htmlFor={`attr-type-${attribute.id}`} icon={List}>
              <Select value={form.attribute_type} onValueChange={(v) => setForm((p) => ({ ...p, attribute_type: v }))}>
                <SelectTrigger id={`attr-type-${attribute.id}`}>
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
            <FormField label={t("attribute_unit")} htmlFor={`attr-unit-${attribute.id}`} icon={Ruler}>
              <Input
                id={`attr-unit-${attribute.id}`}
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">{t("attribute_values")}</div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onAddValue(attribute)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("btn_add")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onBulkAddValue(attribute)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("bulk_add_value")}
                </Button>
              </div>
            </div>
            {values.length === 0 ? (
              <div className="text-xs text-muted-foreground">{t("no_attribute_values")}</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("value")}</TableHead>
                      <TableHead>{t("value_display")}</TableHead>
                  <TableHead>{t("value_id")}</TableHead>
                  <TableHead>{t("attribute_active")}</TableHead>
                      <TableHead className="w-[120px]">{t("table_actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((value) => (
                      <TableRow key={value.id}>
                        <TableCell className="font-medium">{value.value}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{value.display_value || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{value.valueid || "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={value.is_active ?? true}
                        onCheckedChange={(v) => onToggleValueActive(attribute.id, value.id, !!v)}
                      />
                    </TableCell>
                        <TableCell className="w-[120px] p-0 align-middle">
                          <div className="flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditValue(attribute, value)} className="cursor-pointer">
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t("edit_value")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicateValue(attribute, value)} className="cursor-pointer">
                                  <Copy className="mr-2 h-4 w-4" />
                                  {t("duplicate")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDeleteValue(attribute, value)} className="cursor-pointer focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}

export default function CategoryTemplates() {
  const { t } = useI18n();
  const breadcrumbsBase = useBreadcrumbs();
  const { user } = useOutletContext<UserDashboardContextType>();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [templates, setTemplates] = useState<CategoryTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTemplateForm>({
    category_id: "",
    name: "",
    description: "",
    is_active: true,
  });
  const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
  const [attributes, setAttributes] = useState<TemplateAttributeWithValues[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [attributeCounts, setAttributeCounts] = useState<Record<number, number>>({});
  const [attrDialogOpen, setAttrDialogOpen] = useState(false);
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
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueForm, setValueForm] = useState<ValueForm>({
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
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAttribute, setBulkAttribute] = useState<TemplateAttribute | null>(null);
  const [bulkValuesText, setBulkValuesText] = useState("");
  const [bulkSuffix, setBulkSuffix] = useState("");
  const [bulkGenerateValueId, setBulkGenerateValueId] = useState(true);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const loadTemplatesRequestIdRef = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const computedBreadcrumbs = useMemo(() => {
    if (viewMode === "list") return breadcrumbsBase;
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
  }, [breadcrumbsBase, categories, selectedTemplate, t, viewMode]);

  const title = useMemo(() => t("menu_category_templates"), [t]);
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [applyCategoryId, setApplyCategoryId] = useState<string>("");
  const [applyOnlyRequired, setApplyOnlyRequired] = useState(true);
  const [applyOverwriteExisting, setApplyOverwriteExisting] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [applyPreview, setApplyPreview] = useState<{ products: number; attributes: number; required: number; optional: number }>({
    products: 0,
    attributes: 0,
    required: 0,
    optional: 0,
  });
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [editForm, setEditForm] = useState<{ category_id: string; name: string; description: string }>({
    category_id: "",
    name: "",
    description: "",
  });

  const loadCategories = useCallback(async () => {
    const { data, error } = await (supabase as any).from("store_categories").select("id,name,external_id").order("name");
    if (error) throw new Error(error.message);
    setCategories((data || []) as CategoryRow[]);
  }, []);

  const loadTemplates = useCallback(async () => {
    loadTemplatesRequestIdRef.current += 1;
    const requestId = loadTemplatesRequestIdRef.current;
    const { data, error } = await (supabase as any)
      .from("category_templates")
      .select("id,category_id,name,description,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    if (error) throw new Error(error.message);
    const rows = (data || []) as CategoryTemplateRow[];
    if (loadTemplatesRequestIdRef.current !== requestId) return;
    setTemplates(rows);
    if (rows.length > 0) {
      const counts = await Promise.all(
        rows.map(async (tpl) => {
          const { count, error: countError } = await (supabase as any)
            .from("template_attributes")
            .select("id", { count: "exact", head: true })
            .eq("template_id", tpl.id);
          if (loadTemplatesRequestIdRef.current !== requestId) return [tpl.id, 0] as const;
          if (countError) return [tpl.id, 0] as const;
          return [tpl.id, count || 0] as const;
        }),
      );
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      setAttributeCounts(Object.fromEntries(counts));
    } else {
      if (loadTemplatesRequestIdRef.current !== requestId) return;
      setAttributeCounts({});
    }
  }, []);

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

  useEffect(() => {
    return () => {
      loadTemplatesRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const mode: ViewMode = location.pathname.endsWith("/apply") ? "apply" : location.pathname.endsWith("/edit") ? "edit" : "list";
    if (mode === "list") {
      setViewMode("list");
      setSelectedTemplate(null);
      setApplyCategoryId(null);
      return;
    }
    const id = params.id ? Number(params.id) : null;
    if (!id) return;
    (async () => {
      try {
        const found = templates.find((t) => Number(t.id) === id);
        let tpl = found || null;
        if (!tpl) {
          const { data, error } = await (supabase as any)
            .from("category_templates")
            .select("id,category_id,name,description,is_active,created_at,updated_at")
            .eq("id", id)
            .single();
          if (error) throw new Error(error.message);
          tpl = data as CategoryTemplate;
        }
        setSelectedTemplate(tpl);
        setViewMode(mode);
        setApplyCategoryId(String((tpl as any).category_id || ""));
        await loadTemplateDetails(tpl as CategoryTemplate);
        setEditForm({
          category_id: String((tpl as any).category_id || ""),
          name: String((tpl as any).name || ""),
          description: String((tpl as any).description || ""),
        });
      } catch (e: any) {
        toast.error(e?.message || t("operation_failed"));
      }
    })();
  }, [location.pathname, loadTemplateDetails, params.id, templates, t]);

  const computeApplyPreview = useCallback(
    async (tpl: CategoryTemplate | null, categoryId: string | null) => {
      if (!tpl || !categoryId) {
        setApplyPreview({ products: 0, attributes: 0, required: 0, optional: 0 });
        return;
      }
      try {
        const { count: productsCount, error: productsError } = await (supabase as any)
          .from("store_products")
          .select("id", { count: "exact", head: true })
          .eq("category_id", Number(categoryId));
        if (productsError) throw new Error(productsError.message);
        const { data: attrsData, error: attrsError } = await (supabase as any)
          .from("template_attributes")
          .select("id,is_required")
          .eq("template_id", tpl.id)
          .eq("is_active", true);
        if (attrsError) throw new Error(attrsError.message);
        const attrs = (attrsData || []) as Array<{ id: number; is_required: boolean | null }>;
        const total = attrs.length;
        const required = attrs.filter((a) => !!a.is_required).length;
        const optional = Math.max(0, total - required);
        setApplyPreview({ products: productsCount || 0, attributes: total, required, optional });
      } catch (e: any) {
        toast.error(e?.message || t("operation_failed"));
        setApplyPreview({ products: 0, attributes: 0, required: 0, optional: 0 });
      }
    },
    [t],
  );

  useEffect(() => {
    if (viewMode !== "apply") return;
    void computeApplyPreview(selectedTemplate, applyCategoryId);
  }, [viewMode, selectedTemplate, applyCategoryId, computeApplyPreview]);

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

  useEffect(() => {
    if (viewMode !== "edit" || !selectedTemplate) return;
    setEditForm({
      category_id: String((selectedTemplate as any).category_id || ""),
      name: String((selectedTemplate as any).name || ""),
      description: String((selectedTemplate as any).description || ""),
    });
  }, [viewMode, selectedTemplate]);

  const handleCreateTemplate = useCallback(async () => {
    if (!createForm.category_id || !createForm.name.trim()) {
      toast.error(t("failed_save"));
      return;
    }
    try {
      setCreating(true);
      const { error } = await (supabase as any).from("category_templates").insert({
        category_id: Number(createForm.category_id),
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        is_active: createForm.is_active,
      });
      if (error) throw new Error(error.message);
      setCreateDialogOpen(false);
      setCreateForm({ category_id: "", name: "", description: "", is_active: true });
      await loadTemplates();
      toast.success(t("template_saved"));
    } catch (error: any) {
      toast.error(error?.message || t("failed_save"));
    } finally {
      setCreating(false);
    }
  }, [createForm, loadTemplates, t]);

  const handleDeleteTemplate = useCallback(
    async (tpl: CategoryTemplate) => {
      try {
        const { error } = await (supabase as any).from("category_templates").delete().eq("id", tpl.id);
        if (error) throw new Error(error.message);
        await loadTemplates();
        toast.success(t("template_deleted"));
      } catch (error: any) {
        toast.error(error?.message || t("failed_delete_template"));
      }
    },
    [loadTemplates, t],
  );

  const openEditor = useCallback(
    async (tpl: CategoryTemplate) => {
      navigate(`/user/category-templates/${tpl.id}/edit`);
    },
    [navigate],
  );

  const handleAddAttribute = useCallback(async () => {
    if (!selectedTemplate) return;
    if (!attrForm.name.trim()) {
      toast.error(t("failed_save"));
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("template_attributes")
        .insert({
          template_id: selectedTemplate.id,
          name: attrForm.name.trim(),
          paramid: (attrForm.paramid || "").trim() || null,
          attribute_type: attrForm.attribute_type,
          is_required: attrForm.is_required,
          unit: (attrForm.unit || "").trim() || null,
          default_value: (attrForm.default_value || "").trim() || null,
          is_filterable: attrForm.is_filterable,
          is_active: attrForm.is_active,
          display_order: attributes.length,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = data as TemplateAttribute;
      setAttributes([...attributes, { ...row, values: [] }]);
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
      toast.success(t("feature_saved_successfully"));
    } catch (error: any) {
      toast.error(error?.message || t("failed_save"));
    }
  }, [attrForm, attributes, selectedTemplate, t]);

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
  }, []);

  const openBulkAddValueDialog = useCallback((attribute: TemplateAttribute) => {
    setBulkAttribute(attribute);
    setBulkValuesText("");
    setBulkSuffix("");
    setBulkPrefix("");
    setBulkGenerateValueId(true);
    setBulkDialogOpen(true);
  }, []);

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
  }, []);

  const handleSaveValue = useCallback(async () => {
    const attributeId = valueForm.attribute_id;
    if (!attributeId || !valueForm.value.trim()) {
      toast.error(t("failed_save"));
      return;
    }
    try {
      const valueLang: Record<string, string> = {};
      if (valueForm.value_lang_uk?.trim()) valueLang.uk = valueForm.value_lang_uk.trim();
      if (valueForm.value_lang_en?.trim()) valueLang.en = valueForm.value_lang_en.trim();
      if (valueForm.value_lang_ru?.trim()) valueLang.ru = valueForm.value_lang_ru.trim();
      const metadataText = valueForm.metadata?.trim();
      let metadata: Record<string, unknown> | null = null;
      if (metadataText) {
        try {
          metadata = JSON.parse(metadataText);
        } catch (error) {
          toast.error(t("failed_save"));
          return;
        }
      }
      const displayOrder = valueForm.display_order?.trim() ? Number(valueForm.display_order) : null;
      setValueSaving(true);
      if (valueForm.id) {
        const { data, error } = await (supabase as any)
          .from("attribute_values")
          .update({
            value: valueForm.value.trim(),
            valueid: valueForm.valueid?.trim() || null,
            display_value: valueForm.display_value?.trim() || null,
            display_order: displayOrder,
            value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
            metadata,
            is_active: valueForm.is_active,
          })
          .eq("id", valueForm.id)
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
        const displayOrder = target?.values?.length ?? 0;
        const { data, error } = await (supabase as any)
          .from("attribute_values")
          .insert({
            attribute_id: attributeId,
            value: valueForm.value.trim(),
            valueid: valueForm.valueid?.trim() || null,
            display_value: valueForm.display_value?.trim() || null,
            display_order: valueForm.display_order?.trim() ? Number(valueForm.display_order) : displayOrder,
            value_lang: Object.keys(valueLang).length > 0 ? valueLang : null,
            metadata,
            is_active: valueForm.is_active,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        const row = data as AttributeValue;
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === attributeId ? { ...attr, values: [...attr.values, row] } : attr)),
        );
      }
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
      toast.success(t("value_saved"));
    } catch (error: any) {
      toast.error(error?.message || t("failed_save"));
    } finally {
      setValueSaving(false);
    }
  }, [attributes, t, valueForm]);

  const handleDeleteValue = useCallback(
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
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === attribute.id ? { ...attr, values: reordered } : attr)),
        );
        toast.success(t("value_deleted"));
      } catch (error: any) {
        toast.error(error?.message || t("failed_delete_template"));
      }
    },
    [t],
  );

  const handleDuplicateValue = useCallback(
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
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
      }
    },
    [t],
  );

  const handleToggleValueActive = useCallback(
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
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
      }
    },
    [t],
  );

  const handleBulkSaveValues = useCallback(async () => {
    if (!bulkAttribute) return;
    const rawValues = bulkValuesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rawValues.length === 0) {
      toast.error(t("failed_save"));
      return;
    }
    const existing = attributes.find((attr) => attr.id === bulkAttribute.id);
    const baseOrder = existing?.values?.length ?? 0;
    const rows = rawValues.map((value, idx) => {
      const trimmedPrefix = bulkPrefix.trim();
      const trimmedSuffix = bulkSuffix.trim();
      const finalValue = `${trimmedPrefix}${value}${trimmedSuffix}`.trim();
      const generatedValueId = bulkGenerateValueId
        ? finalValue
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "_")
            .replace(/^_+|_+$/g, "")
        : null;
      return {
        attribute_id: bulkAttribute.id,
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
        prev.map((attr) =>
          attr.id === bulkAttribute.id ? { ...attr, values: [...attr.values, ...inserted] } : attr,
        ),
      );
      setBulkDialogOpen(false);
      setBulkValuesText("");
      setBulkPrefix("");
      setBulkSuffix("");
      setBulkGenerateValueId(true);
      toast.success(t("value_saved"));
    } catch (error: any) {
      toast.error(error?.message || t("failed_save"));
    } finally {
      setBulkSaving(false);
    }
  }, [attributes, bulkAttribute, bulkGenerateValueId, bulkPrefix, bulkSuffix, bulkValuesText, t]);

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
      setAttributes(next);
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
      } catch (error: any) {
        toast.error(error?.message || t("failed_save"));
        await loadTemplateDetails(selectedTemplate as CategoryTemplate);
      }
    },
    [attributes, loadTemplateDetails, selectedTemplate, t],
  );

  const openApply = useCallback(
    async (tpl: CategoryTemplate) => {
      navigate(`/user/category-templates/${tpl.id}/apply`);
    },
    [navigate],
  );

  const handleApplyTemplateAction = useCallback(async () => {
    if (!selectedTemplate || !applyCategoryId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const { data, error } = await (supabase as any).rpc("apply_template_to_products", {
        p_template_id: Number(selectedTemplate.id),
        p_category_id: Number(applyCategoryId),
      });
      if (error) throw new Error(error.message);
      const createdCount = typeof data === "number" ? data : 0;
      setApplyResult(`${createdCount}`);
      await computeApplyPreview(selectedTemplate, applyCategoryId);
      toast.success(t("template_saved"));
    } catch (e: any) {
      toast.error(e?.message || t("operation_failed"));
    } finally {
      setApplying(false);
    }
  }, [applyCategoryId, computeApplyPreview, selectedTemplate, t]);

  const handleToggleTemplateActive = useCallback(
    async (tpl: CategoryTemplateRow, active: boolean) => {
      try {
        const { error } = await (supabase as any).from("category_templates").update({ is_active: active }).eq("id", tpl.id);
        if (error) throw new Error(error.message);
        setTemplates((prev) => prev.map((r) => (r.id === tpl.id ? { ...r, is_active: active } : r)));
        toast.success(t("currency_status_updated"));
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
      }
    },
    [t],
  );

  const handleDuplicateTemplate = useCallback(
    async (tpl: CategoryTemplateRow) => {
      try {
        const { data: newTplData, error: insErr } = await (supabase as any)
          .from("category_templates")
          .insert({
            category_id: tpl.category_id,
            name: `${tpl.name} (копія)`,
            description: tpl.description || null,
            is_active: tpl.is_active ?? true,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        const newTemplateId = Number((newTplData as any)?.id);

        const { data: oldAttrs, error: oldAttrsErr } = await (supabase as any)
          .from("template_attributes")
          .select("id, template_id, name, paramid, attribute_type, is_required, display_order, unit, default_value, is_filterable, is_active")
          .eq("template_id", tpl.id)
          .order("display_order", { ascending: true });
        if (oldAttrsErr) throw new Error(oldAttrsErr.message);
        const oldAttrRows = (oldAttrs || []) as TemplateAttribute[];

        if (oldAttrRows.length > 0) {
          const insertAttrs = oldAttrRows.map((a, idx) => ({
            template_id: newTemplateId,
            name: a.name,
            paramid: a.paramid || null,
            attribute_type: a.attribute_type,
            is_required: a.is_required ?? false,
            unit: a.unit || null,
            default_value: a.default_value || null,
            is_filterable: a.is_filterable ?? true,
            is_active: a.is_active ?? true,
            display_order: typeof a.display_order === "number" ? a.display_order : idx,
          }));
          const { error: insertAttrsErr } = await (supabase as any).from("template_attributes").insert(insertAttrs);
          if (insertAttrsErr) throw new Error(insertAttrsErr.message);

          const { data: newAttrs, error: newAttrsErr } = await (supabase as any)
            .from("template_attributes")
            .select("id, display_order")
            .eq("template_id", newTemplateId)
            .order("display_order", { ascending: true });
          if (newAttrsErr) throw new Error(newAttrsErr.message);
          const newAttrRows = (newAttrs || []) as Array<{ id: number; display_order: number | null }>;

          const oldAttrIds = oldAttrRows.map((a) => a.id);
          const { data: oldValues, error: oldValuesErr } = await (supabase as any)
            .from("attribute_values")
            .select("id, attribute_id, value, valueid, display_value, value_lang, display_order, is_active, metadata")
            .in("attribute_id", oldAttrIds)
            .order("display_order", { ascending: true });
          if (oldValuesErr) throw new Error(oldValuesErr.message);
          const valuesByAttr = new Map<number, AttributeValue[]>();
          for (const v of (oldValues || []) as AttributeValue[]) {
            const list = valuesByAttr.get(Number(v.attribute_id)) || [];
            list.push(v);
            valuesByAttr.set(Number(v.attribute_id), list);
          }

          const valueInserts: Array<Record<string, unknown>> = [];
          for (let i = 0; i < oldAttrRows.length; i++) {
            const oldAttr = oldAttrRows[i];
            const newAttr = newAttrRows[i];
            if (!newAttr) continue;
            const oldList = valuesByAttr.get(Number(oldAttr.id)) || [];
            for (let j = 0; j < oldList.length; j++) {
              const v = oldList[j];
              valueInserts.push({
                attribute_id: newAttr.id,
                value: v.value,
                valueid: v.valueid || null,
                display_value: v.display_value || null,
                value_lang: (v as any).value_lang || null,
                display_order: typeof v.display_order === "number" ? v.display_order : j,
                is_active: v.is_active ?? true,
                metadata: (v as any).metadata || null,
              });
            }
          }
          if (valueInserts.length > 0) {
            const { error: insValsErr } = await (supabase as any).from("attribute_values").insert(valueInserts);
            if (insValsErr) throw new Error(insValsErr.message);
          }
        }

        await loadTemplates();
        toast.success(t("duplicate_tariff"));
      } catch (e: any) {
        toast.error(e?.message || t("failed_save"));
      }
    },
    [loadTemplates, t],
  );

  if (viewMode === "edit" && selectedTemplate) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title={title}
          breadcrumbItems={computedBreadcrumbs}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setViewMode("list")}>
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
                <Select
                  value={editForm.category_id}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, category_id: v }))}
                >
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
                <Input
                  id="tpl-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="tpl-desc">{t("description")}</Label>
                <Input
                  id="tpl-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="md:col-span-1 md:col-start-3">
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      try {
                        const { error } = await (supabase as any)
                          .from("category_templates")
                          .update({
                            category_id: Number(editForm.category_id),
                            name: editForm.name.trim(),
                            description: editForm.description.trim() || null,
                          })
                          .eq("id", selectedTemplate.id);
                        if (error) throw new Error(error.message);
                        const updated: CategoryTemplate = {
                          ...selectedTemplate,
                          category_id: Number(editForm.category_id),
                          name: editForm.name.trim(),
                          description: editForm.description.trim() || null,
                        } as any;
                        setSelectedTemplate(updated);
                        await loadTemplates();
                        toast.success(t("template_saved"));
                      } catch (e: any) {
                        toast.error(e?.message || t("failed_save"));
                      }
                    }}
                  >
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
                        <SortableAttrRow
                          key={a.id}
                          attribute={a}
                          index={i}
                          onAddValue={openAddValueDialog}
                          onBulkAddValue={openBulkAddValueDialog}
                          onEditValue={openEditValueDialog}
                          onDeleteValue={handleDeleteValue}
                          onDuplicateValue={handleDuplicateValue}
                          onToggleValueActive={handleToggleValueActive}
                          onUpdateAttribute={async (attrId, updates) => {
                            try {
                              const { error } = await (supabase as any)
                                .from("template_attributes")
                                .update({
                                  name: (updates.name || a.name || "").trim(),
                                  paramid: (updates.paramid || a.paramid || "") ? String(updates.paramid || a.paramid).trim() : null,
                                  attribute_type: updates.attribute_type || a.attribute_type,
                                  unit: (updates.unit || a.unit || "") ? String(updates.unit || a.unit).trim() : null,
                                  default_value: (updates.default_value || a.default_value || "") ? String(updates.default_value || a.default_value).trim() : null,
                                  is_active: updates.is_active ?? a.is_active ?? true,
                                })
                                .eq("id", attrId);
                              if (error) throw new Error(error.message);
                              setAttributes((prev) =>
                                prev.map((row) => (row.id === attrId ? { ...row, ...updates } : row)),
                              );
                              toast.success(t("feature_saved_successfully"));
                            } catch (e: any) {
                              toast.error(e?.message || t("failed_save"));
                            }
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
          <DialogContent>
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
              <FormField label={t("attribute_default")} htmlFor="attr-default" icon={Type}>
                <Input id="attr-default" value={attrForm.default_value || ""} onChange={(e) => setAttrForm((p) => ({ ...p, default_value: e.target.value }))} />
              </FormField>
              <SwitchField
                label={t("attribute_required")}
                icon={Asterisk}
                checked={attrForm.is_required}
                onCheckedChange={(v) => setAttrForm((p) => ({ ...p, is_required: !!v }))}
              />
              <SwitchField
                label={t("attribute_filterable")}
                icon={Filter}
                checked={attrForm.is_filterable}
                onCheckedChange={(v) => setAttrForm((p) => ({ ...p, is_filterable: !!v }))}
              />
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
          <DialogContent>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("bulk_add_value")}</DialogTitle>
              <DialogDescription className="sr-only">{t("bulk_add_value")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <FormField label={t("value")} icon={List}>
                <Textarea
                  value={bulkValuesText}
                  onChange={(e) => setBulkValuesText(e.target.value)}
                  placeholder="Значення з нового рядка"
                  rows={6}
                />
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

  if (viewMode === "apply" && selectedTemplate) {
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
              <Button variant="outline" onClick={() => navigate("/user/category-templates")}>{t("back")}</Button>
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
              <div className="rounded-md border p-3 text-sm">
                Створено параметрів: {applyResult}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/user/category-templates")}>{t("cancel")}</Button>
              <Button onClick={handleApplyTemplateAction} disabled={applying || !applyCategoryId}>
                {applying ? t("please_wait") : t("apply_template")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={computedBreadcrumbs}
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
                    if (tpl) handleDuplicateTemplate(tpl);
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
                    if (tpl) handleDeleteTemplate(tpl);
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
                          <Switch checked={!!tpl.is_active} onCheckedChange={(v) => handleToggleTemplateActive(tpl, !!v)} />
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
                              <DropdownMenuItem onClick={() => handleDuplicateTemplate(tpl)} className="cursor-pointer">
                                <Copy className="mr-2 h-4 w-4" />
                                {t("duplicate")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteTemplate(tpl)} className="cursor-pointer focus:text-destructive">
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
