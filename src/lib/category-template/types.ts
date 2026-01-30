export type CategoryTemplate = {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type TemplateAttribute = {
  id: number;
  template_id: number;
  name: string;
  paramid: string | null;
  attribute_type: string;
  is_required: boolean;
  unit: string | null;
  default_value: string | null;
  is_filterable: boolean;
  is_active: boolean;
  display_order: number | null;
};

export type AttributeValue = {
  id: number;
  attribute_id: number;
  value: string;
  valueid: string | null;
  display_value: string | null;
  display_order: number | null;
  is_active: boolean;
  value_lang?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
};
