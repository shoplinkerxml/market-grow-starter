import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import type { BasicData } from '@/components/ProductFormTabs/types';
import type { SupplierOption, CategoryOption, CurrencyOption } from '@/components/ProductFormTabs/types';
import { ProductService } from '@/lib/product-service';

export function useProductLookups(
  productStoreId?: string,
  initialBasic?: BasicData,
  setBasic?: Dispatch<SetStateAction<BasicData>>,
  preloadedSuppliers?: SupplierOption[],
  preloadedCurrencies?: CurrencyOption[],
  preloadedCategories?: CategoryOption[],
  preloadedSupplierCategoriesMap?: Record<string, CategoryOption[]>,
) {
  const outlet = useOutletContext<any>();
  const uid = outlet?.user?.id ? String(outlet.user.id) : 'current';

  const lookupsQuery = useQuery({
    queryKey: ['user', uid, 'lookups'],
    queryFn: async () => await ProductService.getUserLookups(),
    staleTime: 900_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
    enabled:
      preloadedSuppliers === undefined ||
      preloadedCurrencies === undefined ||
      preloadedSupplierCategoriesMap === undefined,
  });

  const querySuppliers = useMemo<SupplierOption[]>(() => {
    const list = (lookupsQuery.data as any)?.suppliers;
    if (!Array.isArray(list)) return [];
    return (list || []).map((s: any) => ({
      id: String(s?.id ?? ''),
      supplier_name: String(s?.supplier_name ?? ''),
    }));
  }, [lookupsQuery.data]);

  const queryCurrencies = useMemo<CurrencyOption[]>(() => {
    const list = (lookupsQuery.data as any)?.currencies;
    if (!Array.isArray(list)) return [];
    return (list || []).map((c: any) => ({
      id: Number(c?.id ?? 0),
      name: String(c?.name ?? ''),
      code: String(c?.code ?? ''),
      status: c?.status ?? null,
    }));
  }, [lookupsQuery.data]);

  const querySupplierCategoriesMap = useMemo<Record<string, CategoryOption[]>>(() => {
    const raw = (lookupsQuery.data as any)?.supplierCategoriesMap;
    if (!raw || typeof raw !== 'object') return {};
    const entries = Object.entries(raw as Record<string, any[]>);
    return Object.fromEntries(
      entries.map(([sid, list]) => [
        String(sid),
        (Array.isArray(list) ? list : []).map((c: any) => ({
          id: String(c?.id ?? ''),
          name: String(c?.name ?? ''),
          external_id: String(c?.external_id ?? ''),
          supplier_id: String(c?.supplier_id ?? ''),
          parent_external_id: c?.parent_external_id == null ? null : String(c.parent_external_id),
        })),
      ]),
    );
  }, [lookupsQuery.data]);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>(preloadedSuppliers || []);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>(preloadedCurrencies || []);
  const [categories, setCategories] = useState<CategoryOption[]>(preloadedCategories || []);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');

  // ✅ Стабілізуємо setBasic через ref, щоб не додавати в залежності
  const setBasicRef = useRef(setBasic);
  useEffect(() => {
    setBasicRef.current = setBasic;
  }, [setBasic]);

  // ✅ Стабілізуємо supplier_id та category_id через примітиви
  const supplierId = useMemo(() => String(initialBasic?.supplier_id || ''), [initialBasic?.supplier_id]);
  const categoryId = useMemo(() => String(initialBasic?.category_id || ''), [initialBasic?.category_id]);
  const categoryExternalId = useMemo(() => String(initialBasic?.category_external_id || ''), [initialBasic?.category_external_id]);
  const categoryName = useMemo(() => initialBasic?.category_name || '', [initialBasic?.category_name]);

  // ✅ Мемоізуємо selectedSupplierName
  const selectedSupplierName = useMemo(() => {
    if (!supplierId) return '';
    const found = suppliers.find(s => String(s.id) === supplierId);
    return (found as any)?.supplier_name || '';
  }, [suppliers, supplierId]);

  // ✅ Стабільна функція getCategoriesFromMap
  const getCategoriesFromMap = useCallback((sid: string): CategoryOption[] => {
    const map = preloadedSupplierCategoriesMap ?? querySupplierCategoriesMap;
    return map?.[String(sid || '')] || [];
  }, [preloadedSupplierCategoriesMap, querySupplierCategoriesMap]);

  useEffect(() => {
    const next = preloadedSuppliers ?? querySuppliers;
    if (next !== suppliers) setSuppliers(next);
  }, [preloadedSuppliers, querySuppliers, suppliers]);

  useEffect(() => {
    const next = preloadedCurrencies ?? queryCurrencies;
    if (next !== currencies) setCurrencies(next);
  }, [preloadedCurrencies, queryCurrencies, currencies]);

  useEffect(() => {
    if (!productStoreId && !supplierId && suppliers.length) {
      const firstId = String(suppliers[0].id);
      setBasicRef.current?.((prev: BasicData) => ({ ...prev, supplier_id: firstId }));
    }
  }, [productStoreId, supplierId, suppliers]);

  // ✅ ЕФЕКТ 3: Оновлення categories при зміні supplier_id
  useEffect(() => {
    if (supplierId) {
      const newCategories = getCategoriesFromMap(supplierId);
      setCategories(newCategories);
    }
  }, [supplierId, getCategoriesFromMap]);

  useEffect(() => {
    if (!categoryId) {
      setSelectedCategoryName('');
      return;
    }
    if (categories.length === 0) {
      setSelectedCategoryName(categoryName || '');
      return;
    }
    const found = categories.find(c => String(c.id) === categoryId);
    if (found?.name) {
      setSelectedCategoryName(found.name);
      if (categoryName !== found.name) {
        setBasicRef.current?.((prev: BasicData) => ({
          ...prev,
          category_name: found.name || '',
        }));
      }
      return;
    }
    setSelectedCategoryName(categoryName || '');
  }, [categoryId, categories, categoryName]);

  // ✅ ЕФЕКТ 5: Синхронізація category по external_id
  useEffect(() => {
    if (!categoryExternalId || categories.length === 0) return;

    const found = categories.find(c => String(c.external_id || '') === categoryExternalId);
    if (!found) return;

    const nextId = String(found.id || '');
    const nextName = found.name || '';

    setSelectedCategoryName(nextName);

    // Оновлюємо тільки якщо дані змінились
    if (categoryId !== nextId || categoryName !== nextName) {
      setBasicRef.current?.((prev: BasicData) => ({
        ...prev,
        category_id: nextId,
        category_name: nextName,
      }));
    }
  }, [categories, categoryExternalId, categoryId, categoryName]);

  return {
    suppliers,
    currencies,
    categories,
    selectedCategoryName,
    setSelectedCategoryName,
    selectedSupplierName,
    setSuppliers,
    setCurrencies,
    setCategories,
    getCategoriesFromMap,
  };
}
