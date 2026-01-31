import React, { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, MoreVertical, Copy, Loader2, Store, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { ProductService, type Product } from "@/lib/product-service";
import type { ShopAggregated } from "@/lib/shop-service";
import { useSyncStatus } from "@/lib/optimistic-mutation";
import { useOutletContext } from "react-router-dom";
import { UserAuthService } from "@/lib/user-auth-service";

type ProductRow = Product & {
  linkedStoreIds?: string[];
  category_id?: number | null;
  category_external_id?: string | null;
  stock_quantity?: number | null;
  available?: boolean;
};

export function ProductActionsDropdown({ product, onEdit, onDelete, onDuplicate, onTrigger, canCreate, hideDuplicate, storeId, onStoresUpdate, storesList, prefetchStores, storeNames, duplicating }: { product: ProductRow; onEdit: () => void; onDelete: () => void; onDuplicate?: () => void; onTrigger?: () => void; canCreate?: boolean; hideDuplicate?: boolean; storeId?: string; onStoresUpdate?: (productId: string, ids: string[], opts?: { storeIdChanged?: string; added?: boolean; categoryKey?: string | null }) => void; storesList?: ShopAggregated[]; prefetchStores?: () => Promise<void>; storeNames?: Record<string, string>; duplicating?: boolean; }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [stores, setStores] = useState<ShopAggregated[]>([]);
  const [linkedStoreIds, setLinkedStoreIds] = useState<string[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [togglingStoreIds, setTogglingStoreIds] = useState<string[]>([]);
  const duplicationStatus = useSyncStatus(`product:duplicate:${product.id}`);
  const isDupPending = duplicationStatus?.status === "pending";
  const isDupError = duplicationStatus?.status === "error";

  const loadStoresAndLinks = async () => {
    const initialLinked = Array.isArray(product.linkedStoreIds) ? (product.linkedStoreIds as string[]).map(String) : [];
    setLinkedStoreIds(initialLinked);

    try {
      try { await prefetchStores?.(); } catch { void 0; }
      const cachedAgg = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]) || [];
      if (cachedAgg.length > 0) {
        setStores(cachedAgg);
      } else {
        setLoadingStores(true);
        try {
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
          const arr = rows.map((s) => ({
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
          setStores(arr);
        } finally {
          setLoadingStores(false);
        }
      }
      if (!Array.isArray(product.linkedStoreIds)) {
        const ids = await ProductService.getStoreLinksForProduct(product.id);
        setLinkedStoreIds(ids);
      }
    } catch {
      const fallback = Array.isArray(storesList) && storesList.length > 0
        ? storesList
        : Object.entries(storeNames || {}).map(([id, name]) => ({ id: String(id), store_name: name })) as ShopAggregated[];
      setStores(fallback);
      setLinkedStoreIds(initialLinked);
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(storesList) && storesList.length > 0) setStores(storesList);
  }, [storesList]);

  const [actionsOpen, setActionsOpen] = useState(false);
  return (
    <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full border border-border hover:border-emerald-500 hover:text-emerald-600"
          aria-label="Open row actions"
          onClick={() => { onTrigger?.(); }}
          disabled={duplicating === true || isDupPending}
          aria-disabled={duplicating === true || isDupPending}
          data-testid="user_products_row_actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border border-emerald-300/40 dark:bg-neutral-900/80 dark:border-emerald-500/40">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer" data-testid="user_products_row_edit">
          <Edit className="mr-2 h-4 w-4" />
          {t("edit")}
        </DropdownMenuItem>
        {hideDuplicate ? null : (
          <DropdownMenuItem
            onClick={onDuplicate}
            className="cursor-pointer"
            data-testid="user_products_row_duplicate"
            disabled={canCreate === false || duplicating === true || isDupPending}
            aria-disabled={canCreate === false || duplicating === true || isDupPending}
          >
            {isDupPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className={`mr-2 h-4 w-4 ${isDupError ? "text-destructive" : ""}`} />
            )}
            {t("duplicate")}
          </DropdownMenuItem>
        )}
        {storeId ? null : (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              onClick={loadStoresAndLinks}
              data-testid={`user_products_row_stores_trigger_${product.id}`}
            >
              <Store className="mr-2 h-4 w-4" />
              {t("menu_stores")}
            </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="p-1 bg-white border border-emerald-300/40 dark:bg-neutral-900/80 dark:border-emerald-500/40" data-testid={`user_products_row_stores_content_${product.id}`}>
              {((stores || []).length === 0 && loadingStores) ? (
                <DropdownMenuItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                            className="cursor-pointer pr-2 pl-2 hover:bg-muted/60 focus:bg-muted/60 dark:hover:bg-emerald-900/40 dark:focus:bg-emerald-900/40"
                            onSelect={(e) => e.preventDefault()}
                            data-testid={`user_products_row_store_item_${product.id}_${id}`}
                          >
                            <div className="relative mr-2 inline-flex items-center justify-center" aria-busy={togglingStoreIds.includes(id)}>
                              <Checkbox
                                checked={checked}
                                disabled={togglingStoreIds.includes(id)}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={async (v) => {
                                  setTogglingStoreIds((prev) => Array.from(new Set([...prev, id])));
                                  const baseIds = Array.from(new Set([...initialLinked.map(String), ...linkedStoreIds.map(String)]));
                                  const nextIds = v
                                    ? Array.from(new Set([...baseIds, id]))
                                    : baseIds.filter((x) => String(x) !== String(id));
                                  setLinkedStoreIds(nextIds);
                                  const categoryKey = product.category_id != null ? `cat:${product.category_id}` : product.category_external_id ? `ext:${product.category_external_id}` : null;
                                  try { onStoresUpdate?.(product.id, nextIds, { storeIdChanged: id, added: !!v, categoryKey }); } catch { void 0; }
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
                                      toast.success(t("product_added_to_store"));
                                    } else {
                                      await ProductService.bulkRemoveStoreProductLinks(
                                        [String(product.id)],
                                        [String(id)]
                                      );
                                      toast.success(t("product_removed_from_store"));
                                    }
                                  } catch {
                                    setLinkedStoreIds(baseIds);
                                    try { onStoresUpdate?.(product.id, baseIds, { storeIdChanged: id, added: !v, categoryKey }); } catch { void 0; }
                                    toast.error(t("operation_failed"));
                                  } finally {
                                    setTogglingStoreIds((prev) => prev.filter((sid) => sid !== id));
                                    try { setActionsOpen(true); } catch { void 0; }
                                  }
                                    }}
                                    aria-label={t("select_store")}
                                  />
                              {togglingStoreIds.includes(id) ? (
                                <Loader2 className="absolute h-3 w-3 animate-spin text-emerald-600 pointer-events-none" />
                              ) : null}
                            </div>
                            <span className="truncate">{s.store_name || s.store_url || "—"}</span>
                          </DropdownMenuItem>
                        );
                      })
                    )
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="cursor-pointer focus:text-destructive" data-testid="user_products_row_delete">
          <Trash2 className="mr-2 h-4 w-4" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
