import { useCallback } from "react";
import { toast } from "sonner";
import { ProductService, type Product } from "@/lib/product-service";
import { ShopCountsService } from "@/lib/shop-counts";
import type { QueryClient } from "@tanstack/react-query";
import type { Table as TanTable } from "@tanstack/react-table";
import type { ProductRow } from "./columns";
import type { ShopAggregated } from "@/lib/shop-service";
import type { ShopCounts } from "@/types/shop";

export function useProductsDelete({
  t,
  uid,
  storeId,
  onDelete,
  refreshTrigger: _refreshTrigger,
  queryClient,
  productsBaseKey,
  table,
  setProductsCached,
  setDeleteProgress,
  closeDeleteDialog,
}: {
  t: (k: string) => string;
  uid: string;
  storeId?: string;
  onDelete?: (product: Product) => Promise<void> | void;
  refreshTrigger?: number;
  queryClient: QueryClient;
  productsBaseKey: readonly unknown[];
  table: TanTable<ProductRow>;
  setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void;
  setDeleteProgress: (next: { open: boolean }) => void;
  closeDeleteDialog: () => void;
}) {
  const handleConfirmDelete = useCallback(
    async (productToDelete: ProductRow | null) => {
      closeDeleteDialog();
      const prevQueries = queryClient.getQueriesData({ queryKey: productsBaseKey, exact: false });
      const patchTotal = (delta: number) => {
        if (!delta) return;
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
                    ? { ...pageInfo, total: Math.max(0, pageInfo.total + delta) }
                    : pageInfo;
                return { ...page, page: nextPageInfo };
              }),
            };
          }
          return old;
        });
      };
      try {
        if (productToDelete) {
          const showProgress = !!storeId;
          if (showProgress) setDeleteProgress({ open: true });
          try {
            setProductsCached((prev) => prev.filter((p) => String(p.id) !== String(productToDelete.id)));
            patchTotal(-1);
            await onDelete?.(productToDelete);
          } finally {
            if (showProgress) setDeleteProgress({ open: false });
          }
        } else {
          const selected = table.getSelectedRowModel().rows.map((r) => r.original) as ProductRow[];
          if (storeId) {
            try {
              const ids = selected.map((p) => String(p.id)).filter(Boolean);
              setProductsCached((prev) => prev.filter((p) => !ids.includes(String(p.id))));
              patchTotal(-ids.length);
              setDeleteProgress({ open: true });
              const { deleted, deletedByStore, categoryNamesByStore } = await ProductService.bulkRemoveStoreProductLinks(
                ids,
                [String(storeId)],
              );
              const sid = String(storeId);
              const removedCount = Math.max(0, Number(deletedByStore?.[sid] ?? deleted ?? ids.length) || 0);
              const correction = -removedCount - -ids.length;
              if (correction !== 0) patchTotal(correction);
              try {
                if (removedCount > 0) ShopCountsService.bumpProducts(queryClient, uid, sid, -removedCount);
                const cats = categoryNamesByStore?.[sid];
                if (Array.isArray(cats)) {
                  const cnt = cats.length;
                  queryClient.setQueryData<ShopCounts>(ShopCountsService.key(uid, sid), (old) => {
                    const prevProducts = Number(old?.productsCount ?? 0) || 0;
                    return { productsCount: prevProducts, categoriesCount: cnt };
                  });
                  queryClient.setQueryData<ShopAggregated[]>(["user", uid, "shops"], (prev) => {
                    if (!Array.isArray(prev)) return prev;
                    return prev.map((s) => (String(s.id) === sid ? { ...s, categoriesCount: cnt } : s));
                  });
                  queryClient.setQueryData<ShopAggregated | null>(["user", uid, "shopDetail", sid], (prev) => {
                    if (!prev) return prev;
                    return { ...prev, categoriesCount: cnt };
                  });
                }
              } catch {
                void 0;
              }
              toast.success(t("product_removed_from_store"));
            } catch {
              for (const [k, v] of prevQueries) {
                queryClient.setQueryData(k, v);
              }
              toast.error(t("failed_remove_from_store"));
            } finally {
              setDeleteProgress({ open: false });
            }
            table.resetRowSelection();
          } else {
            const ids = selected.map((p) => String(p.id));
            if (onDelete && selected.length === 1) {
              setProductsCached((prev) => prev.filter((p) => String(p.id) !== String(selected[0].id)));
              patchTotal(-1);
              await onDelete(selected[0]);
            } else {
              try {
                setProductsCached((prev) => prev.filter((p) => !ids.includes(String(p.id))));
                patchTotal(-ids.length);
                setDeleteProgress({ open: true });
                await ProductService.bulkDeleteProducts(ids);
                toast.success(t("products_deleted_successfully"));
              } catch {
                for (const [k, v] of prevQueries) {
                  queryClient.setQueryData(k, v);
                }
                toast.error(t("failed_delete_product"));
              } finally {
                setDeleteProgress({ open: false });
              }
            }
            table.resetRowSelection();
          }
        }
      } catch (error) {
        for (const [k, v] of prevQueries) {
          queryClient.setQueryData(k, v);
        }
        console.error("Delete error:", error);
      }
    },
    [closeDeleteDialog, onDelete, productsBaseKey, queryClient, setDeleteProgress, setProductsCached, storeId, t, table, uid],
  );

  return { handleConfirmDelete };
}
