import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Store, Package, List, Loader2, Trash2, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { QueryClient } from "@tanstack/react-query";
import { ProductService, type Product } from "@/lib/product-service";
import { useOutletContext } from "react-router-dom";
import { PageLoadingModal } from "@/components/LoadingSkeletons";

type ProductRow = Product & { linkedStoreIds?: string[] };
type StoreAgg = { 
  id: string; 
  store_name?: string | null; 
  store_url?: string | null; 
  productsCount?: number; 
  categoriesCount?: number;
};

function countProductsInStore(products: ProductRow[], storeId: string): number {
  return products.reduce((count, product) => {
    const isLinked = (product.linkedStoreIds || []).includes(storeId);
    return count + (isLinked ? 1 : 0);
  }, 0);
}

function countCategoriesInStore(products: ProductRow[], storeId: string): number {
  const keys = new Set<string>();
  for (const p of products) {
    if (!Array.isArray(p.linkedStoreIds) || !p.linkedStoreIds.includes(storeId)) continue;
    const key = p.category_id != null
      ? `cat:${String(p.category_id)}`
      : p.category_external_id
        ? `ext:${String(p.category_external_id)}`
        : null;
    if (key) keys.add(key);
  }
  return keys.size;
}

function hasLinkedProducts(products: ProductRow[], storeIds: string[]): boolean {
  if (storeIds.length === 0 || products.length === 0) return false;
  
  const storeSet = new Set(storeIds);
  return products.some(product => 
    (product.linkedStoreIds || []).some(sid => storeSet.has(sid))
  );
}

function normalizeCount(v: unknown): number {
  return Math.max(0, Number(v ?? 0) || 0);
}

