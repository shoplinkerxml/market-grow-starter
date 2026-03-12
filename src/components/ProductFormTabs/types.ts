import type { Category } from "@/lib/category-service";

export type SupplierOption = {
  id: string;
  supplier_name: string;
};

export type CategoryOption = Category;

export type CurrencyOption = {
  id: number;
  name: string;
  code: string;
  status: boolean | null;
};

export interface ProductParam {
  id?: string;
  name: string;
  value: string;
  order_index: number;
  paramid?: string;
  valueid?: string;
  template_attribute_id?: number;
  attribute_type?: string;
  unit?: string | null;
  is_required?: boolean;
  value_options?: Array<{
    id: number;
    value: string;
    valueid?: string | null;
    display_value?: string | null;
    value_lang?: Record<string, string> | null;
  }>;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt_text?: string;
  order_index: number;
  is_main: boolean;
  object_key?: string;
}

export interface FormData {
  name: string;
  name_ua: string;
  description: string;
  description_ua: string;
  docket: string;
  docket_ua: string;
  vendor: string;
  article: string;
  external_id: string;
  supplier_id: string;
  category_id: string;
  category_external_id: string;
  category_name?: string;
  currency_code: string;
  price: number;
  price_old: number;
  price_promo: number;
  stock_quantity: number;
  available: boolean;
  is_active: boolean;
  state: string;
  store_id: string;
}

export type BasicData = Pick<
  FormData,
  | 'name'
  | 'name_ua'
  | 'description'
  | 'description_ua'
  | 'docket'
  | 'docket_ua'
  | 'vendor'
  | 'article'
  | 'external_id'
  | 'supplier_id'
  | 'category_id'
  | 'category_external_id'
  | 'category_name'
  | 'state'
  | 'store_id'
>;

export type PriceData = Pick<
  FormData,
  'currency_code' | 'price' | 'price_old' | 'price_promo'
>;

export type StockData = Pick<FormData, 'stock_quantity' | 'available' | 'is_active'>;
