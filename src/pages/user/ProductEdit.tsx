import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressiveLoader, FullPageLoader } from "@/components/LoadingSkeletons";
import { ArrowLeft, Package } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useI18n } from '@/i18n';
import { ProductFormTabs } from '@/components/ProductFormTabs';
import { ProductService, type Product, type ProductParam, type ProductAggregated } from '@/lib/product-service';
import { CategoryService } from '@/lib/category-service';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from 'sonner';

type LookupCategory = {
  id: string;
  name: string;
  external_id: string;
  supplier_id: string;
  parent_external_id: string | null;
};

type UserLookups = {
  suppliers: Array<{ id: string; supplier_name: string }>;
  currencies: Array<{ id: number; name: string; code: string; status: boolean | null }>;
  supplierCategoriesMap: Record<string, LookupCategory[]>;
};

export const ProductEdit = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryName, setCategoryName] = useState<string>('');
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  const [lookups, setLookups] = useState<UserLookups | null>(null);
  const [supplierCategories, setSupplierCategories] = useState<LookupCategory[]>([]);
  const supplierCategoriesMapRef = useRef<Record<string, LookupCategory[]>>({});
  const preloadedImagesRef = useRef<Array<{ id?: string; url: string; order_index: number; is_main: boolean; alt_text?: string }> | undefined>(undefined);
  const preloadedParamsRef = useRef<Array<{ id?: string; name: string; value: string; order_index: number; paramid?: string; valueid?: string }> | undefined>(undefined);

  const patchProductsCached = useCallback((productId: string, patch: Partial<ProductAggregated>) => {
    const pid = String(productId);
    queryClient.setQueriesData({ queryKey: ["user", uid, "products"], exact: false }, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return (old as any[]).map((p) => (String((p as any)?.id) === pid ? { ...(p as any), ...patch } : p));
      }
      if (typeof old === "object" && Array.isArray((old as any).pages)) {
        const prev = old as any;
        return {
          ...prev,
          pages: prev.pages.map((page: any) => {
            const products = Array.isArray(page?.products) ? (page.products as any[]) : null;
            if (!products) return page;
            return {
              ...page,
              products: products.map((p) => (String((p as any)?.id) === pid ? { ...(p as any), ...patch } : p)),
            };
          }),
        };
      }
      return old;
    });
  }, [queryClient, uid]);

  const lookupsQuery = useQuery({
    queryKey: ["user", uid, "lookups"],
    queryFn: async () => {
      return await ProductService.getUserLookups();
    },
    staleTime: 900_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
  });

  useEffect(() => {
    const loadProductAgg = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const agg = await ProductService.getProductEditData(id);
        setProduct(agg.product);
        preloadedImagesRef.current = (agg.images || []) as Array<{ id?: string; url: string; order_index: number; is_main: boolean; alt_text?: string }>;
        preloadedParamsRef.current = (agg.params || []) as Array<{ id?: string; name: string; value: string; order_index: number; paramid?: string; valueid?: string }>;
        if (agg.categoryName) setCategoryName(agg.categoryName);
        if (agg.suppliers || agg.currencies || agg.supplierCategoriesMap) {
          const nextLookups: UserLookups = {
            suppliers: Array.isArray(agg.suppliers) ? agg.suppliers : [],
            currencies: Array.isArray(agg.currencies) ? agg.currencies : [],
            supplierCategoriesMap: agg.supplierCategoriesMap || {},
          };
          setLookups(nextLookups);
          supplierCategoriesMapRef.current = nextLookups.supplierCategoriesMap || {};
          const sid = agg.product?.supplier_id != null ? String(agg.product.supplier_id) : "";
          setSupplierCategories(sid ? (nextLookups.supplierCategoriesMap?.[sid] || []) : []);
        }
      } catch (error) {
        console.error('Failed to load product:', error);
        toast.error(t('failed_load_products'));
      } finally {
        setLoading(false);
      }
    };
    loadProductAgg();
  }, [id, t]);

  useEffect(() => {
    const data = lookupsQuery.data as any;
    if (!data) return;
    const nextLookups: UserLookups = {
      suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
      currencies: Array.isArray(data.currencies) ? data.currencies : [],
      supplierCategoriesMap: data.supplierCategoriesMap || {},
    };
    setLookups(nextLookups);
    supplierCategoriesMapRef.current = nextLookups.supplierCategoriesMap || {};
  }, [lookupsQuery.data]);

  const supplierId = useMemo(() => {
    return product?.supplier_id != null ? String(product.supplier_id) : "";
  }, [product?.supplier_id]);

  useEffect(() => {
    const map = lookups?.supplierCategoriesMap || {};
    setSupplierCategories(supplierId ? (map[supplierId] || []) : []);
  }, [lookups?.supplierCategoriesMap, supplierId]);

  useEffect(() => {
    if (categoryName) return;
    const loadCategoryName = async () => {
      if (!product) return;
      try {
        if (product.category_id) {
          const cat = await CategoryService.getById(product.category_id);
          setCategoryName(cat?.name || '');
          return;
        }
        if (product.supplier_id && product.category_external_id) {
          const cat = await CategoryService.getByExternalId(String(product.supplier_id), product.category_external_id);
          setCategoryName(cat?.name || '');
        }
      } catch (e) {
        setCategoryName('');
      }
    };
    loadCategoryName();
  }, [product, categoryName]);

  const handleCancel = () => {
    navigate('/user/products');
  };

  type FormDataInput = {
    external_id: string;
    category_id?: number | string | null;
    category_external_id?: string | null;
    supplier_id?: number | string | null;
    currency_code?: string | null;
    name: string;
    name_ua?: string | null;
    docket?: string | null;
    docket_ua?: string | null;
    vendor?: string | null;
    article?: string | null;
    available?: boolean;
    stock_quantity?: number | string;
    price?: number;
    price_old?: number;
    price_promo?: number;
    description?: string | null;
    description_ua?: string | null;
    state?: string;
  };
  const handleFormSubmit = async ({ formData, images, parameters }: { formData: FormDataInput; images: Array<{ url: string; order_index: number; is_main: boolean; object_key?: string }>; parameters: ProductParam[] }) => {
    if (!id) return;
    const payload: any = {
      external_id: formData.external_id,
      category_id: formData.category_id || null,
      category_external_id: formData.category_external_id ? String(formData.category_external_id) : undefined,
      supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
      currency_code: formData.currency_code || null,
      name: formData.name,
      name_ua: formData.name_ua || null,
      docket: formData.docket || null,
      docket_ua: formData.docket_ua || null,
      vendor: formData.vendor || null,
      article: formData.article || null,
      available: !!formData.available,
      stock_quantity: Number(formData.stock_quantity) || 0,
      price: typeof formData.price === 'number' ? formData.price : null,
      price_old: typeof formData.price_old === 'number' ? formData.price_old : null,
      price_promo: typeof formData.price_promo === 'number' ? formData.price_promo : null,
      description: formData.description || null,
      description_ua: formData.description_ua || null,
      state: formData.state || 'new',
      params: parameters || [],
    };
    const mappedImages = (images || []).map((img, index: number) => ({
      url: img.url,
      order_index: typeof img.order_index === 'number' ? img.order_index : index,
      is_main: !!img.is_main,
      object_key: img.object_key,
    }));
    if (mappedImages.length > 0) payload.images = mappedImages;

    try {
      const cidNum = formData.category_id ? Number(formData.category_id) : null;
      let catName = '';
      if (cidNum != null) {
        const map = supplierCategoriesMapRef.current || {};
        const all = Object.values(map).flat();
        const found = all.find((c) => String((c as any).id) === String(cidNum));
        catName = (found as any)?.name || '';
      } else if (formData.supplier_id && formData.category_external_id) {
        const map = supplierCategoriesMapRef.current || {};
        const arr = map[String(formData.supplier_id)] || [];
        const found = arr.find((c) => String(c.external_id) === String(formData.category_external_id));
        catName = found?.name || '';
      }
      const patch: Partial<Product> = {
        name: formData.name,
        name_ua: formData.name_ua || null,
        vendor: formData.vendor || null,
        article: formData.article || null,
        price: typeof formData.price === 'number' ? formData.price : null,
        price_old: typeof formData.price_old === 'number' ? formData.price_old : null,
        price_promo: typeof formData.price_promo === 'number' ? formData.price_promo : null,
        available: !!formData.available,
        stock_quantity: Number(formData.stock_quantity) || 0,
        category_id: cidNum ?? null,
        category_external_id: formData.category_external_id || null,
      };
      patchProductsCached(String(id), {
        ...(patch as Partial<ProductAggregated>),
        currency_code: formData.currency_code || null,
        categoryName: catName || undefined,
      });
    } catch { void 0; }

    navigate('/user/products');
    void ProductService.updateProduct(id, payload)
      .then(() => {
        toast.success(t('product_updated'));
        queryClient.invalidateQueries({ queryKey: ["user", uid, "products"], exact: false });
      })
      .catch((error) => {
        console.error('Failed to save product:', error);
        toast.error(t('failed_save_product'));
        queryClient.invalidateQueries({ queryKey: ["user", uid, "products"], exact: false });
      });
  };

  const pageBreadcrumbs = [
    { label: t('breadcrumb_home'), href: '/user', current: false },
    { label: t('products_title'), href: '/user/products', current: false },
    { label: categoryName || '—', current: true }
  ];

  return (
    <div className="px-2 sm:px-6 py-3 sm:py-6 space-y-6" data-testid="product_edit_page">
      <PageHeader
        title={t('edit_product')}
        description={t('edit_product_description')}
        breadcrumbItems={pageBreadcrumbs}
        actions={
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
              data-testid="header_back_button"
              title={t('back_to_products')}
            >
              <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-7 h-7 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Button>
          </div>
        }
      />

      <ProgressiveLoader
        isLoading={loading}
        delay={150}
        fallback={
            <FullPageLoader
              title="Завантаження товару…"
              subtitle="Готуємо форму редагування, дані та зображення"
              icon={Package}
            />
        }
      >
        <div className="relative min-h-[clamp(12rem,50vh,24rem)]" aria-busy={loading}>
          <ProductFormTabs
            product={product || undefined}
            overrides={categoryName ? { category_name: categoryName } : undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            onImagesLoadingChange={setImagesLoading}
            preloadedImages={preloadedImagesRef.current}
            preloadedParams={preloadedParamsRef.current}
            preloadedSuppliers={lookups?.suppliers}
            preloadedCurrencies={lookups?.currencies}
            preloadedCategories={supplierCategories}
            preloadedSupplierCategoriesMap={lookups?.supplierCategoriesMap}
          />
        </div>
      </ProgressiveLoader>
    </div>
  );
};

export default ProductEdit;
