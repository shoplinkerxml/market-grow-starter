import { useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
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
}) {
  const { t, table, storeId, onCreateNew, canCreate, loading } = useProductsTableContext();
  const tableElRef = useRef<HTMLTableElement | null>(null);
  const rowHeight = 44;
  const { virtualStart, virtualEnd } = useVirtualRows(enableVirtual, table.getRowModel().rows.length, tableElRef, rowHeight);

  if (!loading && (pageInfo?.total ?? rows.length) === 0) {
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

  const virtualTopH = enableVirtual ? virtualStart * rowHeight : 0;
  const allRows = table.getRowModel().rows;
  const slice = enableVirtual ? allRows.slice(virtualStart, virtualEnd) : allRows;
  const virtualBottomH = enableVirtual ? Math.max(0, (allRows.length - virtualEnd) * rowHeight) : 0;

  return (
    <div className="flex flex-col gap-4 bg-background px-4 sm:px-6 py-4" data-testid="user_products_dataTable_root">
      <ToolbarFromContext />
      <div className="bg-background" data-testid="user_products_table">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <Table ref={tableElRef}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => {
                const ids = headerGroup.headers.map((h) => h.column.id).filter((id) => id !== "actions");
                return (
                  <SortableContext key={headerGroup.id} items={ids}>
                    <TableRow>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={header.column.id === "actions" ? "text-center" : "text-left"}
                        >
                          {header.isPlaceholder
                            ? null
                            : header.column.id === "actions"
                              ? flexRender(header.column.columnDef.header, header.getContext())
                              : (
                                  <SortableHeader id={header.column.id}>
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                  </SortableHeader>
                                )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </SortableContext>
                );
              })}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                enableVirtual ? (
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
                        className="hover:bg-muted/50"
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
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-muted/50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
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

      <CopyProgressDialog open={copyDialog.open} name={copyDialog.name} t={t} />
      <DeleteProgressDialog open={deleteProgressOpen} t={t} />

      <DeleteDialog
        open={deleteDialog.open}
        product={deleteDialog.product}
        t={t}
        onOpenChange={onDeleteDialogChange}
        onConfirm={onConfirmDelete}
      />

      <PaginationFooter table={table} pagination={pagination} setPagination={setPagination} pageInfo={pageInfo} rows={rows} />
    </div>
  );
}