export function AddToStoresMenu({
  open,
  setOpen,
  loadStoresForMenu,
  stores,
  setStores,
  selectedStoreIds,
  setSelectedStoreIds,
  items,
  table,
  removingStores,
  setRemovingStores,
  removingStoreId,
  setRemovingStoreId,
  queryClient,
  addingStores,
  setAddingStores,
  setProductsCached,
  setLastSelectedProductIds,
  disabled,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  loadStoresForMenu: () => Promise<void>;
  stores: StoreAgg[];
  setStores: (v: StoreAgg[]) => void;
  selectedStoreIds: string[];
  setSelectedStoreIds: Dispatch<SetStateAction<string[]>>;
  items: ProductRow[];
  table: import("@tanstack/react-table").Table<ProductRow>;
  removingStores: boolean;
  setRemovingStores: (v: boolean) => void;
  removingStoreId: string | null;
  setRemovingStoreId: (v: string | null) => void;
  queryClient: QueryClient;
  addingStores: boolean;
  setAddingStores: (v: boolean) => void;
  setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void;
  setLastSelectedProductIds?: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";

  const selectedProducts = table.getSelectedRowModel().rows
    .map(r => r.original)
    .filter(Boolean) as ProductRow[];

  const hasSelectedProducts = selectedProducts.length > 0;
  const hasAnyLinkedStores = items.some(p => (p.linkedStoreIds || []).length > 0);

  const handleOpenChange = useCallback(async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      try {
        await loadStoresForMenu();
        try {
          const nextStores = queryClient.getQueryData<StoreAgg[]>(["user", uid, "shops"]);
          if (Array.isArray(nextStores)) setStores(nextStores);
        } catch {
          void 0;
        }
        const selected = table.getSelectedRowModel().rows.map((r) => r.original) as ProductRow[];
        if (selected.length === 1) {
          const ids = Array.from(new Set((selected[0].linkedStoreIds || []).map(String)));
          setSelectedStoreIds(ids);
        }
      } catch (error) {
        toast.error(t("failed_load_shops"));
      }
    }
  }, [setOpen, loadStoresForMenu, queryClient, uid, setStores, table, setSelectedStoreIds, t]);

  const handleAddToStores = async () => {
    if (!hasSelectedProducts || selectedStoreIds.length === 0) return;

    const productIds = selectedProducts.map(p => String(p.id));
    setOpen(false);
    setAddingStores(true);

    try {
      const links = selectedProducts.flatMap(product => {
        const existingStores = new Set(product.linkedStoreIds || []);
        return selectedStoreIds
          .filter(sid => !existingStores.has(sid))
          .map(sid => ({
            product_id: String(product.id),
            store_id: sid,
            is_active: true,
            custom_price: product.price ?? null,
            custom_price_old: product.price_old ?? null,
            custom_price_promo: product.price_promo ?? null,
            custom_stock_quantity: product.stock_quantity ?? null,
            custom_available: product.available ?? true,
          }));
      });

      const { inserted } = await ProductService.bulkAddStoreProductLinks(links);

      if (inserted === 0) {
        toast.success(t('products_already_linked'));
        return;
      }

      toast.success(t('product_added_to_stores'));

      setProductsCached(prev => prev.map(p => {
        if (!productIds.includes(String(p.id))) return p;
        const mergedStores = [...new Set([...(p.linkedStoreIds || []), ...selectedStoreIds])];
        return { ...p, linkedStoreIds: mergedStores };
      }));

    } catch (error) {
      console.error('Failed to add products to stores:', error);
      toast.error(t('failed_add_product_to_stores'));
    } finally {
      setAddingStores(false);
      table.resetRowSelection();
      setLastSelectedProductIds?.(productIds);
    }
  };

  const handleRemoveFromStores = async (storeIds: string[], productIds: string[]) => {
    if (storeIds.length === 0) return;

    setRemovingStores(true);

    try {
      await ProductService.bulkRemoveStoreProductLinks(productIds, storeIds);

      toast.success(t('product_removed_from_store'));

      setProductsCached(prev => prev.map(p => {
        const shouldUpdate = productIds.length === 0 || productIds.includes(String(p.id));
        if (!shouldUpdate) return p;

        const filteredStores = (p.linkedStoreIds || []).filter(sid => !storeIds.includes(sid));
        return { ...p, linkedStoreIds: filteredStores };
      }));

    } catch (error) {
      console.error('Failed to remove products from stores:', error);
      toast.error(t('failed_remove_from_store'));
    } finally {
      setRemovingStores(false);
      table.resetRowSelection();
      setSelectedStoreIds(prev => prev.filter(sid => !storeIds.includes(sid)));
    }
  };

  const handleRemoveSingleStore = async (storeId: string) => {
    const productsInStore = selectedProducts.filter(p =>
      (p.linkedStoreIds || []).includes(storeId)
    );

    if (productsInStore.length === 0) return;

    const productIds = productsInStore.map(p => String(p.id));
    setRemovingStoreId(storeId);

    try {
      const { deletedByStore } = await ProductService.bulkRemoveStoreProductLinks(productIds, [storeId]);

      toast.success(t('product_removed_from_store'));

      setProductsCached(prev => prev.map(p => {
        if (!productIds.includes(String(p.id))) return p;
        const filtered = (p.linkedStoreIds || []).filter(sid => sid !== storeId);
        return { ...p, linkedStoreIds: filtered };
      }));

      const delta = Math.max(0, Number(deletedByStore?.[storeId] ?? productsInStore.length) || 0);

      const remainingCount = countProductsInStore(items, storeId) - delta;
      if (remainingCount === 0) {
        setSelectedStoreIds(prev => prev.filter(id => id !== storeId));
      }

    } catch (error) {
      console.error('Failed to remove from store:', error);
      toast.error(t('failed_remove_from_store'));
    } finally {
      setRemovingStoreId(null);
      table.resetRowSelection();
    }
  };

  const effectiveStoreIds = selectedStoreIds.length > 0
    ? selectedStoreIds
    : [...new Set(selectedProducts.flatMap(p => p.linkedStoreIds || []))];

  const totalInSelectedStores = selectedStoreIds.reduce((sum, sid) => {
    const s = (stores || []).find((x) => String(x.id) === String(sid));
    return sum + normalizeCount(s?.productsCount);
  }, 0);

  const removingAnyStores = removingStores || !!removingStoreId;
  const showProgressModal = addingStores || removingAnyStores;
  const progressTitle = addingStores ? t("products_add_to_stores_title") : t("products_remove_from_stores_title");
  const progressDescription = addingStores ? t("products_add_to_stores_description") : t("products_remove_from_stores_description");
  const progressIcon = addingStores ? Store : Trash2;

  const canDelete = !removingStores
    && effectiveStoreIds.length > 0
    && (hasSelectedProducts || selectedStoreIds.length > 0)
    && (selectedStoreIds.length > 0 ? totalInSelectedStores > 0 : true);
  const isTriggerDisabled = !!disabled || (!hasSelectedProducts && !hasAnyLinkedStores);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <TooltipProvider>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isTriggerDisabled}
                  aria-label={t("add_to_stores")}
                  data-testid="user_products_dataTable_addToStores"
                >
                  <Store className={`h-4 w-4 ${isTriggerDisabled ? "text-muted-foreground" : ""}`} />
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent side="bottom">
              {t("add_to_stores")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent align="end" className="p-2">
          <div className="text-sm mb-2">{t("select_stores")}</div>
          
          <ScrollArea className="max-h-[clamp(12rem,40vh,20rem)]">
            <div className="flex flex-col gap-1">
              {stores.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-1">
                  {t("no_active_stores")}
                </div>
              ) : (
                stores.map(store => {
                  const storeId = String(store.id);
                  const isChecked = selectedStoreIds.includes(storeId);
                  const productCount = normalizeCount(store.productsCount);
                  const categoryCount = productCount === 0 ? 0 : normalizeCount(store.categoriesCount);
                  const selectedLinkedCount = selectedProducts.filter((p) => (p.linkedStoreIds || []).includes(storeId)).length;
                  const isRemoving = removingStores || removingStoreId === storeId;

                  return (
                    <DropdownMenuItem
                      key={storeId}
                      className="cursor-pointer px-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        setSelectedStoreIds(prev =>
                          isChecked
                            ? prev.filter(id => id !== storeId)
                            : [...prev, storeId]
                        );
                      }}
                      data-testid={`user_products_addToStores_item_${storeId}`}
                    >
                      <div className="relative mr-2 inline-flex items-center">
                        <Checkbox
                          checked={isChecked}
                          disabled={isRemoving}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => {
                            setSelectedStoreIds(prev =>
                              checked
                                ? [...prev, storeId]
                                : prev.filter(id => id !== storeId)
                            );
                          }}
                          className="mr-2"
                          aria-label={t("select_store")}
                        />
                        {isRemoving && (
                          <Loader2 className="absolute h-3 w-3 animate-spin text-emerald-600" />
                        )}
                      </div>

                      <span className="truncate">
                        {store.store_name || store.store_url || "—"}
                      </span>

                      <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span className="tabular-nums">{productCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <List className="h-3 w-3" />
                          <span className="tabular-nums">
                            {categoryCount}
                          </span>
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={isRemoving || !isChecked || selectedLinkedCount === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSingleStore(storeId);
                          }}
                        >
                          {removingStoreId === storeId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <DropdownMenuSeparator />

          <div className="flex items-center justify-center gap-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={addingStores || selectedStoreIds.length === 0 || !hasSelectedProducts}
              onClick={handleAddToStores}
              data-testid="user_products_addToStores_confirm"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${hasSelectedProducts ? 'border border-green-500' : ''}`}
                    disabled={!canDelete}
                    onClick={() => {
                      const productIds = selectedProducts.map(p => String(p.id));
                      handleRemoveFromStores(effectiveStoreIds, productIds);
                    }}
                    data-testid="user_products_addToStores_delete"
                  >
                    {removingStores ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {hasSelectedProducts
                    ? 'Видалити виділені товари з вибраних магазинів'
                    : 'Видалити всі товари з вибраних магазинів'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {showProgressModal ? (
        <PageLoadingModal title={progressTitle} subtitle={progressDescription} icon={progressIcon} />
      ) : null}
    </>
  );
}
