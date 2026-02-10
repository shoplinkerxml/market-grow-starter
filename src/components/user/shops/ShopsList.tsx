import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { Store, Trash2, Package, List, Copy, Loader2 } from 'lucide-react';
import { useI18n } from "@/i18n";
import { ShopService, type ShopAggregated, type ShopLimitInfo } from '@/lib/shop-service';
import { ShopCountsService } from '@/lib/shop-counts';
import { supabase } from '@/integrations/supabase/client';
import { SessionValidator } from '@/lib/session-validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { useShops } from "@/hooks/useShops";

type ShopWithMarketplace = ShopAggregated;

interface ShopsListProps {
  userId?: string | null;
  onDelete?: (id: string) => void;
  onCreateNew?: () => void;
  onShopsLoaded?: (count: number, limitInfo?: ShopLimitInfo | null) => void;
}

export const ShopsList = ({ 
  userId,
  onDelete, 
  onCreateNew, 
  onShopsLoaded,
}: ShopsListProps) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = userId ?? (user?.id ? String(user.id) : "current");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; shop: ShopWithMarketplace | null }>({
    open: false,
    shop: null
  });
  const currentUserId = user?.id ? String(user.id) : null;
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // ============================================================================
  // React Query - єдине джерело правди
  // ============================================================================
  const { data: shopsData, isLoading, isFetching } = useShops(uid, { forceCounts: true });

  const shops: ShopWithMarketplace[] = useMemo(
    () => shopsData ?? [],
    [shopsData]
  );
  const shopsLength = shops.length;

  // ============================================================================
  // Lifecycle hooks
  // ============================================================================
  const onShopsLoadedRef = useRef(onShopsLoaded);
  useEffect(() => { 
    onShopsLoadedRef.current = onShopsLoaded; 
  }, [onShopsLoaded]);

  useEffect(() => { 
    onShopsLoadedRef.current?.(shopsLength, null); 
  }, [shopsLength]);
  
  // ============================================================================
  // Realtime синхронізація (оптимістичні оновлення)
  // ============================================================================
  useEffect(() => {
    // Оптимістичне оновлення лічильників товарів
    const updateProductsCount = (storeId: string, delta: number) => {
      const sid = String(storeId || "").trim();
      if (!sid) return;
      if (ShopCountsService.consumeRealtimeProductsDelta(uid, sid, delta)) return;
      ShopCountsService.invalidate(queryClient, uid, sid, `realtime_products_delta:${delta}`);
    };

    const upsertShopFromRow = (row: any) => {
      if (!row) return;
      const sid = String(row.id || "").trim();
      if (!sid) return;
      queryClient.setQueryData<ShopWithMarketplace[]>(["user", uid, "shops"], (prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((s) => String(s.id) === sid);
        const existing = idx >= 0 ? list[idx] : null;

        const merged: ShopWithMarketplace = {
          ...(existing || {}),
          id: sid,
          user_id: String(row.user_id ?? existing?.user_id ?? ''),
          store_name: String(row.store_name ?? existing?.store_name ?? ''),
          store_company: row.store_company ?? existing?.store_company ?? null,
          store_url: row.store_url ?? existing?.store_url ?? null,
          template_id: row.template_id ?? existing?.template_id ?? null,
          xml_config: row.xml_config ?? existing?.xml_config ?? null,
          custom_mapping: row.custom_mapping ?? existing?.custom_mapping ?? null,
          marketplace: String(row.marketplace ?? existing?.marketplace ?? 'Не вказано'),
          is_active: row.is_active !== false,
          created_at: String(row.created_at ?? existing?.created_at ?? ''),
          updated_at: String(row.updated_at ?? existing?.updated_at ?? ''),
        };

        if (idx >= 0) {
          list[idx] = merged;
          return list;
        }
        return [merged, ...list];
      });
      ShopCountsService.invalidate(queryClient, uid, sid, "realtime_user_stores_upsert");
    };

    const removeShopFromCache = (row: any) => {
      const sid = String(row?.id || '').trim();
      if (!sid) return;
      queryClient.setQueryData<ShopWithMarketplace[]>(["user", uid, "shops"], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((s) => String(s.id) !== sid);
      });
      ShopCountsService.invalidate(queryClient, uid, sid, "realtime_user_stores_delete");
    };

    const channel = (supabase as SupabaseClient)
      .channel('shops_realtime')
      
      // Зміни в таблиці user_stores → оновлення кеша без refetch
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'user_stores' 
      }, (payload: any) => {
        upsertShopFromRow(payload?.new);
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'user_stores' 
      }, (payload: any) => {
        upsertShopFromRow(payload?.new);
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'user_stores' 
      }, (payload: any) => {
        removeShopFromCache(payload?.old);
      })
      
      // INSERT товару → +1 до лічильника
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'store_product_links' 
      }, (payload: any) => {
        const row = payload?.new || {};
        const active = row?.is_active !== false;
        const sid = row?.store_id ? String(row.store_id) : '';
        if (sid && active) {
          updateProductsCount(sid, +1);
        }
      })
      
      // DELETE товару → -1 від лічильника
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'store_product_links' 
      }, (payload: any) => {
        const row = payload?.old || {};
        const active = row?.is_active !== false;
        const sid = row?.store_id ? String(row.store_id) : '';
        if (sid && active) {
          updateProductsCount(sid, -1);
        }
      })
      
      // UPDATE товару → обробка переміщення між магазинами або зміни is_active
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'store_product_links' 
      }, (payload: any) => {
        const oldRow = payload?.old || {};
        const newRow = payload?.new || {};
        const sidOld = oldRow?.store_id ? String(oldRow.store_id) : '';
        const sidNew = newRow?.store_id ? String(newRow.store_id) : '';
        const wasActive = oldRow?.is_active !== false;
        const isActive = newRow?.is_active !== false;
        
        // Переміщення між магазинами
        if (sidOld && sidNew && sidOld !== sidNew) {
          if (wasActive) updateProductsCount(sidOld, -1);
          if (isActive) updateProductsCount(sidNew, +1);
        } 
        // Зміна статусу активності
        else if (sidNew) {
          if (wasActive && !isActive) updateProductsCount(sidNew, -1);
          if (!wasActive && isActive) updateProductsCount(sidNew, +1);
        }
      })
      
      .subscribe();

    return () => { 
      try { 
        (supabase as SupabaseClient).removeChannel(channel); 
      } catch { 
        void 0; 
      } 
    };
  }, [queryClient, uid]);

  // ============================================================================
  // Handlers
  // ============================================================================
  const handleDeleteConfirm = async () => {
    if (!deleteDialog.shop) return;
    const id = String(deleteDialog.shop.id);
    const previousShops = queryClient.getQueryData<ShopWithMarketplace[]>(["user", uid, "shops"]);

    // 1. Optimistic Update
    setDeleteDialog({ open: false, shop: null });
    queryClient.setQueryData<ShopWithMarketplace[]>(["user", uid, "shops"], (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.filter((s) => String(s.id) !== id);
    });
    toast.success(t('shop_deleted'));

    // 2. Background Request
    try {
      await onDelete?.(id);
    } catch (error: unknown) {
      // 3. Rollback on error
      queryClient.setQueryData(["user", uid, "shops"], previousShops);
      const message = typeof (error as { message?: string }).message === 'string' 
        ? (error as { message?: string }).message 
        : '';
      toast.error(message || t('failed_delete_shop'));
    }
  };

  const handleDuplicateShop = async (shop: ShopWithMarketplace) => {
    const shopId = String(shop?.id || "").trim();
    if (!shopId) return;
    if (duplicatingId) return;
    setDuplicatingId(shopId);
    try {
      const original = await ShopService.getShop(shopId);
      const created = await ShopService.createShop({
        store_name: `${original.store_name} (copy)`,
        store_company: original.store_company ?? null,
        store_url: original.store_url ?? null,
        template_id: original.template_id ?? null,
        xml_config: original.xml_config ?? null,
        custom_mapping: original.custom_mapping ?? null,
        marketplace: original.marketplace ?? null,
      });
      queryClient.setQueryData<ShopWithMarketplace[]>(["user", uid, "shops"], (prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const exists = list.some((s) => String(s.id) === String(created.id));
        if (exists) return list;
        return [{ ...created, productsCount: 0, categoriesCount: 0 }, ...list];
      });
      toast.success(t('shop_created'));
      ShopCountsService.invalidate(queryClient, uid, created.id, "duplicate_shop");
    } catch (error: unknown) {
      const message = typeof (error as { message?: string }).message === 'string'
        ? (error as { message?: string }).message
        : '';
      toast.error(message || t('failed_save_shop'));
    } finally {
      setDuplicatingId(null);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================
  const showSkeletons = (isLoading || isFetching) && shops.length === 0;

  return (
    <>
      {showSkeletons && (
        <FullPageLoader
          title={t('shops_title')}
          subtitle={t('shops_description')}
          icon={Store}
        />
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {!showSkeletons && shops.length === 0 && (
          <div className="flex justify-center col-span-full">
            <Empty className="border max-w-md">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Store />
                </EmptyMedia>
                <EmptyTitle>{t('no_shops')}</EmptyTitle>
                <EmptyDescription>
                  {t('no_shops_description')}
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={onCreateNew} className="mt-4">
                <Store className="h-4 w-4 mr-2" />
                {t('add_shop')}
              </Button>
            </Empty>
          </div>
        )}
        
        {shops.map((shop) => (
          <Card 
            key={shop.id} 
            className="card-elevated card-elevated-hover cursor-pointer"
            onClick={() => navigate(`/user/shops/${shop.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <Store className="h-8 w-8 text-emerald-600" />
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {currentUserId && String(shop.user_id) === String(currentUserId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-full border border-border text-muted-foreground hover:border-emerald-500 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                      onClick={() => handleDuplicateShop(shop)}
                      disabled={duplicatingId === String(shop.id)}
                    >
                      {duplicatingId === String(shop.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {currentUserId && String(shop.user_id) === String(currentUserId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-full border border-border text-destructive hover:border-emerald-500 hover:text-destructive focus-visible:ring-0 focus-visible:ring-offset-0"
                      onClick={() => setDeleteDialog({ open: true, shop })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardTitle className="mt-2">{shop.store_name}</CardTitle>
              <CardDescription>
                Формат: {shop.marketplace}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={shop.is_active ? "text-green-600" : "text-gray-400"}>
                  {shop.is_active ? 'Активний' : 'Неактивний'}
                </span>
              </div>
              
              <div 
                className="flex items-center gap-4 text-sm" 
                data-testid={`user_shop_item_stats_${shop.id}`}
              >
                <div 
                  className="flex items-center gap-1" 
                  data-testid={`user_shop_item_products_${shop.id}`}
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('shop_products')}:</span>
                  <span className="font-medium">{shop.productsCount ?? 0}</span>
                </div>
                
                <div 
                  className="flex items-center gap-1" 
                  data-testid={`user_shop_item_categories_${shop.id}`}
                >
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('shop_categories')}:</span>
                  <span className="font-medium">
                    {(shop.productsCount ?? 0) === 0 ? 0 : (shop.categoriesCount ?? 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog({ open, shop: null })}
      >
        <AlertDialogContent noOverlay>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              {t('delete_shop_confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Магазин "{deleteDialog.shop?.store_name}" буде повністю видалено з системи.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
