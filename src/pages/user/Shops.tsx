import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Gauge, Plus, ArrowLeft, Store, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { ShopsList, ShopForm } from '@/components/user/shops';
import { ShopService, type ShopLimitInfo } from '@/lib/shop-service';
import { ProductService } from '@/lib/product-service';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionValidator } from '@/lib/session-validation';
import { useOutletContext } from 'react-router-dom';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { PageLoadingModal } from '@/components/LoadingSkeletons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ViewMode = 'list' | 'create';

export const Shops = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [shopsCount, setShopsCount] = useState(0);
  const [limitInfo, setLimitInfo] = useState<ShopLimitInfo>({ current: 0, max: 0, canCreate: false });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { tariffLimits, user } = useOutletContext<{ tariffLimits: Array<{ limit_name: string; value: number }>; user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";

  const handleShopsLoaded = (count: number, info?: ShopLimitInfo | null) => {
    setShopsCount(count);
    setLimitInfo((prev) => ({
      ...prev,
      current: count,
      canCreate: count < prev.max,
    }));
  };

  useEffect(() => {
    const shopLimit = (tariffLimits || [])
      .find((l) => {
        const n = String(l.limit_name || '').toLowerCase();
        return n.includes('магазин') || n.includes('store');
      })?.value ?? 0;
    setLimitInfo((prev) => ({ ...prev, max: shopLimit, canCreate: prev.current < shopLimit }));
  }, [tariffLimits]);

  useEffect(() => {
    if (!uid || uid === "current") return;
    const channel = supabase
      .channel(`shop_limit_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${uid}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["user", uid, "shops"] });
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { void 0; } };
  }, [queryClient, uid]);

  // No forced refresh on mount; React Query in ShopsList handles initial fetch
  const handleCreateNew = () => {
    if (!limitInfo.canCreate) {
      toast.error(t('shops_limit_reached') + '. ' + t('upgrade_plan'));
      return;
    }
    setViewMode('create');
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleCreateSuccess = async (newShop?: any) => {
    if (newShop) {
      queryClient.setQueryData(["user", uid, "shops"], (old: any) => {
        const item = {
          ...newShop,
          productsCount: 0,
          categoriesCount: 0
        };
        if (!Array.isArray(old)) return [item];
        // Prevent duplicates
        if (old.some((s: any) => String(s.id) === String(item.id))) return old;
        return [item, ...old];
      });
    }
    
    setIsRefreshing(true);
    setViewMode('list');
    
    // Force refetch from DB
    try {
      ShopService.clearAllCaches();
      await ShopService.getShopsAggregated({ force: true });
      await queryClient.invalidateQueries({ 
        queryKey: ["user", uid, "shops"],
        refetchType: 'all'
      });
    } catch (e) {
      console.error("Failed to refetch shops:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsRefreshing(true);
    try {
      await ShopService.deleteShop(id);
      
      // Force refetch from DB to ensure cache is consistent
      try {
        ShopService.clearAllCaches();
        await ShopService.getShopsAggregated({ force: true });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["user", uid, "products"] }),
          queryClient.invalidateQueries({ queryKey: ["user", uid, "shops"], refetchType: 'all' })
        ]);
        ProductService.clearAllProductsCaches(); 
      } catch (e) {
        console.error("Failed to refresh cache after delete:", e);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    // 1. Clear service caches to ensure fresh data
    try { ShopService.clearAllCaches(); } catch { void 0; }
    
    // 2. Invalidate shops query to trigger refetch via React Query
    await queryClient.invalidateQueries({ queryKey: ["user", uid, "shops"] });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={
          viewMode === 'list' 
            ? t('shops_title') 
            : t('create_shop')
        }
        description={
          viewMode === 'list' 
            ? t('shops_description') 
            : t('create_shop_description')
        }
        breadcrumbItems={breadcrumbs}
        hideTitleOnMobile
        mobileActionsInline
        actions={
          <div className="flex gap-2 items-center">
            {viewMode === 'list' && (
              <>
                <TooltipProvider delayDuration={200}>
                  <Badge variant="outline" className="text-sm flex items-center gap-1.5 border-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center">
                          <Store className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t('shops_title')}</TooltipContent>
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
                {shopsCount > 0 && (
                  <Button 
                    onClick={handleCreateNew}
                    disabled={!limitInfo.canCreate}
                    variant="ghost"
                    size="icon"
                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    title={t('shop_add_tooltip')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <RefreshDataButton onRefresh={handleRefresh} />
              </>
            )}
            {viewMode !== 'list' && (
              <Button variant="ghost" onClick={handleBackToList} title={t('shop_back_tooltip')} className="group inline-flex items-center gap-2 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
                <span className="inline sm:hidden">{t('back_to_shops')}</span>
                <span className="inline-flex items-center justify-center rounded-full bg-muted-foreground/10 border border-border text-foreground w-8 h-8 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </Button>
            )}
          </div>
        }
      />

      {viewMode === 'list' && (
        <ShopsList
          userId={uid}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
          onShopsLoaded={handleShopsLoaded}
        />
      )}

      {viewMode === 'create' && (
        <ShopForm
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToList}
        />
      )}

      {isRefreshing && <PageLoadingModal title={t('refreshing_shops')} />}
    </div>
  );
};
