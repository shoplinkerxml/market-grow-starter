import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Product } from '@/lib/product-service';
import type { BasicData, PriceData, StockData, FormData } from '@/components/ProductFormTabs/types';

type FormState = { basic: BasicData; price: PriceData; stock: StockData };

type InitArg = { product?: Product | null; overrides?: Partial<FormData> };

type Action =
  | { type: 'SET_FROM_PRODUCT'; product: Product }
  | { type: 'APPLY_OVERRIDES'; overrides: Partial<FormData> }
  | { type: 'UPDATE_FIELD'; field: keyof FormData; value: FormData[keyof FormData] }
  | { type: 'UPDATE_MULTIPLE'; payload: Partial<FormData> }
  | { type: 'SET_BASIC'; value: SetStateAction<BasicData> }
  | { type: 'SET_PRICE'; value: SetStateAction<PriceData> }
  | { type: 'SET_STOCK'; value: SetStateAction<StockData> };

const emptyBasic: BasicData = {
  name: '',
  name_ua: '',
  description: '',
  description_ua: '',
  docket: '',
  docket_ua: '',
  vendor: '',
  article: '',
  external_id: '',
  supplier_id: '',
  category_id: '',
  category_external_id: '',
  category_name: '',
  state: 'new',
  store_id: '',
};

const emptyPrice: PriceData = {
  currency_code: 'UAH',
  price: 0,
  price_old: 0,
  price_promo: 0,
};

const emptyStock: StockData = {
  stock_quantity: 0,
  available: true,
};

function stateFromProduct(product: Product): FormState {
  const supplierId = (product as any).supplier_id ?? null;
  const categoryId = product.category_id ?? null;
  const categoryExternalId = (product as any).category_external_id ?? null;
  const categoryName = (product as any).categoryName ?? (product as any).category_name ?? '';

  const docketRu = (product as any).docket || '';
  const docketUa = (product as any).docket_ua || '';

  return {
    basic: {
      ...emptyBasic,
      name: product.name || product.name_ua || '',
      name_ua: product.name_ua || product.name || '',
      description: product.description || product.description_ua || '',
      description_ua: product.description_ua || product.description || '',
      docket: docketRu || docketUa || '',
      docket_ua: docketUa || docketRu || '',
      vendor: product.vendor || '',
      article: product.article || '',
      external_id: product.external_id || '',
      supplier_id: supplierId ? String(supplierId) : '',
      category_id: categoryId ? String(categoryId) : '',
      category_external_id: categoryExternalId ? String(categoryExternalId) : '',
      category_name: categoryName ? String(categoryName) : '',
      state: product.state || 'new',
      store_id: product.store_id || '',
    },
    price: {
      ...emptyPrice,
      currency_code: (product as any).currency_code || 'UAH',
      price: product.price || 0,
      price_old: product.price_old || 0,
      price_promo: product.price_promo || 0,
    },
    stock: {
      ...emptyStock,
      stock_quantity: product.stock_quantity || 0,
      available: product.available ?? true,
    },
  };
}

function mergePayload(state: FormState, payload: Partial<FormData>): FormState {
  if (!payload || Object.keys(payload).length === 0) return state;

  let nextBasic = state.basic;
  let nextPrice = state.price;
  let nextStock = state.stock;
  let changedBasic = false;
  let changedPrice = false;
  let changedStock = false;

  for (const key of Object.keys(payload) as Array<keyof FormData>) {
    const value = payload[key];
    if (typeof value === 'undefined') continue;

    if (key in emptyPrice) {
      if (!changedPrice) {
        nextPrice = { ...nextPrice };
        changedPrice = true;
      }
      (nextPrice as any)[key] = value;
      continue;
    }

    if (key in emptyStock) {
      if (!changedStock) {
        nextStock = { ...nextStock };
        changedStock = true;
      }
      (nextStock as any)[key] = value;
      continue;
    }

    if (key in emptyBasic) {
      if (!changedBasic) {
        nextBasic = { ...nextBasic };
        changedBasic = true;
      }
      (nextBasic as any)[key] = value;
    }
  }

  if (!changedBasic && !changedPrice && !changedStock) return state;
  return { basic: nextBasic, price: nextPrice, stock: nextStock };
}

function applyOverrides(state: FormState, overrides: Partial<FormData>): FormState {
  return mergePayload(state, overrides);
}

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'SET_FROM_PRODUCT': {
      return stateFromProduct(action.product);
    }
    case 'APPLY_OVERRIDES': {
      return applyOverrides(state, action.overrides);
    }
    case 'UPDATE_FIELD': {
      return mergePayload(state, { [action.field]: action.value } as Partial<FormData>);
    }
    case 'UPDATE_MULTIPLE': {
      return mergePayload(state, action.payload);
    }
    case 'SET_BASIC': {
      const next = typeof action.value === 'function' ? (action.value as any)(state.basic) : action.value;
      return { ...state, basic: next };
    }
    case 'SET_PRICE': {
      const next = typeof action.value === 'function' ? (action.value as any)(state.price) : action.value;
      return { ...state, price: next };
    }
    case 'SET_STOCK': {
      const next = typeof action.value === 'function' ? (action.value as any)(state.stock) : action.value;
      return { ...state, stock: next };
    }
    default: {
      return state;
    }
  }
}

export function useProductForm(product?: Product | null, overrides?: Partial<FormData>) {
  const [state, dispatch] = useReducer(reducer, { product, overrides } as InitArg, (arg) => {
    const base = arg.product ? stateFromProduct(arg.product) : { basic: emptyBasic, price: emptyPrice, stock: emptyStock };
    return applyOverrides(base, arg.overrides || {});
  });

  const formData = useMemo<FormData>(() => ({
    ...state.basic,
    ...state.price,
    ...state.stock,
  }), [state.basic, state.price, state.stock]);

  const updateBasicData = useCallback((partial: Partial<BasicData>) => {
    dispatch({ type: 'UPDATE_MULTIPLE', payload: partial });
  }, []);

  useEffect(() => {
    if (!product) return;
    dispatch({ type: 'SET_FROM_PRODUCT', product });
  }, [product]);

  useEffect(() => {
    if (!overrides || Object.keys(overrides).length === 0) return;
    dispatch({ type: 'APPLY_OVERRIDES', overrides });
  }, [overrides]);

  const updateFormData = useCallback((payload: Partial<FormData>) => {
    dispatch({ type: 'UPDATE_MULTIPLE', payload });
  }, []);

  const setBasicData: Dispatch<SetStateAction<BasicData>> = useCallback((value) => {
    dispatch({ type: 'SET_BASIC', value });
  }, []);

  const setPriceData: Dispatch<SetStateAction<PriceData>> = useCallback((value) => {
    dispatch({ type: 'SET_PRICE', value });
  }, []);

  const setStockData: Dispatch<SetStateAction<StockData>> = useCallback((value) => {
    dispatch({ type: 'SET_STOCK', value });
  }, []);

  return {
    basicData: state.basic,
    priceData: state.price,
    stockData: state.stock,
    formData,
    setBasicData,
    setPriceData,
    setStockData,
    updateBasicData,
    updateFormData,
  };
}
