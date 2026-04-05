import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Copy, Edit, Trash2, Loader2, Sliders, LayoutGrid, List } from "lucide-react";
import type { Product } from "@/lib/product-service";
import type { QueryClient } from "@tanstack/react-query";
import type { Table as TanTable } from "@tanstack/react-table";
import type { ProductRow } from "./columns";
import type { ShopAggregated } from "@/lib/shop-service";
import { useSyncStatus } from "@/lib/optimistic-mutation";
import { useProductsTableContext } from "./context";
import type { ProductsViewMode } from "./state";
import { Separator } from "@/components/ui/separator";

const ViewOptionsMenuLazy = React.lazy(() => import("./ViewOptionsMenu").then((m) => ({ default: m.ViewOptionsMenu })));
const AddToStoresMenuLazy = React.lazy(() => import("./AddToStoresMenu").then((m) => ({ default: m.AddToStoresMenu })));
const ImportExportMenuLazy = React.lazy(() => import("./ImportExportMenu").then((m) => ({ default: m.ImportExportMenu })));
type TTable = TanTable<ProductRow>;
const ViewOptionsMenuLazyTyped = ViewOptionsMenuLazy as unknown as React.ComponentType<{ table: TTable; disabled?: boolean }>;
const AddToStoresMenuLazyTyped = AddToStoresMenuLazy as unknown as React.ComponentType<{ open: boolean; setOpen: (v: boolean) => void; loadStoresForMenu: () => Promise<void>; stores: ShopAggregated[]; setStores: (v: ShopAggregated[]) => void; selectedStoreIds: string[]; setSelectedStoreIds: React.Dispatch<React.SetStateAction<string[]>>; items: ProductRow[]; table: TTable; removingStores: boolean; setRemovingStores: (v: boolean) => void; removingStoreId: string | null; setRemovingStoreId: (v: string | null) => void; queryClient: QueryClient; addingStores: boolean; setAddingStores: (v: boolean) => void; setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void; setLastSelectedProductIds?: (ids: string[]) => void; disabled?: boolean }>;
const ImportExportMenuLazyTyped = ImportExportMenuLazy as unknown as React.ComponentType<{ t: (k: string) => string; storeId?: string; queryClient: QueryClient; selectedProducts?: ProductRow[]; disabled?: boolean }>;

