import type { CategoryTemplate, TemplateAttribute, AttributeValue } from "@/lib/category-template";

export type UserDashboardContextType = {
  user: { id?: string } | null;
  menuItems: unknown[];
};

export type CategoryRow = {
  id: number;
  name: string;
  external_id: string | null;
};

export type ViewMode = "list" | "edit" | "apply";

export type CategoryTemplateRow = CategoryTemplate & {
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateTemplateForm = {
  category_id: string;
  name: string;
  description: string;
  is_active: boolean;
};

export type AttributeForm = {
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

export type ValueForm = {
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

export type TemplateAttributeWithValues = TemplateAttribute & {
  help_text?: string | null;
  validation_rules?: Record<string, unknown> | null;
  values: AttributeValue[];
};

export type ApplyPreview = {
  products: number;
  attributes: number;
  required: number;
  optional: number;
};
