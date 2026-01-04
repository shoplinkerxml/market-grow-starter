import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useOutletContext } from "react-router-dom";
import { useI18n } from "@/i18n";
import type { Product } from "@/lib/product-service";
import type { ShopAggregated } from "@/lib/shop-service";
import { useProductColumns, type ProductRow } from "./columns";
import { ProductsTableProvider } from "./context";
import { ProductsTableView } from "./ProductsTableView";
import { useProductsData } from "./useProductsData";
import { useProductsDelete } from "./useProductsDelete";
import { useProductsHandlers } from "./useProductsHandlers";
import {
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_VISIBILITY,
  ensureActionsLast,
  loadColumnVisibilityFromPrefs,
  loadPaginationFromPrefs,
  productsTableReducer,
  withStoreSpecificColumns,
  type PaginationState,
  type ProductsTableState,
} from "./state";

type ProductsTableProps = { onEdit?: (product: Product) => void; onDelete?: (product: Product) => Promise<void> | void; onCreateNew?: () => void; onProductsLoaded?: (count: number) => void; onLoadingChange?: (loading: boolean) => void; refreshTrigger?: number; canCreate?: boolean; storeId?: string; hideDuplicate?: boolean };
type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };

function initState(storeId?: string): ProductsTableState {
  return {
    pagination: loadPaginationFromPrefs(),
    rowSelection: {},
    columnVisibility: loadColumnVisibilityFromPrefs(DEFAULT_COLUMN_VISIBILITY),
    columnOrder: withStoreSpecificColumns(DEFAULT_COLUMN_ORDER, storeId),
    columnFilters: [] as ColumnFiltersState,
    sorting: [] as SortingState,
    storesMenuOpen: false,
    selectedStoreIds: [],
    addingStores: false,
    removingStores: false,
    removingStoreId: null,
    deleteDialog: { open: false, productId: null },
    copyDialog: { open: false, name: null },
    deleteProgress: { open: false },
  };
}