export function Toolbar({
  t,
  table,
  storeId,
  onCreateNew,
  onEdit,
  canCreate,
  suppliersEmpty,
  hideDuplicate,
  viewMode,
  setViewMode,
  onOpenFilters,
  setDeleteDialog,
  handleDuplicate,
  duplicating,
  storesMenuOpen,
  setStoresMenuOpen,
  loadStoresForMenu,
  stores,
  setStores,
  selectedStoreIds,
  setSelectedStoreIds,
  items,
  removingStores,
  setRemovingStores,
  removingStoreId,
  setRemovingStoreId,
  queryClient,
  addingStores,
  setAddingStores,
  setProductsCached,
  setLastSelectedProductIds,
  loading,
}: {
  t: (k: string) => string;
  table: TTable;
  storeId?: string;
  onCreateNew?: () => void;
  onEdit?: (p: ProductRow) => void;
  canCreate?: boolean;
  suppliersEmpty?: boolean;
  hideDuplicate?: boolean;
  viewMode: ProductsViewMode;
  setViewMode: (next: ProductsViewMode) => void;
  onOpenFilters: () => void;
  setDeleteDialog: (v: { open: boolean; product: ProductRow | null }) => void;
  handleDuplicate: (p: Product) => Promise<void>;
  duplicating?: boolean;
  storesMenuOpen: boolean;
  setStoresMenuOpen: (v: boolean) => void;
  loadStoresForMenu: () => Promise<void>;
  stores: ShopAggregated[];
  setStores: (v: ShopAggregated[]) => void;
  selectedStoreIds: string[];
  setSelectedStoreIds: React.Dispatch<React.SetStateAction<string[]>>;
  items: ProductRow[];
  removingStores: boolean;
  setRemovingStores: (v: boolean) => void;
  removingStoreId: string | null;
  setRemovingStoreId: (v: string | null) => void;
  queryClient: QueryClient;
  addingStores: boolean;
  setAddingStores: (v: boolean) => void;
  setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void;
  setLastSelectedProductIds?: (ids: string[]) => void;
  loading?: boolean;
}) {
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const selectedRow = selectedRows[0]?.original as ProductRow | undefined;
  const selectedProducts = selectedRows.map((r) => r.original).filter(Boolean) as ProductRow[];
  const duplicationStatus = useSyncStatus(selectedRow ? `product:duplicate:${selectedRow.id}` : null);
  const isDupPending = duplicationStatus?.status === "pending";
  const isDupError = duplicationStatus?.status === "error";
  const canDuplicate = selectedCount === 1 && canCreate !== false && hideDuplicate !== true && !duplicating && !isDupPending;
  const canEditSelected = selectedCount === 1 && !duplicating && selectedRow?.is_active !== false;
  const canDeleteSelected = selectedCount >= 1 && !duplicating;
  const createDisabled = (canCreate === false) || suppliersEmpty === true || !!duplicating;
  const iconButtonCls = "h-8 w-8 hover:bg-transparent";
  const controlsDisabled = !!loading || !!duplicating;
  const viewToggleLabel = viewMode === "table" ? t("view_cards") : t("view_table");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 h-9 justify-end" data-testid="user_products_actions_block">
        {/* View controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonCls}
              aria-label={t("filter")}
              disabled={controlsDisabled}
              data-testid="user_products_filter_button"
              onClick={() => { if (!controlsDisabled) onOpenFilters(); }}
            >
              <Sliders className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("filter")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonCls}
              aria-label={viewToggleLabel}
              disabled={controlsDisabled}
              data-testid="user_products_view_toggle_button"
              onClick={() => { if (!controlsDisabled) setViewMode(viewMode === "table" ? "cards" : "table"); }}
            >
              {viewMode === "table" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{viewToggleLabel}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* CRUD actions */}
        {storeId ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={iconButtonCls}
                onClick={onCreateNew}
                aria-label={t("add_product")}
                disabled={createDisabled || !!loading}
                data-testid="user_products_dataTable_createNew"
              >
                <Plus className={`h-4 w-4 transition-colors ${(createDisabled || !!loading) ? "text-muted-foreground" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("add_product")}</TooltipContent>
          </Tooltip>
        )}

        {hideDuplicate ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={iconButtonCls}
                onClick={async () => {
                  if (controlsDisabled || !selectedRow) return;
                  await handleDuplicate(selectedRow);
                  table.resetRowSelection();
                  setLastSelectedProductIds?.([]);
                }}
                aria-label={t("duplicate")}
                disabled={!canDuplicate || controlsDisabled}
                data-testid="user_products_dataTable_duplicateSelected"
              >
                {isDupPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className={`h-4 w-4 transition-colors ${(!canDuplicate || controlsDisabled) ? "text-muted-foreground" : isDupError ? "text-destructive" : ""}`} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("duplicate")}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonCls}
              onClick={() => selectedRow && setDeleteDialog({ open: true, product: selectedCount === 1 ? selectedRow : null })}
              aria-label={selectedCount > 1 ? t("delete_selected") : t("delete")}
              disabled={!canDeleteSelected || controlsDisabled}
              data-testid="user_products_dataTable_clearSelection"
            >
              <Trash2 className={`h-4 w-4 transition-colors ${(!canDeleteSelected || controlsDisabled) ? "text-muted-foreground" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{selectedCount > 1 ? t("delete_selected") : t("delete")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonCls}
              onClick={() => selectedRow && onEdit?.(selectedRow)}
              aria-label={t("edit")}
              disabled={!canEditSelected || controlsDisabled}
              data-testid="user_products_dataTable_editSelected"
            >
              <Edit className={`h-4 w-4 transition-colors ${(!canEditSelected || controlsDisabled) ? "text-muted-foreground" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("edit")}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* Tools */}
        <React.Suspense fallback={null}>
          <ViewOptionsMenuLazyTyped table={table} disabled={controlsDisabled} />
        </React.Suspense>

        <React.Suspense fallback={null}>
          <ImportExportMenuLazyTyped
            t={t}
            storeId={storeId}
            queryClient={queryClient}
            selectedProducts={selectedProducts}
            disabled={controlsDisabled}
          />
        </React.Suspense>

        {storeId ? null : (
          <React.Suspense fallback={null}>
            <AddToStoresMenuLazyTyped
              open={storesMenuOpen}
              setOpen={setStoresMenuOpen}
              loadStoresForMenu={loadStoresForMenu}
              stores={stores}
              setStores={setStores}
              selectedStoreIds={selectedStoreIds}
              setSelectedStoreIds={setSelectedStoreIds}
              items={items}
              table={table}
              removingStores={removingStores}
              setRemovingStores={setRemovingStores}
              removingStoreId={removingStoreId}
              setRemovingStoreId={setRemovingStoreId}
              queryClient={queryClient}
              addingStores={addingStores}
              setAddingStores={setAddingStores}
              setProductsCached={setProductsCached}
              setLastSelectedProductIds={setLastSelectedProductIds}
              disabled={controlsDisabled}
            />
          </React.Suspense>
        )}
      </div>
    </TooltipProvider>
  );
}

export function ToolbarFromContext() {
  const {
    t,
    table,
    storeId,
    onCreateNew,
    onEdit,
    canCreate,
    suppliersEmpty,
    hideDuplicate,
    viewMode,
    setViewMode,
    filtersOpen: _,
    setFiltersOpen,
    setDeleteDialog,
    handleDuplicate,
    duplicating,
    storesMenuOpen,
    setStoresMenuOpen,
    loadStoresForMenu,
    stores,
    setStores,
    selectedStoreIds,
    setSelectedStoreIds,
    items,
    removingStores,
    setRemovingStores,
    removingStoreId,
    setRemovingStoreId,
    queryClient,
    addingStores,
    setAddingStores,
    setProductsCached,
    loading,
  } = useProductsTableContext();

  return (
    <Toolbar
      t={t}
      table={table}
      storeId={storeId}
      onCreateNew={onCreateNew}
      onEdit={onEdit}
      canCreate={canCreate}
      suppliersEmpty={suppliersEmpty}
      hideDuplicate={hideDuplicate}
      viewMode={viewMode}
      setViewMode={setViewMode}
      onOpenFilters={() => setFiltersOpen(true)}
      setDeleteDialog={setDeleteDialog}
      handleDuplicate={handleDuplicate}
      duplicating={duplicating}
      storesMenuOpen={storesMenuOpen}
      setStoresMenuOpen={setStoresMenuOpen}
      loadStoresForMenu={loadStoresForMenu}
      stores={stores}
      setStores={setStores}
      selectedStoreIds={selectedStoreIds}
      setSelectedStoreIds={setSelectedStoreIds}
      items={items}
      removingStores={removingStores}
      setRemovingStores={setRemovingStores}
      removingStoreId={removingStoreId}
      setRemovingStoreId={setRemovingStoreId}
      queryClient={queryClient}
      addingStores={addingStores}
      setAddingStores={setAddingStores}
      setProductsCached={setProductsCached}
      loading={loading}
    />
  );
}
