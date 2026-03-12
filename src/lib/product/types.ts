export interface Product {
  id: string;
  store_id: string;
  supplier_id?: number | null;
  external_id: string;
  name: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | null;
  category_external_id?: string | null;
  currency_id?: string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity: number;
  available: boolean;
  state: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

export interface ProductParam {
  id?: string;
  product_id?: string;
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
  product_id?: string;
  url: string;
  order_index: number;
  is_main?: boolean;
  alt_text?: string;
}

export interface ProductAggregated extends Product {
  mainImageUrl?: string;
  categoryName?: string;
  supplierName?: string;
  linkedStoreIds?: string[];
}

export interface CreateProductData {
  store_id?: string;
  external_id: string;
  name: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | string | null;
  category_external_id?: string | null;
  supplier_id?: number | string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity?: number;
  available?: boolean;
  state?: string;
  params?: ProductParam[];
  images?: ProductImage[];
  links?: Array<{
    store_id: string;
    is_active?: boolean;
    custom_price?: number | null;
    custom_price_promo?: number | null;
    custom_stock_quantity?: number | null;
    custom_available?: boolean | null;
    custom_name?: string | null;
    custom_description?: string | null;
    custom_category_id?: number | null;
  }>;
}

export interface UpdateProductData {
  store_id?: string;
  external_id?: string;
  name?: string;
  name_ua?: string | null;
  docket?: string | null;
  docket_ua?: string | null;
  description?: string | null;
  description_ua?: string | null;
  vendor?: string | null;
  article?: string | null;
  category_id?: number | string | null;
  category_external_id?: string | null;
  supplier_id?: number | string | null;
  currency_code?: string | null;
  price?: number | null;
  price_old?: number | null;
  price_promo?: number | null;
  stock_quantity?: number;
  available?: boolean;
  is_active?: boolean;
  state?: string;
  params?: ProductParam[];
  images?: ProductImage[];
}

export interface ProductLimitInfo {
  current: number;
  max: number;
  canCreate: boolean;
}

export type ProductListPage = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
  total: number;
};

export type ProductListResponseObj = {
  products?: ProductAggregated[];
  page?: ProductListPage;
};

export interface StoreProductLink {
  is_active?: boolean;
  custom_price?: number | null;
  custom_price_old?: number | null;
  custom_price_promo?: number | null;
  custom_stock_quantity?: number | null;
  custom_available?: boolean | null;
  custom_name?: string | null;
  custom_description?: string | null;
  custom_category_id?: string | null;
}

export type StoreProductLinkPatchInput = Partial<StoreProductLink>;
