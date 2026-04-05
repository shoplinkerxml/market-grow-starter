import { useState, useEffect, useCallback, useLayoutEffect, useRef, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Store, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import type { ShopAggregated } from "@/lib/shop-service";
import { ProductService, type Product } from "@/lib/product-service";
import { useOutletContext } from "react-router-dom";
import { UserAuthService } from "@/lib/user-auth-service";

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [stores, setStores] = useState<ShopAggregated[]>([]);
  const [linkedStoreIds, setLinkedStoreIds] = useState<string[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [togglingStoreIds, setTogglingStoreIds] = useState<string[]>([]);
  const measureTextRef = useRef<HTMLSpanElement | null>(null);
  const [storesMenuWidthPx, setStoresMenuWidthPx] = useState<number>(176);

  const addMenuId = `add:${product.id}`;

  const loadStoresAndLinks = useCallback(async () => {
      let shops: ShopAggregated[] = [];
      try {
        try { await prefetchStores?.(); } catch { void 0; }
      const cachedAgg = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]) || [];
      if (cachedAgg.length > 0) {
        shops = cachedAgg;
      } else {
        setLoadingStores(true);
        const cachedAuthMe = queryClient.getQueryData<any>(["auth", "me"]);
        const cachedRows = Array.isArray((cachedAuthMe as any)?.userStores)
          ? ((cachedAuthMe as any).userStores as Array<{ id: string; store_name: string }>)
          : null;
        const authMe = cachedRows && cachedRows.length > 0 ? null : await UserAuthService.fetchAuthMe();
        const baseIso = new Date(0).toISOString();
        const rows = cachedRows && cachedRows.length > 0
          ? cachedRows
          : Array.isArray((authMe as any)?.userStores)
            ? ((authMe as any).userStores as Array<{ id: string; store_name: string }>)
            : [];
        shops = rows.map((s) => ({
          id: String(s.id),
          user_id: String(uid),
          store_name: String(s.store_name || ""),
          store_company: null,
          store_url: null,
          template_id: null,
          xml_config: null,
          custom_mapping: null,
          marketplace: undefined,
          is_active: true,
          created_at: baseIso,
          updated_at: baseIso,
        })) as ShopAggregated[];
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

  useEffect(() => { if (Array.isArray(storesList) && storesList.length > 0) setStores(storesList); }, [storesList]);
  useEffect(() => { setLinkedStoreIds(product.linkedStoreIds || []); }, [product.linkedStoreIds]);

  useLayoutEffect(() => {
    if (!openMenuId) return;
    const measureEl = measureTextRef.current;
    if (!measureEl) return;

    const labels = (stores || []).map((s) => String(s.store_name || s.store_url || s.id || ""));
    if (labels.length === 0) {
      setStoresMenuWidthPx(176);
      return;
    }

    const computed = window.getComputedStyle(measureEl);
    const font = computed.font;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = font;

    let maxTextWidth = 0;
    for (const label of labels) {
      const w = ctx.measureText(label).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const basePaddingPx = 16;
    const checkboxPx = 16;
    const gapPx = 8;
    const safetyPx = 20;
    const minPx = 140;
    const maxPx = 360;

    const next = Math.min(maxPx, Math.max(minPx, Math.ceil(maxTextWidth + basePaddingPx + checkboxPx + gapPx + safetyPx)));
    setStoresMenuWidthPx(next);
  }, [openMenuId, stores]);

  const handleOpenChange = useCallback((menuId: string, v: boolean) => {
    if (v && menuId === addMenuId && product.is_active === false) {
      toast.error(t("inactive_products_cannot_add_to_store"));
      return;
    }
    setOpenMenuId((prev) => {
      if (v) return menuId;
      if (prev === menuId) return null;
      return prev;
    });
    if (v) void loadStoresAndLinks();
  }, [addMenuId, loadStoresAndLinks, product.is_active, t]);

  const renderStoresDropdownContent = useCallback((menuId: string) => {
    return (
      <DropdownMenuContent
        align="start"
        className="p-1 overflow-visible bg-white border border-emerald-300/40 dark:bg-neutral-900/80 dark:border-emerald-500/40"
        style={
          {
            width: `${storesMenuWidthPx}px`,
            ["--stores-menu-hover-extra" as any]: "16px",
          } as CSSProperties
        }
        data-testid={`user_products_store_menu_content_${product.id}_${menuId}`}
      >
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
              const isToggling = togglingStoreIds.includes(id);

              return (
                <DropdownMenuItem
                  key={id}
                  className="group relative flex w-full cursor-pointer items-center gap-2 pl-2 pr-2 hover:bg-muted/60 focus:bg-muted/60 dark:hover:bg-emerald-900/40 dark:focus:bg-emerald-900/40 hover:w-[calc(100%+var(--stores-menu-hover-extra))] focus:w-[calc(100%+var(--stores-menu-hover-extra))] hover:pr-8 focus:pr-8 transition-[width,padding] duration-150 ease-out"
                  onSelect={(e) => e.preventDefault()}
                  data-testid={`user_products_store_menu_item_${product.id}_${menuId}_${id}`}
                >
                  <div className="relative inline-flex items-center justify-center" aria-busy={isToggling}>
                    <Checkbox
                      checked={checked}
                      disabled={isToggling}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={async (v) => {
                        if (v && product.is_active === false) {
                          toast.error(t("inactive_products_cannot_add_to_store"));
                          return;
                        }
                        setTogglingStoreIds((prev) => Array.from(new Set([...prev, id])));
                        const prevIds = linkedStoreIds.slice();
                        const nextIds = v ? Array.from(new Set([...linkedStoreIds, id])) : linkedStoreIds.filter((x) => String(x) !== String(id));
                        setLinkedStoreIds(nextIds);
                        const categoryKey = product.category_id != null ? `cat:${product.category_id}` : product.category_external_id ? `ext:${product.category_external_id}` : null;
                        try { onStoresUpdate?.(String(product.id), nextIds, { storeIdChanged: id, added: !!v, categoryKey }); } catch { void 0; }
                        try {
                          if (v) {
                            await ProductService.bulkAddStoreProductLinks([
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
                          } else {
                            await ProductService.bulkRemoveStoreProductLinks([String(product.id)], [String(id)]);
                            ProductService.invalidateStoreLinksCache(String(product.id));
                            toast.success(t("product_removed_from_store"));
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
                    {isToggling ? (
                      <Loader2 className="absolute h-3 w-3 animate-spin text-emerald-600 pointer-events-none" />
                    ) : null}
                  </div>

                  <span className="truncate">{s.store_name || s.store_url || id}</span>

                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-muted hover:text-foreground dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
                    aria-label="close_menu"
                    data-testid={`user_products_store_menu_close_${product.id}_${menuId}_${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuId(null);
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </DropdownMenuItem>
              );
            })
          )
        )}
      </DropdownMenuContent>
    );
  }, [linkedStoreIds, loadingStores, product, stores, t, togglingStoreIds, onStoresUpdate, storesMenuWidthPx]);

  if (storeIds.length === 0) {
    return (
      <div className="w-full flex items-center justify-center">
      <DropdownMenu
        open={openMenuId === addMenuId}
        onOpenChange={(v) => handleOpenChange(addMenuId, v)}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`h-6 w-6 p-0 mx-auto rounded-full border border-border bg-muted hover:border-emerald-500 hover:text-emerald-600 hover:bg-muted/80 dark:border-emerald-500/60 dark:text-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 ${product.is_active === false ? "text-muted-foreground opacity-70" : "text-muted-foreground"}`}
            aria-label={t("menu_stores")}
            aria-disabled={product.is_active === false}
            data-testid={`user_products_store_add_trigger_${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Store className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        {renderStoresDropdownContent(addMenuId)}
      </DropdownMenu>
      <span ref={measureTextRef} className="fixed -left-[9999px] -top-[9999px] whitespace-nowrap text-sm" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-1">
      {storeIds.map((id) => {
        const name = storeNames[String(id)] || "";
        const label = name || "…";
        return (
          <div key={id} className="flex items-center">
            <DropdownMenu open={openMenuId === String(id)} onOpenChange={(v) => handleOpenChange(String(id), v)}>
              <DropdownMenuTrigger asChild>
                <div
                  className="group relative inline-block cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  data-testid={`user_products_store_badge_trigger_${product.id}_${id}`}
                >
                  <Badge
                    variant="secondary"
                    className="relative inline-flex items-center rounded-md px-2 py-0 text-[11px] h-5 max-w-[10rem] truncate transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
                  >
                    <span className="min-w-0 select-none truncate" title={name} data-testid={`user_products_store_badge_${product.id}_${id}`}>
                      {label}
                    </span>
                  </Badge>

                  <Badge
                    variant="secondary"
                    className="absolute inset-y-0 left-0 z-20 inline-flex h-full w-[calc(100%+18px)] items-center rounded-md px-2 py-0 pr-6 text-[11px] opacity-0 pointer-events-none overflow-visible transition-[opacity,width,padding] duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
                  >
                    <span className="min-w-0 flex-1 select-none truncate" title={name}>
                      {label}
                    </span>
                    {onRemove ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground opacity-0 pointer-events-auto transition-[opacity,transform,color,background-color] duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 hover:scale-110 hover:bg-black/30 hover:text-white active:scale-95 dark:hover:bg-emerald-900/70 dark:hover:text-emerald-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemove?.(String(product.id), String(id));
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        aria-label={`remove_store_${id}`}
                        data-testid={`user_products_store_remove_${id}`}
                      >
                        <X className="h-[10px] w-[10px]" />
                      </button>
                    ) : null}
                  </Badge>

                </div>
              </DropdownMenuTrigger>
              {renderStoresDropdownContent(String(id))}
            </DropdownMenu>
          </div>
        );
      })}
      <span ref={measureTextRef} className="fixed -left-[9999px] -top-[9999px] whitespace-nowrap text-sm" />
    </div>
  );
}
