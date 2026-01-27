import { useState } from "react";
import type { AttributeForm, CreateTemplateForm, ValueForm } from "../types";
import type { TemplateAttribute } from "@/lib/template-service";

export function useTemplateForms() {
  const [createForm, setCreateForm] = useState<CreateTemplateForm>({
    category_id: "",
    name: "",
    description: "",
    is_active: true,
  });
  const [editForm, setEditForm] = useState<{ category_id: string; name: string; description: string }>({
    category_id: "",
    name: "",
    description: "",
  });
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
  const [bulkAttribute, setBulkAttribute] = useState<TemplateAttribute | null>(null);
  const [bulkValuesText, setBulkValuesText] = useState("");
  const [bulkSuffix, setBulkSuffix] = useState("");
  const [bulkGenerateValueId, setBulkGenerateValueId] = useState(true);
  const [bulkPrefix, setBulkPrefix] = useState("");

  return {
    createForm,
    setCreateForm,
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
  };
}