export const ProductsTable = ({ onEdit, onDelete, onCreateNew, onProductsLoaded, onLoadingChange, refreshTrigger, canCreate, storeId, hideDuplicate }: ProductsTableProps) => {
  const { t } = useI18n();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [state, dispatch] = useReducer(productsTableReducer, storeId, initState);

  const { queryClient, productsBaseKey, items, pageInfo, loading, setProductsCached, stores, loadStoresForMenu } = useProductsData({ uid, storeId, pageSize: state.pagination.pageSize, pageIndex: state.pagination.pageIndex, refreshTrigger, onProductsLoaded, onLoadingChange });
  const productsCount = pageInfo?.total ?? items.length;
  const currentStart = state.pagination.pageIndex * state.pagination.pageSize;
  const currentEnd = currentStart + state.pagination.pageSize;
  const rows = useMemo(() => items.slice(currentStart, Math.min(currentEnd, items.length)), [items, currentEnd, currentStart]);
  const pageCount = Math.max(1, Math.ceil((productsCount / state.pagination.pageSize) || 1));

  useEffect(() => {
    if (state.pagination.pageIndex >= pageCount && pageCount > 0) dispatch({ type: "setPagination", next: (prev) => ({ ...prev, pageIndex: Math.max(0, pageCount - 1) }) });
  }, [pageCount, state.pagination.pageIndex]);

  const storeNames = useMemo<Record<string, string>>(() => Object.fromEntries((stores || []).map((s) => [String(s.id), String(s.store_name || "")]).filter(([, name]) => !!name)), [stores]);
  const categoryFilterOptions = useMemo(() => (storeId ? Array.from(new Set((items || []).map((p) => String(p.categoryName || "")).filter(Boolean))) : []), [items, storeId]);
  const setCopyDialog = useCallback((next: { open: boolean; name: string | null }) => dispatch({ type: "setCopyDialog", next }), []);
  const setDeleteProgress = useCallback((next: { open: boolean }) => dispatch({ type: "setDeleteProgress", next }), []);
  const closeDeleteDialog = useCallback(() => dispatch({ type: "setDeleteDialog", next: { open: false, productId: null } }), []);
  const setDeleteDialog = useCallback((v: { open: boolean; product: ProductRow | null }) => dispatch({ type: "setDeleteDialog", next: { open: v.open, productId: v.product ? String(v.product.id) : null } }), []);

  const { handleDuplicate, handleToggleAvailable, handleStoresUpdate, handleRemoveStoreLink } = useProductsHandlers({ t, uid, storeId, canCreate, queryClient, productsBaseKey, setProductsCached, setCopyDialog });
  const columns: ColumnDef<ProductRow>[] = useProductColumns({ t, storeId, categoryFilterOptions, storeNames, stores, loadStoresForMenu, handleRemoveStoreLink, handleStoresUpdate, onEdit: onEdit as any, setDeleteDialog, handleDuplicate, canCreate, hideDuplicate, handleToggleAvailable, duplicating: state.copyDialog.open });

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting: state.sorting, columnVisibility: state.columnVisibility, rowSelection: state.rowSelection, columnFilters: state.columnFilters, pagination: state.pagination, columnOrder: withStoreSpecificColumns(state.columnOrder, storeId) },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    enableRowSelection: true,
    onRowSelectionChange: (updater) => dispatch({ type: "setRowSelection", next: (typeof updater === "function" ? (updater as any)(state.rowSelection) : updater) as any }),
    onSortingChange: (updater) => dispatch({ type: "setSorting", next: (typeof updater === "function" ? (updater as any)(state.sorting) : updater) as any }),
    onColumnFiltersChange: (updater) => dispatch({ type: "setColumnFilters", next: (typeof updater === "function" ? (updater as any)(state.columnFilters) : updater) as any }),
    onColumnVisibilityChange: (updater) => dispatch({ type: "setColumnVisibility", next: (typeof updater === "function" ? (updater as any)(state.columnVisibility) : updater) as VisibilityState }),
    onColumnOrderChange: (updater) => dispatch({ type: "setColumnOrder", next: (prev) => ensureActionsLast((typeof updater === "function" ? (updater as (p: string[]) => string[])(prev) : updater) as string[]) }),
    onPaginationChange: (updater) => dispatch({ type: "setPagination", next: updater as any }),
  });

  useEffect(() => {
    try {
      const selected = table.getSelectedRowModel().rows.map((r) => r.original) as ProductRow[];
      if (selected.length === 1) dispatch({ type: "setSelectedStoreIds", next: Array.from(new Set((selected[0].linkedStoreIds || []).map(String))) });
    } catch { void 0; }
  }, [state.rowSelection, table]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    dispatch({ type: "setColumnOrder", next: (prev) => {
      const withoutActions = prev.filter((id) => id !== "actions");
      const fromIndex = withoutActions.indexOf(String(active.id));
      const toIndex = withoutActions.indexOf(String(over.id));
      if (fromIndex === -1 || toIndex === -1) return ensureActionsLast(withoutActions);
      return ensureActionsLast(arrayMove(withoutActions, fromIndex, toIndex));
    } });
  }, []);

  const deleteDialogProduct = useMemo(() => (state.deleteDialog.productId ? (items || []).find((p) => String(p.id) === String(state.deleteDialog.productId)) ?? null : null), [items, state.deleteDialog.productId]);
  const { handleConfirmDelete } = useProductsDelete({ t, uid, storeId, onDelete, refreshTrigger, queryClient, productsBaseKey, table, setProductsCached, setDeleteProgress, closeDeleteDialog });
  const setStores = useCallback((v: ShopAggregated[]) => queryClient.setQueryData(["user", uid, "shops"], v), [queryClient, uid]);
  const setStoresMenuOpen = useCallback((v: boolean) => dispatch({ type: "setStoresMenuOpen", next: v }), []);
  const setSelectedStoreIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => dispatch({ type: "setSelectedStoreIds", next: updater }), []);
  const setRemovingStores = useCallback((v: boolean) => dispatch({ type: "setRemovingStores", next: v }), []);
  const setRemovingStoreId = useCallback((v: string | null) => dispatch({ type: "setRemovingStoreId", next: v }), []);
  const setAddingStores = useCallback((v: boolean) => dispatch({ type: "setAddingStores", next: v }), []);
  const onDeleteDialogChange = useCallback((open: boolean) => dispatch({ type: "setDeleteDialog", next: { open, productId: open ? state.deleteDialog.productId : null } }), [state.deleteDialog.productId]);
  const setPagination = useCallback((updater: PaginationState | ((prev: PaginationState) => PaginationState)) => dispatch({ type: "setPagination", next: updater }), []);

  const providerValue = useMemo(
    () => ({
      t,
      table,
      storeId,
      onCreateNew,
      onEdit: onEdit as any,
      canCreate,
      hideDuplicate,
      loading,
      duplicating: state.copyDialog.open,
      queryClient,
      items,
      stores,
      setStores,
      storesMenuOpen: state.storesMenuOpen,
      setStoresMenuOpen,
      selectedStoreIds: state.selectedStoreIds,
      setSelectedStoreIds,
      removingStores: state.removingStores,
      setRemovingStores,
      removingStoreId: state.removingStoreId,
      setRemovingStoreId,
      addingStores: state.addingStores,
      setAddingStores,
      setDeleteDialog,
      handleDuplicate,
      loadStoresForMenu,
      setProductsCached,
    }),
    [
      canCreate,
      handleDuplicate,
      hideDuplicate,
      items,
      loadStoresForMenu,
      loading,
      onCreateNew,
      onEdit,
      queryClient,
      setAddingStores,
      setDeleteDialog,
      setRemovingStoreId,
      setRemovingStores,
      setSelectedStoreIds,
      setStores,
      setStoresMenuOpen,
      setProductsCached,
      storeId,
      stores,
      t,
      table,
      state.addingStores,
      state.copyDialog.open,
      state.removingStoreId,
      state.removingStores,
      state.selectedStoreIds,
      state.storesMenuOpen,
    ],
  );
  const enableVirtual = rows.length > 50 && state.pagination.pageSize >= 20;

  return (
    <ProductsTableProvider value={providerValue}>
      <ProductsTableView columns={columns} rows={rows} pageInfo={pageInfo as PageInfo | null} pagination={state.pagination} setPagination={setPagination} copyDialog={state.copyDialog} deleteProgressOpen={state.deleteProgress.open} deleteDialog={{ open: state.deleteDialog.open, product: deleteDialogProduct }} onDeleteDialogChange={onDeleteDialogChange} onConfirmDelete={() => handleConfirmDelete(deleteDialogProduct)} sensors={sensors} handleDragEnd={handleDragEnd} enableVirtual={enableVirtual} />
    </ProductsTableProvider>
  );
};

export default ProductsTable;
