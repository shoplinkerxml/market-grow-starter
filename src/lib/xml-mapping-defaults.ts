// Default YML/XML supplier mapping used as a fallback when a supplier has no
// active mapping row in `supplier_xml_mappings`.

export type FieldMapping = string | string[];

export interface XmlMappingFields {
  name?: FieldMapping;
  name_ua?: FieldMapping;
  description?: FieldMapping;
  price?: FieldMapping;
  price_old?: FieldMapping;
  currency_code?: FieldMapping;
  vendor?: FieldMapping;
  article?: FieldMapping;
  category_external_id?: FieldMapping;
  stock_quantity?: FieldMapping;
  available?: FieldMapping;
}

export interface XmlMappingImages {
  tag: string;
}

export interface XmlMappingParams {
  tag: string;
  name_attr: string;
  unit_attr?: string;
}

export interface XmlMappingCategory {
  // Reserved for future: per-mapping category tree extraction.
  tag?: string;
  id_attr?: string;
  parent_attr?: string;
}

export interface XmlMapping {
  xpath_item: string; // container tag name (e.g. "offer")
  fields: XmlMappingFields;
  images: XmlMappingImages;
  params: XmlMappingParams;
  category: XmlMappingCategory;
  currency: string | null;
}

export const DEFAULT_YML_MAPPING: XmlMapping = {
  xpath_item: "offer",
  fields: {
    name: "name",
    name_ua: "name_ua",
    description: "description",
    price: "price",
    price_old: "oldprice",
    currency_code: "currencyid",
    vendor: "vendor",
    article: ["vendorcode", "article"],
    category_external_id: "categoryid",
    stock_quantity: ["stock_quantity", "quantity_in_stock"],
  },
  images: { tag: "picture" },
  params: { tag: "param", name_attr: "name", unit_attr: "unit" },
  category: {},
  currency: null,
};
