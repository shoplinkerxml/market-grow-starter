import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, Settings, Share2, Package, List, Store as StoreIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { ProductsTable } from '@/components/user/products/ProductsTable';
import { FullPageLoader } from '@/components/LoadingSkeletons';
import { ExportDialog } from '@/components/user/shops/ExportDialog';
import { ShopStructureEditor } from '@/components/user/shops/ShopStructureEditor';

import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { ShopService, type ShopAggregated } from '@/lib/shop-service';
import { ProductService, type Product } from '@/lib/product-service';
import { useShopRealtimeSync } from "@/hooks/useShopRealtimeSync";
import { ShopCountsService } from "@/lib/shop-counts";

export const ShopDetail = () => {
  const { id } = useParams<{ id: string }>();
  const shopId = id ? String(id) : "";
  const navigate = useNavigate();
  const location = useLocation();
  const initialPathRef = useRef<string>(location.pathname);
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const isReload = useMemo(() => {
    try {
      const entries = typeof performance !== "undefined" ? (performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]) : [];
      const navType = entries?.[0]?.type;
      if (navType === "reload") return true;
      const legacy = (performance as unknown as { navigation?: { type?: number } })?.navigation?.type;
      return legacy === 1;
    } catch {
      return false;
    }
  }, []);

  const modalAction = useMemo(() => {
    const p = String(location.pathname || "");
    if (!shopId) return null;
    if (p.endsWith(`/user/shops/${shopId}/structure`)) return "structure" as const;
    if (p.endsWith(`/user/shops/${shopId}/export`)) return "export" as const;
    if (p.endsWith("/structure")) return "structure" as const;
    if (p.endsWith("/export")) return "export" as const;
    return null;
  }, [location.pathname, shopId]);

  const closeModal = useCallback(() => {
    if (!shopId) return;
    navigate(`/user/shops/${shopId}`);
  }, [navigate, shopId]);

  useEffect(() => {
    if (!shopId) navigate('/user/shops');
  }, [shopId, navigate]);

  useEffect(() => {
    if (!shopId || !modalAction) return;
    if (!isReload) return;
    if (location.pathname !== initialPathRef.current) return;
    navigate(`/user/shops/${shopId}`, { replace: true });
  }, [isReload, location.pathname, modalAction, navigate, shopId]);

  const { data: shopsList, isLoading, isError } = useQuery<ShopAggregated[]>({
    queryKey: ["user", uid, "shops"],
    queryFn: async () => await ShopService.getShopsAggregated(),
    enabled: true,
    retry: false,
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => (prev || []) as ShopAggregated[],
  });

  const shop: ShopAggregated | null = useMemo(() => {
    const list = Array.isArray(shopsList) ? shopsList : [];
    const found = list.find((s) => String(s.id) === String(shopId));
    return found ?? null;
  }, [shopsList, shopId]);

  useShopRealtimeSync({ 
    shopId: shopId, 
    userId: uid,
    enabled: !!shopId
  });

  const shopBreadcrumbs = useMemo(() => {
    const marketplace = shop?.marketplace ? String(shop.marketplace) : '';
    const label = marketplace || shop?.store_name || t('loading') || 'Завантаження...';
    return [...breadcrumbs, { label, current: true }];
  }, [breadcrumbs, shop?.marketplace, shop?.store_name, t]);

  const handleDeleteProduct = useCallback(
    async (product: Product) => {
      if (!shopId) return;

      try {
        const { deletedByStore, categoryNamesByStore } = await ProductService.bulkRemoveStoreProductLinks(
          [String(product.id)],
          [shopId]
        );

        const list = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]) || [];
        const current = (list || []).find((s) => String(s.id) === String(shopId)) ?? null;
        const baseProductsCount = Math.max(0, Number(current?.productsCount ?? 0));
        const baseCategoriesCount = Math.max(0, Number(current?.categoriesCount ?? 0));
        const deleted = Math.max(0, Number(deletedByStore?.[String(shopId)] ?? 1) || 0);
        const nextProductsCount = Math.max(0, baseProductsCount - deleted);
        const cats = categoryNamesByStore?.[String(shopId)];
        const nextCategoriesCount =
          nextProductsCount === 0
            ? 0
            : Array.isArray(cats)
              ? cats.length
              : baseCategoriesCount;

        ShopCountsService.set(queryClient, uid, shopId, {
          productsCount: nextProductsCount,
          categoriesCount: nextCategoriesCount,
        });
        
        toast.success(t('product_removed_successfully') || 'Товар видалено');
      } catch (error) {
        console.error('[ShopDetail] Delete error:', error);
        toast.error(t('failed_remove_from_store') || 'Помилка видалення');
      }
    },
    [shopId, queryClient, t, uid]
  );

  if (isLoading) {
    return (
      <FullPageLoader
        title={t('loading_shop') || 'Завантаження магазину…'}
        subtitle={t('loading_shop_subtitle') || 'Готуємо панель керування'}
        icon={StoreIcon}
      />
    );
  }

  if (isError || !shop) {
    return (
      <div className="p-6">
        <Empty className="border max-w-lg mx-auto">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StoreIcon className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>{t('shop_not_found') || 'Магазин не знайдено'}</EmptyTitle>
            <EmptyDescription>
              {t('shop_not_found_description') || 'Перевірте посилання або поверніться до списку.'}
            </EmptyDescription>
          </EmptyHeader>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => navigate('/user/shops')}>
              {t('go_to_shops') || 'До магазинів'}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  const productsCount = Math.max(0, Number(shop.productsCount ?? 0));
  const categoriesCount =
    productsCount === 0 ? 0 : Math.max(0, Number(shop.categoriesCount ?? 0));

  return (
    <>
      <div className="p-6 space-y-6">
        <PageHeader
          title={shop.store_name}
          description={`${t('managing_shop') || 'Управління магазином'} ${shop.store_name}`}
          breadcrumbItems={shopBreadcrumbs}
          actions={
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 mr-1">
                <span className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-1">
                  <Package className="h-3 w-3" />
                  <span>{productsCount}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-1">
                  <List className="h-3 w-3" />
                  <span>{categoriesCount}</span>
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => navigate(`/user/shops/${shopId}/settings`)}
                title={t('breadcrumb_settings') || 'Налаштування'}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => navigate(`/user/shops/${shopId}/structure`)}
                title={t('xml_structure') || 'Структура XML'}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => navigate(`/user/shops/${shopId}/export`)}
                title={t('export_section') || 'Експорт'}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        <div className="bg-background rounded-md">
          {productsCount === 0 ? (
            <div className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia className="text-primary">
                    <Package className="h-[1.5rem] w-[1.5rem]" />
                  </EmptyMedia>
                  <EmptyTitle>{t('no_products')}</EmptyTitle>
                  <EmptyDescription>{t('no_products_description')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <ProductsTable
              storeId={shopId}
              onEdit={(product: Product) => navigate(`/user/shops/${shopId}/products/edit/${product.id}`)}
              onDelete={handleDeleteProduct}
              canCreate={true}
              hideDuplicate={true}
            />
          )}
        </div>
      </div>

      <ShopStructureEditor
        shop={shop}
        open={modalAction === "structure"}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      />
      <ExportDialog
        storeId={shopId}
        open={modalAction === "export"}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      />
    </>
  );
};
