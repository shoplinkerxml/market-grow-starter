import { useMemo } from "react";
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { ProductFormTabs } from '@/components/ProductFormTabs';
import { ProductService, type ProductImage, type ProductParam } from "@/lib/product-service";
import { useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from "sonner";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
 
import type { SupplierOption, CategoryOption, CurrencyOption } from '@/components/ProductFormTabs/types';
import type { ProductRow } from "@/components/user/products/ProductsTable/columns";

export const ProductCreate = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tariffLimits, user } = useOutletContext<{ tariffLimits: Array<{ limit_name: string; value: number }>; user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const productLimit = useMemo(() => {
    return (
      (tariffLimits || [])
        .find((l) => {
          const n = String(l.limit_name || "").toLowerCase();
          return n.includes("товар") || n.includes("product");
        })?.value ?? 0
    );
  }, [tariffLimits]);

  const productsCountQuery = useQuery<number>({
    queryKey: ["user", uid, "products", "count"],
    queryFn: async () => {
      const baseKey = ["user", uid, "products", "all"] as const;
      const cachedAll = queryClient.getQueriesData({ queryKey: baseKey, exact: false });
      for (const [, data] of cachedAll) {
        const cached = data as InfiniteData<{ products: ProductRow[]; page: { total: number } }> | undefined;
        const firstTotal = cached?.pages?.[0]?.page?.total;
        if (typeof firstTotal === "number") return firstTotal;
      }
      return await ProductService.getProductsCount();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as number | undefined,
  });

  const lookupsQuery = useQuery({
    queryKey: ["user", uid, "lookups"],
    queryFn: async () => {
      return await ProductService.getUserLookups();
    },
    staleTime: 900_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
  });

  const preloadedSuppliers: SupplierOption[] = useMemo(() => {
    const aggSuppliers = lookupsQuery.data?.suppliers || [];
    return (aggSuppliers || []).map((s: any) => ({
      id: String(s.id),
      supplier_name: String(s.supplier_name || ""),
    }));
  }, [lookupsQuery.data?.suppliers]);

  const preloadedSupplierCategoriesMap: Record<string, CategoryOption[]> = useMemo(() => {
    const supplierCategoriesMap = lookupsQuery.data?.supplierCategoriesMap || {};
    return Object.fromEntries(
      Object.entries(supplierCategoriesMap || {}).map(([sid, list]) => [
        sid,
        (list || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name || ""),
          external_id: String(c.external_id || ""),
          supplier_id: String(c.supplier_id || ""),
          parent_external_id: c.parent_external_id == null ? null : String(c.parent_external_id),
        })),
      ]),
    );
  }, [lookupsQuery.data?.supplierCategoriesMap]);

  const preloadedCurrencies: CurrencyOption[] = useMemo(() => {
    const aggCurrencies = lookupsQuery.data?.currencies || [];
    return (aggCurrencies || []).map((c: any) => ({
      id: Number(c.id),
      name: String(c.name || ""),
      code: String(c.code || ""),
      status: c.status ?? null,
    }));
  }, [lookupsQuery.data?.currencies]);

  const current = productsCountQuery.data ?? 0;
  const canCreate = current < productLimit;

  const handleCancel = () => {
    navigate('/user/products');
  };

  // Восстанавливаем старый интерфейс: onSubmit получает formData, images, parameters
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
  const handleFormSubmit = async ({ formData, images, parameters }: { formData: FormDataInput; images: (ProductImage & { object_key?: string })[]; parameters: ProductParam[] }) => {
    try {
      await ProductService.createProduct({
        external_id: formData.external_id,
        category_id: formData.category_id || null,
        category_external_id: formData.category_external_id || null,
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
        images: (images || []).map((img, index: number) => ({
          url: img.url,
          order_index: typeof img.order_index === 'number' ? img.order_index : index,
          is_main: !!img.is_main
        }))
      });
      queryClient.setQueryData(["user", uid, "products", "count"], (prev: number | undefined) => {
        const v = typeof prev === "number" ? prev : current;
        return Math.max(0, v + 1);
      });
      toast.success(t('product_created'));
      navigate('/user/products');
    } catch {
      toast.error(t('failed_create_product'));
    }
  };

  return (
    <div className="px-2 sm:px-6 py-3 sm:py-6 space-y-6" data-testid="product_create_page">
      <PageHeader
        title={t('create_product')}
        description={t('create_product_description')}
        breadcrumbItems={breadcrumbs}
        className="pl-6"
        actions={
          <div className="flex gap-2 items-center">
            <Badge variant="outline" className="text-sm flex items-center gap-1.5 shrink-0">
              <Package className="h-4 w-4" />
              <span>{current} / {productLimit}</span>
            </Badge>
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="shrink-0 group inline-flex items-center gap-2 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
              data-testid="header_back_button"
              title={t('back_to_products')}
            >
              <span className="inline sm:hidden">{t('back_to_products')}</span>
              <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-8 h-8 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Button>
          </div>
        }
      />

      <ProductFormTabs
        product={undefined}
        onSubmit={handleFormSubmit}
        onCancel={handleCancel}
        preloadedSuppliers={preloadedSuppliers}
        preloadedCurrencies={preloadedCurrencies}
        preloadedSupplierCategoriesMap={preloadedSupplierCategoriesMap}
      />
    </div>
  );
};
