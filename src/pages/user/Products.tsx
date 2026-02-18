import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gauge, Loader2, Package, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { ProductsTable } from '@/components/user/products';
import { ProductService, type Product, type ProductLimitInfo } from '@/lib/product-service';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DialogNoOverlay, DialogNoOverlayContent, DialogNoOverlayHeader, DialogNoOverlayTitle } from '@/components/ui/dialog-no-overlay';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const Products = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const [productsCount, setProductsCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [limitInfo, setLimitInfo] = useState<ProductLimitInfo>({ current: 0, max: 0, canCreate: false });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const { tariffLimits, user } = useOutletContext<{ tariffLimits: Array<{ limit_name: string; value: number }>; user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const pageSize = 50; // Default page size

  const queryClient = useQueryClient();
  useEffect(() => {
    const productLimit = (tariffLimits || []).find((l) => String(l.limit_name || '').toLowerCase().includes('товар'))?.value ?? 0;
    setLimitInfo((prev) => ({ ...prev, max: productLimit, canCreate: prev.current < productLimit }));
  }, [tariffLimits]);

  const handleProductsLoaded = useCallback((count: number) => {
    setProductsCount(count);
    setLimitInfo(prev => ({
      ...prev,
      current: count,
      canCreate: count < prev.max
    }));
  }, []);

  const handleRefresh = async () => {
    // 1. Clear local cache to ensure we don't serve stale data from memory
    ProductService.clearAllCaches();

    // 2. Force fetch first page to update cache
    try {
      await ProductService.getProductsPage(null, pageSize, 0, { force: true });
    } catch {
      void 0;
    }

    // 3. Invalidate React Query cache to trigger UI update (this will cause the table to refetch visible rows)
    await queryClient.invalidateQueries({ queryKey: ["user", uid], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard"], exact: false });
    
    setRefreshTrigger((prev) => prev + 1);
  };


  const handleEdit = (product: Product) => {
    navigate(`/user/products/edit/${product.id}`);
  };

  const handleCreateNew = () => {
    if (!limitInfo.canCreate) {
      toast.error(t('products_limit_reached') + '. ' + t('upgrade_plan'));
      return;
    }
    navigate('/user/products/new-product');
  };


  const handleDelete = async (product: Product) => {
    try {
      const nameForUi = product.name_ua || product.name || product.external_id || product.id;
      setDeletingName(nameForUi);
      setIsDeleteOpen(true);

      await ProductService.deleteProduct(product.id);

      toast.success(t('product_deleted'));
      await queryClient.invalidateQueries({ queryKey: ["user", uid, "dashboard"], exact: false });
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const msg = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message?: string }).message : t('failed_delete_product');
      toast.error(msg);
      throw error;
    } finally {
      setIsDeleteOpen(false);
      setDeletingName(null);
    }
  };

  return (
    <div className="p-6 h-full min-h-0 flex flex-col gap-2 sm:gap-6 md:gap-6">
      <PageHeader
        title={t('products_title')}
        description={t('products_description')}
        breadcrumbItems={breadcrumbs}
        className="space-y-1 sm:space-y-2"
        hideTitleOnMobile
        actions={
          <div className="flex gap-1 sm:gap-2 items-center w-full justify-end sm:w-auto flex-nowrap">
            <TooltipProvider delayDuration={200}>
              <Badge variant="outline" className="text-sm flex items-center gap-1.5 border-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">
                      <Package className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('products_title')}</TooltipContent>
                </Tooltip>
                <span>{limitInfo.current}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">
                      <Gauge className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('limit_tooltip')}</TooltipContent>
                </Tooltip>
                <span>{limitInfo.max}</span>
              </Badge>
            </TooltipProvider>
            
            <RefreshDataButton onRefresh={handleRefresh} />
          </div>
        }
      />

      <div className="relative flex-1 min-h-0">
        <ProductsTable
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
          onProductsLoaded={handleProductsLoaded}
          refreshTrigger={refreshTrigger}
          canCreate={limitInfo.canCreate}
        />
      </div>

      {/* Non-modal delete progress indicator */}
      <DialogNoOverlay modal={false} open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogNoOverlayContent
          position="top-right"
          variant="info"
          className="p-[0.75rem] w-[min(22rem,90vw)] border border-success/60 dark:border-success/70"
          data-testid="user_products_delete_progress"
        >
          <DialogNoOverlayHeader>
            <DialogNoOverlayTitle className="flex items-center gap-2 text-destructive">
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              {t('deleting_product_title')}
            </DialogNoOverlayTitle>
          </DialogNoOverlayHeader>
          <div className="text-sm text-muted-foreground">
            <span>{t('deleting_product')}{deletingName ? `: ${deletingName}` : ''}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted dark:bg-neutral-900/60 dark:border dark:border-emerald-500/40">
            <div className="h-full w-2/3 bg-destructive/80 animate-pulse" />
          </div>
        </DialogNoOverlayContent>
      </DialogNoOverlay>
    </div>
  );
};
