import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { Copy, GripVertical, MoreVertical, Pencil, Plus, Trash2, Save, Hash, List, Ruler, Tag, ChevronDown } from "lucide-react";
import type { AttributeValue, TemplateAttribute } from "@/lib/template-service";
import type { TemplateAttributeWithValues } from "../types";
import { FormField } from "./Fields";

type SortableAttributeRowProps = {
  attribute: TemplateAttributeWithValues;
  index: number;
  onAddValue: (attr: TemplateAttribute) => void;
  onBulkAddValue: (attr: TemplateAttribute) => void;
  onEditValue: (attr: TemplateAttribute, value: AttributeValue) => void;
  onDeleteValue: (attr: TemplateAttributeWithValues, value: AttributeValue) => void;
  onDuplicateValue: (attr: TemplateAttributeWithValues, value: AttributeValue) => void;
  onDeleteAttribute: (attr: TemplateAttributeWithValues) => void;
  onDuplicateAttribute: (attr: TemplateAttributeWithValues) => void;
  onToggleValueActive: (attributeId: number, valueId: number, nextActive: boolean) => void;
  onUpdateAttribute: (attrId: number, updates: Partial<TemplateAttribute>) => Promise<void>;
};

export function SortableAttributeRow({
  attribute,
  index,
  onAddValue,
  onBulkAddValue,
  onEditValue,
  onDeleteValue,
  onDuplicateValue,
  onDeleteAttribute,
  onDuplicateAttribute,
  onToggleValueActive,
  onUpdateAttribute,
}: SortableAttributeRowProps) {
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
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="cursor-move touch-none" {...attributes} {...listeners}>
              <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </div>
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger asChild>
                <div className="group flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors hover:text-emerald-600">
                  <span>
                    {index + 1}. {attribute.name}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
          </div>
          <div className="ml-auto" />
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
            <Save className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDuplicateAttribute(attribute)} className="cursor-pointer">
                <Copy className="mr-2 h-4 w-4" />
                {t("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDeleteAttribute(attribute)} className="cursor-pointer focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AccordionContent className="px-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            <FormField label={`${t("attribute_name")} *`} htmlFor={`attr-name-${attribute.id}`} icon={Tag}>
              <Input
                id={`attr-name-${attribute.id}`}
                placeholder="Напр.: Вбудована пам’ять"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label={t("attribute_param_id")} htmlFor={`attr-paramid-${attribute.id}`} icon={Hash}>
              <Input
                id={`attr-paramid-${attribute.id}`}
                placeholder="Напр.: memory"
                value={form.paramid}
                onChange={(e) => setForm((p) => ({ ...p, paramid: e.target.value }))}
              />
            </FormField>
            <FormField label={`${t("attribute_type")} *`} htmlFor={`attr-type-${attribute.id}`} icon={List}>
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
                placeholder="Напр.: ГБ"
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
                      <TableHead className="w-[120px] text-center">{t("table_actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((value) => (
                      <TableRow key={value.id}>
                        <TableCell className="font-medium">{value.value}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{value.display_value || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{value.valueid || "—"}</TableCell>
                        <TableCell>
                          <Switch checked={value.is_active ?? true} onCheckedChange={(v) => onToggleValueActive(attribute.id, value.id, !!v)} />
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
