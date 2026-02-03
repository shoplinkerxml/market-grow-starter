import { useCallback, useMemo, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { Package } from "lucide-react";
import { CopyProgressDialog, DeleteDialog, DeleteProgressDialog } from "./Dialogs";
import { PaginationFooter } from "./PaginationFooter";
import { SortableHeader } from "./SortableHeader";
import { ToolbarFromContext } from "./Toolbar";
import { useProductsTableContext } from "./context";
import type { ProductRow } from "./columns";
import type { PaginationState } from "./state";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { ProductsFiltersSheet } from "./ProductsFiltersSheet";
import { SortableProductRow } from "./SortableProductRow";
import { ProductsCardsView } from "./ProductsCardsView";

type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };

export function ProductsTableView({
  columns,
  rows,
  pageInfo,
  pagination,
  setPagination,
  copyDialog,
  deleteProgressOpen,
  deleteDialog,
  onDeleteDialogChange,
  onConfirmDelete,
  sensors,
  handleDragEnd,
  enableVirtual,
  rowReorderEnabled,
  onToggleRowReorder: _onToggleRowReorder,
  onRowDragEnd,
}: {
  columns: ColumnDef<ProductRow>[];
  rows: ProductRow[];
  pageInfo: PageInfo | null;
  pagination: PaginationState;
  setPagination: (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => void;
  copyDialog: { open: boolean; name: string | null };
  deleteProgressOpen: boolean;
  deleteDialog: { open: boolean; product: ProductRow | null };
  onDeleteDialogChange: (open: boolean) => void;
  onConfirmDelete: () => Promise<void> | void;
  sensors: any;
  handleDragEnd: (e: DragEndEvent) => void;
  enableVirtual: boolean;
  rowReorderEnabled: boolean;
  onToggleRowReorder: () => void;
  onRowDragEnd: (e: DragEndEvent) => void;
}) {
  const { t, table, storeId, onCreateNew, canCreate, loading, serverFilters, viewMode } = useProductsTableContext();
  const tableElRef = useRef<HTMLTableElement | null>(null);
  const activeDragTypeRef = useRef<"row" | "column" | null>(null);
  const rowHeight = 72;
  const enableVirtualEffective = enableVirtual && !rowReorderEnabled;
  const { virtualStart, virtualEnd } = useVirtualRows(enableVirtualEffective, table.getRowModel().rows.length, tableElRef, rowHeight);
  const rowIds = useMemo(() => table.getRowModel().rows.map((r) => String((r.original as ProductRow).id)), [table]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
  const columnSortableIds = useMemo(
    () => table.getAllLeafColumns().map((c) => c.id).filter((id) => id !== "actions"),
    [table],
  );
  const columnIdSet = useMemo(() => new Set(columnSortableIds), [columnSortableIds]);

  const handleTableDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      const activeId = String(event.active.id);
      if (rowReorderEnabled && rowIdSet.has(activeId)) {
        activeDragTypeRef.current = "row";
        return;
      }
      if (columnIdSet.has(activeId)) {
        activeDragTypeRef.current = "column";
        return;
      }
      activeDragTypeRef.current = null;
    },
    [columnIdSet, rowIdSet, rowReorderEnabled],
  );

  const handleTableDragCancel = useCallback(() => {
    activeDragTypeRef.current = null;
  }, []);

  const handleTableDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      const type = activeDragTypeRef.current;
      activeDragTypeRef.current = null;
      if (!overId || activeId === overId) return;

      if (type === "row") {
        if (!rowReorderEnabled || !rowIdSet.has(activeId) || !rowIdSet.has(overId)) return;
        onRowDragEnd(event);
        return;
      }

      if (type === "column") {
        if (!columnIdSet.has(activeId) || !columnIdSet.has(overId)) return;
        handleDragEnd(event);
      }
    },
    [columnIdSet, handleDragEnd, onRowDragEnd, rowIdSet, rowReorderEnabled],
  );

  const hasActiveServerFilters =
    serverFilters.priceOrder !== null ||
    serverFilters.supplierIds.length > 0 ||
    serverFilters.categoryIds.length > 0 ||
    serverFilters.storeIds.length > 0 ||
    serverFilters.stockMin !== null ||
    serverFilters.stockMax !== null;

  if (!loading && (pageInfo?.total ?? rows.length) === 0 && !hasActiveServerFilters) {
    return (
      <div className="p-6 bg-background flex justify-center" data-testid="user_products_empty_wrap">
        <div className="w-full max-w-[clamp(18rem,50vw,32rem)]">
          <Empty>
            <EmptyHeader>
              <EmptyMedia className="text-primary">
                <Package className="h-[1.5rem] w-[1.5rem]" />
              </EmptyMedia>
              <EmptyTitle>{t("no_products")}</EmptyTitle>
              <EmptyDescription>{t("no_products_description")}</EmptyDescription>
            </EmptyHeader>
            {storeId ? null : (
              <Button
                onClick={onCreateNew}
                className="mt-4"
                data-testid="user_products_create_btn"
                disabled={canCreate === false}
                aria-disabled={canCreate === false}
              >
                {t("create_product")}
              </Button>
            )}
          </Empty>
        </div>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return <FullPageLoader title={t("products_title")} subtitle={t("products_description")} icon={Package} />;
  }

  const virtualTopH = enableVirtualEffective ? virtualStart * rowHeight : 0;
  const allRows = table.getRowModel().rows;
  const slice = enableVirtualEffective ? allRows.slice(virtualStart, virtualEnd) : allRows;
  const virtualBottomH = enableVirtualEffective ? Math.max(0, (allRows.length - virtualEnd) * rowHeight) : 0;

  return (
    <div className="flex flex-col gap-4 bg-background px-4 sm:px-6 py-4 h-full min-h-0" data-testid="user_products_dataTable_root">
      <ToolbarFromContext />
      {viewMode === "cards" ? (
        <div className="bg-background flex-1 min-h-0 overflow-y-auto" data-testid="user_products_cards_wrap">
          <ProductsCardsView />
        </div>
      ) : (
        <div className="bg-background flex-1 min-h-0 overflow-hidden" data-testid="user_products_table">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[
              (args) => (activeDragTypeRef.current === "row" ? restrictToVerticalAxis(args) : args.transform),
            ]}
            onDragStart={handleTableDragStart as any}
            onDragCancel={handleTableDragCancel}
            onDragEnd={handleTableDragEnd}
          >
            <Table ref={tableElRef} wrapperClassName="h-full overflow-y-auto">
              <TableHeader className="sticky top-0 z-30 bg-background">
                {table.getHeaderGroups().map((headerGroup) => {
                  const ids = headerGroup.headers.map((h) => h.column.id).filter((id) => id !== "actions");
                  return (
                    <SortableContext key={headerGroup.id} items={ids}>
                      <TableRow>
                        {headerGroup.headers.map((header) => {
                          const isCentered = header.column.id === "actions" || header.column.id === "stores";
                          return (
                            <TableHead
                              key={header.id}
                              className={isCentered ? "text-center" : "text-left"}
                            >
                              {header.isPlaceholder
                                ? null
                                : header.column.id === "actions"
                                  ? flexRender(header.column.columnDef.header, header.getContext())
                                  : (
                                      <div className={header.column.id === "stores" ? "flex w-full items-center justify-center" : ""}>
                                        <SortableHeader id={header.column.id}>
                                          <div className="inline-flex items-center gap-2">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                          </div>
                                        </SortableHeader>
                                      </div>
                                    )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </SortableContext>
                  );
                })}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  enableVirtualEffective ? (
                    <>
                      {virtualTopH > 0 ? (
                        <TableRow style={{ height: virtualTopH }}>
                          <TableCell colSpan={columns.length} />
                        </TableRow>
                      ) : null}
                      {slice.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                          className="hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          style={{ height: rowHeight }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {virtualBottomH > 0 ? (
                        <TableRow style={{ height: virtualBottomH }}>
                          <TableCell colSpan={columns.length} />
                        </TableRow>
                      ) : null}
                    </>
                  ) : (
                    <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                      {table.getRowModel().rows.map((row) => (
                        <SortableProductRow
                          key={row.id}
                          row={row}
                          columnsLength={columns.length}
                          rowHeight={rowHeight}
                          rowReorderEnabled={rowReorderEnabled}
                        />
                      ))}
                    </SortableContext>
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {t("no_results")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      )}

      <CopyProgressDialog open={copyDialog.open} name={copyDialog.name} t={t} />
      <DeleteProgressDialog open={deleteProgressOpen} t={t} />

      <ProductsFiltersSheet />

      <DeleteDialog
        open={deleteDialog.open}
        product={deleteDialog.product}
        t={t}
        onOpenChange={onDeleteDialogChange}
        onConfirm={onConfirmDelete}
      />

      {viewMode === "table" ? (
        <PaginationFooter table={table} pagination={pagination} setPagination={setPagination} pageInfo={pageInfo} rows={rows} />
      ) : null}
    </div>
  );
}
