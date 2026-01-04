import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { ShopService, type ShopAggregated } from "@/lib/shop-service";
import { ShopCountsService } from "@/lib/shop-counts";
import { ProductService, type Product } from "@/lib/product-service";
import { useOutletContext } from "react-router-dom";

type ProductRow = Product & { linkedStoreIds?: string[] };

type Props = {
  product: ProductRow;
  storeNames: Record<string, string>;
  storesList?: ShopAggregated[];
  prefetchStores?: () => Promise<void>;
  onRemove?: (productId: string, storeId: string) => void;
  onStoresUpdate?: (productId: string, ids: string[], opts?: { storeIdChanged?: string; added?: boolean; categoryKey?: string | null }) => void;
};

export function StoresBadgeCell({ product, storeNames, storesList, prefetchStores, onRemove, onStoresUpdate }: Props) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const storeIds = product.linkedStoreIds || [];
  const [open, setOpen] = useState(false);
  const [stores, setStores] = useState<ShopAggregated[]>([]);
  const [linkedStoreIds, setLinkedStoreIds] = useState<string[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [togglingStoreIds, setTogglingStoreIds] = useState<string[]>([]);
  const [badgeOpenId, setBadgeOpenId] = useState<string | null>(null);
  const truncate = (s: string) => (s.length > 12 ? `${s.slice(0, 12)}...` : s);

  const loadStoresAndLinks = useCallback(async () => {
      let shops: ShopAggregated[] = [];
      try {
        try { await prefetchStores?.(); } catch { void 0; }
      const cachedAgg = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]) || [];
      if (cachedAgg.length > 0) {
        shops = cachedAgg;
      } else {
        setLoadingStores(true);
        const data = await ShopService.getShopsAggregated();
        shops = data || [];
        try { queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], shops); } catch { void 0; }
      }
    } catch {
      shops = Array.isArray(storesList) && storesList.length > 0 ? storesList : Object.entries(storeNames).map(([id, name]) => ({ id: String(id), store_name: name })) as ShopAggregated[];
    } finally {
      const fallback = Array.isArray(storesList) && storesList.length > 0
        ? storesList
        : Object.entries(storeNames).map(([id, name]) => ({ id: String(id), store_name: name })) as ShopAggregated[];
      setStores(shops.length > 0 ? shops : fallback);
      setLoadingStores(false);
    }
    const initialLinked = Array.isArray(product.linkedStoreIds) ? product.linkedStoreIds.map(String) : [];
    setLinkedStoreIds(initialLinked);
    if (!Array.isArray(product.linkedStoreIds)) {
      try {
        const ids = await ProductService.getStoreLinksForProduct(product.id);
        setLinkedStoreIds(ids);
      } catch {
        setLinkedStoreIds([]);
      }
    }
  }, [queryClient, product.id, storesList, storeNames, product.linkedStoreIds, prefetchStores, uid]);

  useEffect(() => { if (open) loadStoresAndLinks(); }, [open, loadStoresAndLinks]);
  useEffect(() => { if (Array.isArray(storesList) && storesList.length > 0) setStores(storesList); }, [storesList]);
  useEffect(() => { setLinkedStoreIds(product.linkedStoreIds || []); }, [product.linkedStoreIds]);

  if (storeIds.length === 0) {
    return (
      <div className="w-full flex items-center justify-center">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-6 w-6 p-0 mx-auto border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            aria-label={t("menu_stores")}
            data-testid={`user_products_store_add_trigger_${product.id}`}
          >
            <Store className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-1" onPointerLeave={() => setOpen(false)} data-testid={`user_products_store_add_content_${product.id}`}>
          {((stores || []).length === 0 && loadingStores) ? (
            <DropdownMenuItem disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loading")}
            </DropdownMenuItem>
          ) : (
            (stores || []).length === 0 ? (
              <DropdownMenuItem disabled>—</DropdownMenuItem>
            ) : (
              (stores || []).map((s: ShopAggregated) => {
                const id = String(s.id);
                const initialLinked = Array.isArray(product.linkedStoreIds) ? (product.linkedStoreIds as string[]).map(String) : [];
                const checked = initialLinked.includes(id) || linkedStoreIds.includes(id);
                return (
                  <DropdownMenuItem
                    key={id}
                    className="cursor-pointer pr-2 pl-2 hover:bg-muted/60 focus:bg-muted/60"
                    onSelect={(e) => e.preventDefault()}
                    data-testid={`user_products_store_add_item_${product.id}_${id}`}
                  >
                    <div className="relative mr-2 inline-flex items-center justify-center" aria-busy={togglingStoreIds.includes(id)}>
                      <Checkbox
                        checked={checked}
                        disabled={togglingStoreIds.includes(id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={async (v) => {
                          setTogglingStoreIds((prev) => Array.from(new Set([...prev, id])));
                          const prevIds = linkedStoreIds.slice();
                          const nextIds = v ? Array.from(new Set([...linkedStoreIds, id])) : linkedStoreIds.filter((x) => String(x) !== String(id));
                          setLinkedStoreIds(nextIds);
                          const categoryKey = product.category_id != null ? `cat:${product.category_id}` : product.category_external_id ? `ext:${product.category_external_id}` : null;
                          try { onStoresUpdate?.(String(product.id), nextIds, { storeIdChanged: id, added: !!v, categoryKey }); } catch { void 0; }
                              try {
                            if (v) {
                              const { addedByStore, categoryNamesByStore } = await ProductService.bulkAddStoreProductLinks([
                                {
                                  product_id: String(product.id),
                                  store_id: String(id),
                                  is_active: true,
                                  custom_price: product.price ?? null,
                                  custom_price_old: product.price_old ?? null,
                                  custom_price_promo: product.price_promo ?? null,
                                  custom_stock_quantity: product.stock_quantity ?? null,
                                  custom_available: product.available ?? true,
                                },
                              ]);
                              ProductService.invalidateStoreLinksCache(String(product.id));
                              toast.success(t("product_added_to_store"));
                              {
                                const idStr = String(id);
                                const added = Math.max(0, Number(addedByStore?.[idStr] ?? 1) || 0);
                                if (added > 0) ShopCountsService.bumpProducts(queryClient, uid, idStr, added);
                                const cats = categoryNamesByStore?.[idStr];
                                if (Array.isArray(cats)) {
                                  const cnt = cats.length;
                                  queryClient.setQueryData(ShopCountsService.key(uid, idStr), (old: any) => {
                                    const prevProducts = Number(old?.productsCount ?? 0) || 0;
                                    return { productsCount: prevProducts, categoriesCount: cnt };
                                  });
                                  queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], (prev) => {
                                    if (!Array.isArray(prev)) return prev;
                                    return prev.map((s) => (String(s.id) === idStr ? { ...s, categoriesCount: cnt } : s));
                                  });
                                }
                              }
                              try { /* keep menu open */ setOpen(true); } catch { void 0; }
                            } else {
                              const { deletedByStore, categoryNamesByStore } = await ProductService.bulkRemoveStoreProductLinks([String(product.id)], [String(id)]);
                              ProductService.invalidateStoreLinksCache(String(product.id));
                              toast.success(t("product_removed_from_store"));
                              {
                                const idStr = String(id);
                                const deleted = Math.max(0, Number(deletedByStore?.[idStr] ?? 1) || 0);
                                if (deleted > 0) ShopCountsService.bumpProducts(queryClient, uid, idStr, -deleted);
                                const cats = categoryNamesByStore?.[idStr];
                                if (Array.isArray(cats)) {
                                  const cnt = cats.length;
                                  queryClient.setQueryData(ShopCountsService.key(uid, idStr), (old: any) => {
                                    const prevProducts = Number(old?.productsCount ?? 0) || 0;
                                    return { productsCount: prevProducts, categoriesCount: cnt };
                                  });
                                  queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], (prev) => {
                                    if (!Array.isArray(prev)) return prev;
                                    return prev.map((s) => (String(s.id) === idStr ? { ...s, categoriesCount: cnt } : s));
                                  });
                                }
                              }
                              try { setOpen(true); } catch { void 0; }
                            }
                          } catch {
                            setLinkedStoreIds(prevIds);
                            toast.error(t("operation_failed"));
                          } finally {
                            setTogglingStoreIds((prev) => prev.filter((sid) => sid !== id));
                          }
                        }}
                        aria-label={t("select_store")}
                      />
                      {togglingStoreIds.includes(id) ? (
                        <Loader2 className="absolute h-3 w-3 animate-spin text-emerald-600 pointer-events-none" />
                      ) : null}
                    </div>
                    <span className="truncate">{s.store_name || s.store_url || id}</span>
                  </DropdownMenuItem>
                );
              })
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-1">
      {storeIds.map((id) => {
        const name = storeNames[String(id)] || "";
        const label = name ? truncate(name) : "…";
        const isOpen = badgeOpenId === String(id);
        return (
          <div key={id} className="inline-flex items-center">
            <Badge
              variant="secondary"
              className="text-[11px] pr-0 border border-emerald-200 bg-emerald-50 text-emerald-700 transition-transform shadow-sm hover:shadow-md hover:-translate-y-[1px] hover:border-emerald-300"
            >
              <DropdownMenu
                open={isOpen}
                onOpenChange={(v) => {
                  const next = v ? String(id) : (badgeOpenId === String(id) ? null : badgeOpenId);
                  setBadgeOpenId(next);
                  if (v) loadStoresAndLinks();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="pl-1 pr-1 select-none"
                    title={name}
                    data-testid={`user_products_store_badge_trigger_${product.id}_${id}`}
                  >
                    {label}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="p-1" onPointerLeave={() => setBadgeOpenId(null)} data-testid={`user_products_store_badge_content_${product.id}_${id}`}>
                  {((stores || []).length === 0 && loadingStores) ? (
                    <DropdownMenuItem disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("loading")}
                    </DropdownMenuItem>
                  ) : (
                    (stores || []).length === 0 ? (
                      <DropdownMenuItem disabled>—</DropdownMenuItem>
                    ) : (
                      (stores || []).map((s: ShopAggregated) => {
                        const sid = String(s.id);
                        const initialLinked = Array.isArray(product.linkedStoreIds) ? (product.linkedStoreIds as string[]).map(String) : [];
                        const checked = initialLinked.includes(sid) || linkedStoreIds.includes(sid);
                        return (
                          <DropdownMenuItem
                            key={sid}
                            className="cursor-pointer pr-2 pl-2 hover:bg-muted/60 focus:bg-muted/60"
                            onSelect={(e) => e.preventDefault()}
                            data-testid={`user_products_store_badges_item_${product.id}_${sid}`}
                          >
                            <div className="relative mr-2 inline-flex items-center justify-center" aria-busy={togglingStoreIds.includes(sid)}>
                              <Checkbox
                                checked={checked}
                                disabled={togglingStoreIds.includes(sid)}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={async (v) => {
                                  setTogglingStoreIds((prev) => Array.from(new Set([...prev, sid])));
                                  const prevIds = linkedStoreIds.slice();
                                  const nextIds = v ? Array.from(new Set([...linkedStoreIds, sid])) : linkedStoreIds.filter((x) => String(x) !== String(sid));
                                  setLinkedStoreIds(nextIds);
                                  const categoryKey = product.category_id != null ? `cat:${product.category_id}` : product.category_external_id ? `ext:${product.category_external_id}` : null;
                                  try { onStoresUpdate?.(String(product.id), nextIds, { storeIdChanged: sid, added: !!v, categoryKey }); } catch { void 0; }
                                  try {
                                    if (v) {
                                      const { addedByStore, categoryNamesByStore } = await ProductService.bulkAddStoreProductLinks([
                                        {
                                          product_id: String(product.id),
                                          store_id: String(sid),
                                          is_active: true,
                                          custom_price: product.price ?? null,
                                          custom_price_old: product.price_old ?? null,
                                          custom_price_promo: product.price_promo ?? null,
                                          custom_stock_quantity: product.stock_quantity ?? null,
                                          custom_available: product.available ?? true,
                                        },
                                      ]);
                                      ProductService.invalidateStoreLinksCache(String(product.id));
                                      toast.success(t("product_added_to_store"));
                                      {
                                        const sidStr = String(sid);
                                        const added = Math.max(0, Number(addedByStore?.[sidStr] ?? 1) || 0);
                                        if (added > 0) ShopCountsService.bumpProducts(queryClient, uid, sidStr, added);
                                        const cats = categoryNamesByStore?.[sidStr];
                                        if (Array.isArray(cats)) {
                                          const cnt = cats.length;
                                          queryClient.setQueryData(ShopCountsService.key(uid, sidStr), (old: any) => {
                                            const prevProducts = Number(old?.productsCount ?? 0) || 0;
                                            return { productsCount: prevProducts, categoriesCount: cnt };
                                          });
                                          queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], (prev) => {
                                            if (!Array.isArray(prev)) return prev;
                                            return prev.map((s) => (String(s.id) === sidStr ? { ...s, categoriesCount: cnt } : s));
                                          });
                                        }
                                      }
                                      try { setBadgeOpenId(String(id)); } catch { void 0; }
                                    } else {
                                      const { deletedByStore, categoryNamesByStore } = await ProductService.bulkRemoveStoreProductLinks([String(product.id)], [String(sid)]);
                                      ProductService.invalidateStoreLinksCache(String(product.id));
                                      toast.success(t("product_removed_from_store"));
                                      {
                                        const sidStr = String(sid);
                                        const deleted = Math.max(0, Number(deletedByStore?.[sidStr] ?? 1) || 0);
                                        if (deleted > 0) ShopCountsService.bumpProducts(queryClient, uid, sidStr, -deleted);
                                        const cats = categoryNamesByStore?.[sidStr];
                                        if (Array.isArray(cats)) {
                                          const cnt = cats.length;
                                          queryClient.setQueryData(ShopCountsService.key(uid, sidStr), (old: any) => {
                                            const prevProducts = Number(old?.productsCount ?? 0) || 0;
                                            return { productsCount: prevProducts, categoriesCount: cnt };
                                          });
                                          queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], (prev) => {
                                            if (!Array.isArray(prev)) return prev;
                                            return prev.map((s) => (String(s.id) === sidStr ? { ...s, categoriesCount: cnt } : s));
                                          });
                                        }
                                      }
                                      try { setBadgeOpenId(String(id)); } catch { void 0; }
                                    }
                                  } catch {
                                    setLinkedStoreIds(prevIds);
                                    toast.error(t("operation_failed"));
                                  } finally {
                                    setTogglingStoreIds((prev) => prev.filter((sid0) => sid0 !== sid));
                                  }
                                }}
                                aria-label={t("select_store")}
                              />
                              {togglingStoreIds.includes(sid) ? (
                                <Loader2 className="absolute h-3 w-3 animate-spin text-emerald-600 pointer-events-none" />
                              ) : null}
                            </div>
                            <span className="truncate">{s.store_name || s.store_url || "—"}</span>
                          </DropdownMenuItem>
                        );
                      })
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {onRemove ? (
                <button
                  type="button"
                  className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded hover:bg-emerald-100 text-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(String(product.id), String(id));
                  }}
                  aria-label={`remove_store_${id}`}
                  data-testid={`user_products_store_remove_${id}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-3 w-3">
                    <path d="M18 6 6 18"></path>
                    <path d="M6 6l12 12"></path>
                  </svg>
                </button>
              ) : null}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
