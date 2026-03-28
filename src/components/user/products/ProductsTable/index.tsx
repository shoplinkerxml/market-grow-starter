import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
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
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
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
  DEFAULT_COLUMN_ORDER_STORE,
  DEFAULT_COLUMN_VISIBILITY,
  COLUMN_ORDER_KEY,
  COLUMN_ORDER_STORE_KEY,
  DEFAULT_PRODUCTS_SERVER_FILTERS,
  ROW_ORDER_ALL_KEY,
  ROW_ORDER_STORE_PREFIX,
  loadRowOrderFromPrefs,
  loadRowReorderEnabledFromPrefs,
  ensureActionsLast,
  loadColumnOrderFromPrefs,
  loadColumnVisibilityFromPrefs,
  loadPaginationFromPrefs,
  loadViewModeFromPrefs,
  productsTableReducer,
  withStoreSpecificColumns,
  type PaginationState,
  type ProductsTableState,
  type ProductsViewMode,
} from "./state";

type ProductsTableProps = { onEdit?: (product: Product) => void; onDelete?: (product: Product) => Promise<void> | void; onCreateNew?: () => void; onProductsLoaded?: (count: number) => void; onLoadingChange?: (loading: boolean) => void; refreshTrigger?: number; canCreate?: boolean; suppliersEmpty?: boolean; storeId?: string; hideDuplicate?: boolean };
type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };

function applyRowOrder(items: ProductRow[], order: string[]): ProductRow[] {
  if (!Array.isArray(order) || order.length === 0) return items;
  const pos = new Map<string, number>();
  for (let i = 0; i < order.length; i += 1) pos.set(String(order[i]), i);
  const decorated = items.map((item, idx) => {
    const id = String(item.id);
    const p = pos.get(id);
    return { item, idx, p: typeof p === "number" ? p : Number.POSITIVE_INFINITY };
  });
  decorated.sort((a, b) => (a.p - b.p) || (a.idx - b.idx));
  return decorated.map((d) => d.item);
}

