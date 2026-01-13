import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { ProductService, type Product } from "@/lib/product-service";
import { runOptimisticOperation } from "@/lib/optimistic-mutation";
import type { QueryClient } from "@tanstack/react-query";
import type { ProductRow } from "./columns";

export type ProductsHandlersArgs = {
  t: (k: string) => string;
  uid: string;
  storeId?: string;
  canCreate?: boolean;
  queryClient: QueryClient;
  productsBaseKey: readonly unknown[];
  setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void;
  setCopyDialog: (next: { open: boolean; name: string | null }) => void;
};

export function useProductsHandlers({
  t,
  uid,
  storeId,
  canCreate,
  queryClient,
  productsBaseKey,
  setProductsCached,
  setCopyDialog,
}: ProductsHandlersArgs) {
  const duplicatingRef = useRef(false);
  const handleDuplicate = useCallback(
    async (product: Product) => {
      try {
        if (duplicatingRef.current) return;
        if (canCreate === false) {
          toast.error(t("products_limit_reached") + ". " + t("upgrade_plan"));
          return;
        }
        const nameForUi = product.name_ua || product.name || product.external_id || product.id;
        setCopyDialog({ open: true, name: nameForUi });
        duplicatingRef.current = true;
        await runOptimisticOperation({
          entityKey: `product:duplicate:${product.id}`,
          run: async () => {
            const duplicated = await ProductService.duplicateProduct(product.id);
            const duplicatedRow = duplicated as unknown as ProductRow;
            const duplicatedId = String((duplicatedRow as unknown as { id?: unknown })?.id ?? "");
            if (!duplicatedId) throw new Error("duplicate_failed");

            queryClient.setQueriesData({ queryKey: productsBaseKey, exact: false }, (old: any) => {
              if (!old) return old;
              const insert = (items: ProductRow[]) => {
                const without = items.filter((it) => String(it?.id) !== duplicatedId);
                return [duplicatedRow, ...without];
              };

              if (Array.isArray(old)) return insert(old as ProductRow[]);

              if (typeof old === "object" && Array.isArray((old as any).pages)) {
                const prevInf = old as any;
                return {
                  ...prevInf,
                  pages: prevInf.pages.map((page: any, idx: number) => {
                    const products = Array.isArray(page?.products) ? (page.products as ProductRow[]) : null;
                    const nextProducts = products ? (idx === 0 ? insert(products) : products) : page?.products;
                    const pageInfo = page?.page;
                    const nextPageInfo =
                      pageInfo && typeof pageInfo.total === "number"
                        ? { ...pageInfo, total: Math.max(0, pageInfo.total + 1) }
                        : pageInfo;
                    return { ...page, products: nextProducts, page: nextPageInfo };
                  }),
                };
              }

              return old;
            });
          },
        });
      } catch (error) {
        console.error("Duplicate product failed", error);
        queryClient.invalidateQueries({ queryKey: productsBaseKey, exact: false }).catch(() => void 0);
        const err = error as unknown as { message?: unknown };
        const msg = typeof err.message === "string" ? err.message : "";
        if (msg.toLowerCase().includes("ліміт") || msg.toLowerCase().includes("limit")) {
          toast.error(t("products_limit_reached") + ". " + t("upgrade_plan"));
        } else {
          toast.error(t("failed_duplicate_product"));
        }
      } finally {
        setCopyDialog({ open: false, name: null });
        duplicatingRef.current = false;
      }
    },
    [canCreate, queryClient, productsBaseKey, setCopyDialog, t],
  );
  const handleToggleAvailable = useCallback(
    async (productId: string, checked: boolean) => {
      if (!storeId) return;
      try {
        setProductsCached((prev) => prev.map((p) => (p.id === productId ? { ...p, available: checked } : p)));
        await ProductService.updateStoreProductLink(productId, String(storeId), { custom_available: checked });
      } catch {
        setProductsCached((prev) => prev.map((p) => (p.id === productId ? { ...p, available: !checked } : p)));
        toast.error(t("operation_failed"));
      }
    },
    [storeId, setProductsCached, t],
  );
  const handleStoresUpdate = useCallback(
    (productId: string, ids: string[]) => {
      setProductsCached((prev) => prev.map((p) => (p.id === productId ? { ...p, linkedStoreIds: ids } : p)));
    },
    [setProductsCached],
  );
  const handleRemoveStoreLink = useCallback(
    async (productId: string, storeIdToRemove: string) => {
      const pid = String(productId);
      const sid = String(storeIdToRemove);
      const prevQueries = queryClient.getQueriesData({ queryKey: productsBaseKey, exact: false });
      let reverted = false;
      const isRemovingCurrentStore = !!storeId && String(storeId) === sid;
      const applyOptimistic = (deltaTotal: number) => {
        setProductsCached((prev) => {
          if (isRemovingCurrentStore) return prev.filter((p) => String(p.id) !== pid);
          return prev.map((p) =>
            p.id === pid ? { ...p, linkedStoreIds: (p.linkedStoreIds || []).filter((id) => String(id) !== sid) } : p,
          );
        });
        if (!isRemovingCurrentStore) return;
        queryClient.setQueriesData({ queryKey: productsBaseKey, exact: false }, (old: any) => {
          if (!old) return old;
          if (typeof old === "object" && Array.isArray((old as any).pages)) {
            const prevInf = old as any;
            return {
              ...prevInf,
              pages: prevInf.pages.map((page: any) => {
                const pageInfo = page?.page;
                const nextPageInfo =
                  pageInfo && typeof pageInfo.total === "number"
                    ? { ...pageInfo, total: Math.max(0, pageInfo.total + deltaTotal) }
                    : pageInfo;
                return { ...page, page: nextPageInfo };
              }),
            };
          }
          return old;
        });
      };

      applyOptimistic(-1);
      try {
        const { deletedByStore } = await ProductService.bulkRemoveStoreProductLinks([pid], [sid]);
        const deleted = Math.max(0, Number(deletedByStore?.[sid] ?? 1) || 0);
        if (isRemovingCurrentStore) {
          const correction = -deleted - -1;
          if (correction !== 0) applyOptimistic(correction);
        }
        toast.success(t("product_removed_from_store"));
      } catch {
        reverted = true;
        for (const [k, v] of prevQueries) {
          queryClient.setQueryData(k, v);
        }
        toast.error(t("failed_remove_from_store"));
      }
      return !reverted;
    },
    [queryClient, productsBaseKey, setProductsCached, storeId, t],
  );
  return { handleDuplicate, handleToggleAvailable, handleStoresUpdate, handleRemoveStoreLink };
}