function initState(storeId?: string): ProductsTableState {
  const columnOrderKey = storeId ? COLUMN_ORDER_STORE_KEY : COLUMN_ORDER_KEY;
  const defaults = storeId ? DEFAULT_COLUMN_ORDER_STORE : DEFAULT_COLUMN_ORDER;
  const rowOrderKey = storeId ? `${ROW_ORDER_STORE_PREFIX}${String(storeId)}` : ROW_ORDER_ALL_KEY;
  return {
    pagination: loadPaginationFromPrefs(),
    rowSelection: {},
    columnVisibility: loadColumnVisibilityFromPrefs(DEFAULT_COLUMN_VISIBILITY),
    columnOrder: withStoreSpecificColumns(loadColumnOrderFromPrefs(defaults, columnOrderKey), storeId),
    rowOrder: loadRowOrderFromPrefs(rowOrderKey),
    rowReorderEnabled: loadRowReorderEnabledFromPrefs(),
    viewMode: loadViewModeFromPrefs(),
    columnFilters: [] as ColumnFiltersState,
    sorting: [] as SortingState,
    filtersOpen: false,
    serverFilters: DEFAULT_PRODUCTS_SERVER_FILTERS,
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

export const ProductsTable = ({ onEdit, onDelete, onCreateNew, onProductsLoaded, onLoadingChange, refreshTrigger, canCreate, suppliersEmpty, storeId, hideDuplicate }: ProductsTableProps) => {
  const { t } = useI18n();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [state, dispatch] = useReducer(productsTableReducer, storeId, initState);
  const columnOrderKey = storeId ? COLUMN_ORDER_STORE_KEY : COLUMN_ORDER_KEY;
  const rowOrderKey = storeId ? `${ROW_ORDER_STORE_PREFIX}${String(storeId)}` : ROW_ORDER_ALL_KEY;
  const hasAdjustedInitialOrderRef = useRef(false);

  const { queryClient, productsBaseKey, items, pageInfo, loading, setProductsCached, stores, loadStoresForMenu } = useProductsData({ uid, storeId, pageSize: state.pagination.pageSize, pageIndex: state.pagination.pageIndex, refreshTrigger, onProductsLoaded, onLoadingChange, serverFilters: state.serverFilters });
  const orderedItems = useMemo(() => applyRowOrder(items, state.rowOrder), [items, state.rowOrder]);
  const productsCount = pageInfo?.total ?? items.length;
  const currentStart = state.pagination.pageIndex * state.pagination.pageSize;
  const currentEnd = currentStart + state.pagination.pageSize;
  const rows = useMemo(() => orderedItems.slice(currentStart, Math.min(currentEnd, orderedItems.length)), [currentEnd, currentStart, orderedItems]);
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

  const sortingEffective = state.rowReorderEnabled ? ([] as SortingState) : state.sorting;

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting: sortingEffective, columnVisibility: state.columnVisibility, rowSelection: state.rowSelection, columnFilters: state.columnFilters, pagination: state.pagination, columnOrder: withStoreSpecificColumns(state.columnOrder, storeId) },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    enableRowSelection: (row) => row.original.is_active !== false,
    onRowSelectionChange: (updater) => {
      const nextSelection = (typeof updater === "function" ? (updater as any)(state.rowSelection) : updater) as Record<string, boolean>;
      const sanitizedSelection = Object.fromEntries(
        Object.entries(nextSelection).filter(([rowId, selected]) => {
          if (!selected) return false;
          const row = rows.find((item) => String(item.id) === String(rowId));
          return row?.is_active !== false;
        }),
      );
      dispatch({ type: "setRowSelection", next: sanitizedSelection });
    },
    onSortingChange: (updater) => {
      if (state.rowReorderEnabled) return;
      const nextSorting = (typeof updater === "function" ? (updater as any)(state.sorting) : updater) as any;
      dispatch({ type: "setSorting", next: nextSorting });
      const first = Array.isArray(nextSorting) ? nextSorting[0] : null;
      const nextPriceOrder = first?.id === "price" ? (first?.desc ? "desc" : "asc") : null;
      if (nextPriceOrder !== state.serverFilters.priceOrder) {
        dispatch({ type: "setServerFilters", next: (prev: any) => ({ ...prev, priceOrder: nextPriceOrder }) });
      }
    },
    onColumnFiltersChange: (updater) => dispatch({ type: "setColumnFilters", next: (typeof updater === "function" ? (updater as any)(state.columnFilters) : updater) as any }),
    onColumnVisibilityChange: (updater) => dispatch({ type: "setColumnVisibility", next: (typeof updater === "function" ? (updater as any)(state.columnVisibility) : updater) as VisibilityState }),
    onColumnOrderChange: (updater) =>
      dispatch({
        type: "setColumnOrder",
        storageKey: columnOrderKey,
        next: (prev) => ensureActionsLast((typeof updater === "function" ? (updater as (p: string[]) => string[])(prev) : updater) as string[]),
      }),
    onPaginationChange: (updater) => dispatch({ type: "setPagination", next: updater as any }),
  });

  const toggleRowReorderEnabled = useCallback(() => {
    const next = !state.rowReorderEnabled;
    dispatch({ type: "setRowReorderEnabled", next });
    if (next) dispatch({ type: "setSorting", next: [] as SortingState });
  }, [state.rowReorderEnabled]);

  useEffect(() => {
    if (hasAdjustedInitialOrderRef.current) return;
    hasAdjustedInitialOrderRef.current = true;

    dispatch({
      type: "setColumnOrder",
      storageKey: columnOrderKey,
      next: (prev) => {
        if (prev.includes("photo")) return prev;
        const withoutPhoto = prev.filter((id) => id !== "photo");
        const articleIdx = withoutPhoto.indexOf("article");
        const insertIdx = articleIdx === -1 ? 1 : articleIdx + 1;
        return [
          ...withoutPhoto.slice(0, insertIdx),
          "photo",
          ...withoutPhoto.slice(insertIdx),
        ];
      },
    });
  }, [columnOrderKey]);

  useEffect(() => {
    try {
      const selected = table.getSelectedRowModel().rows.map((r) => r.original) as ProductRow[];
      if (selected.length === 1) dispatch({ type: "setSelectedStoreIds", next: Array.from(new Set((selected[0].linkedStoreIds || []).map(String))) });
    } catch { void 0; }
  }, [state.rowSelection, table]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    dispatch({ type: "setColumnOrder", storageKey: columnOrderKey, next: (prev) => {
      const withoutActions = prev.filter((id) => id !== "actions");
      const fromIndex = withoutActions.indexOf(String(active.id));
      const toIndex = withoutActions.indexOf(String(over.id));
      if (fromIndex === -1 || toIndex === -1) return ensureActionsLast(withoutActions);
      return ensureActionsLast(arrayMove(withoutActions, fromIndex, toIndex));
    } });
  }, [columnOrderKey]);

  const handleRowDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedItems.map((p) => String(p.id));
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    dispatch({ type: "setRowOrder", storageKey: rowOrderKey, next: arrayMove(ids, fromIndex, toIndex) });
  }, [orderedItems, rowOrderKey]);

  const deleteDialogProduct = useMemo(() => (state.deleteDialog.productId ? (orderedItems || []).find((p) => String(p.id) === String(state.deleteDialog.productId)) ?? null : null), [orderedItems, state.deleteDialog.productId]);
  const { handleConfirmDelete } = useProductsDelete({ t, uid, storeId, onDelete, refreshTrigger, queryClient, productsBaseKey, table, setProductsCached, setDeleteProgress, closeDeleteDialog });
  const setStores = useCallback((v: ShopAggregated[]) => {
    queryClient.setQueryData(["user", uid, "shops"], v);
  }, [queryClient, uid]);
  const setStoresMenuOpen = useCallback((v: boolean) => dispatch({ type: "setStoresMenuOpen", next: v }), []);
  const setSelectedStoreIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => dispatch({ type: "setSelectedStoreIds", next: updater }), []);
  const setRemovingStores = useCallback((v: boolean) => dispatch({ type: "setRemovingStores", next: v }), []);
  const setRemovingStoreId = useCallback((v: string | null) => dispatch({ type: "setRemovingStoreId", next: v }), []);
  const setAddingStores = useCallback((v: boolean) => dispatch({ type: "setAddingStores", next: v }), []);
  const setFiltersOpen = useCallback((v: boolean) => dispatch({ type: "setFiltersOpen", next: v }), []);
  const setServerFilters = useCallback(
    (next: any) => dispatch({ type: "setServerFilters", next }),
    [],
  );
  const setViewMode = useCallback((next: ProductsViewMode) => dispatch({ type: "setViewMode", next }), []);
  const onDeleteDialogChange = useCallback((open: boolean) => dispatch({ type: "setDeleteDialog", next: { open, productId: open ? state.deleteDialog.productId : null } }), [state.deleteDialog.productId]);
  const setPagination = useCallback((updater: PaginationState | ((prev: PaginationState) => PaginationState)) => dispatch({ type: "setPagination", next: updater }), []);

  const providerValue = useMemo(
    () => ({
      userId: uid,
      t,
      table,
      storeId,
      onCreateNew,
      onEdit: onEdit as any,
      canCreate,
      suppliersEmpty,
      hideDuplicate,
      loading,
      duplicating: state.copyDialog.open,
      viewMode: state.viewMode,
      setViewMode,
      filtersOpen: state.filtersOpen,
      setFiltersOpen,
      serverFilters: state.serverFilters,
      setServerFilters,
      queryClient,
      items: orderedItems,
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
      orderedItems,
      loadStoresForMenu,
      loading,
      onCreateNew,
      onEdit,
      suppliersEmpty,
      queryClient,
      setViewMode,
      setAddingStores,
      setDeleteDialog,
      setFiltersOpen,
      setServerFilters,
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
      state.filtersOpen,
      state.viewMode,
      state.removingStoreId,
      state.removingStores,
      state.selectedStoreIds,
      state.serverFilters,
      state.storesMenuOpen,
      uid,
    ],
  );
  const enableVirtual = !state.rowReorderEnabled && rows.length > 50 && state.pagination.pageSize >= 20;

  return (
    <ProductsTableProvider value={providerValue}>
      <ProductsTableView
        columns={columns}
        rows={rows}
        pageInfo={pageInfo as PageInfo | null}
        pagination={state.pagination}
        setPagination={setPagination}
        copyDialog={state.copyDialog}
        deleteProgressOpen={state.deleteProgress.open}
        deleteDialog={{ open: state.deleteDialog.open, product: deleteDialogProduct }}
        onDeleteDialogChange={onDeleteDialogChange}
        onConfirmDelete={() => handleConfirmDelete(deleteDialogProduct)}
        sensors={sensors}
        handleDragEnd={handleDragEnd}
        enableVirtual={enableVirtual}
        rowReorderEnabled={state.rowReorderEnabled}
        onToggleRowReorder={toggleRowReorderEnabled}
        onRowDragEnd={handleRowDragEnd}
      />
    </ProductsTableProvider>
  );
};

export default ProductsTable;
