import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { List, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";

type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };

export function PaginationFooter<TData>({
  table,
  pagination,
  setPagination,
  pageInfo,
  rows,
}: {
  table: import("@tanstack/react-table").Table<TData>;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: (updater: (prev: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number }) => void;
  pageInfo: PageInfo | null;
  rows: TData[];
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2 border-t" data-testid="user_products_dataTable_pagination">
      <div className="text-xs text-muted-foreground" data-testid="user_products_dataTable_selectionStatus">
        {(() => {
          const selected = table.getSelectedRowModel().rows.length;
          const total = table.getFilteredRowModel().rows.length || 0;
          return t("rows_selected") === "Вибрано"
            ? `Вибрано ${selected} з ${total} рядків.`
            : `${selected} of ${total} row(s) selected.`;
        })()}
      </div>

      <div className="flex items-center gap-2" data-testid="user_products_dataTable_rowsPerPage">
        <div className="text-sm" data-testid="user_products_dataTable_rowsPerPageLabel">{t("page_size")}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2" aria-label={t("page_size")} data-testid="user_products_dataTable_pageSize">
              <List className="h-4 w-4 mr-2" />
              {table.getState().pagination.pageSize}
              <ChevronDown className="ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {[5, 10, 20, 50].map((size) => (
              <DropdownMenuCheckboxItem
                key={size}
                checked={table.getState().pagination.pageSize === size}
                onCheckedChange={() => table.setPageSize(size)}
                data-testid={`user_products_dataTable_pageSize_${size}`}
              >
                {size}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2" data-testid="user_products_dataTable_pageControls">
        <div className="text-sm whitespace-nowrap" data-testid="user_products_dataTable_pageIndicator">
          {t("page_of")} {pagination.pageIndex + 1} {t("page_of_connector")} {Math.max(1, Math.ceil(((pageInfo?.total ?? rows.length) / pagination.pageSize)))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: 0 }))} disabled={pagination.pageIndex === 0} aria-label={t("first_page")} data-testid="user_products_dataTable_firstPage">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))} disabled={pagination.pageIndex === 0} aria-label={t("previous_page")} data-testid="user_products_dataTable_prevPage">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))} disabled={(pagination.pageIndex + 1) >= Math.max(1, Math.ceil(((pageInfo?.total ?? rows.length) / pagination.pageSize)))} aria-label={t("next_page")} data-testid="user_products_dataTable_nextPage">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, Math.max(1, Math.ceil(((pageInfo?.total ?? rows.length) / pagination.pageSize))) - 1) }))} disabled={(pagination.pageIndex + 1) >= Math.max(1, Math.ceil(((pageInfo?.total ?? rows.length) / pagination.pageSize)))} aria-label={t("last_page")} data-testid="user_products_dataTable_lastPage">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-4 text-xs text-muted-foreground" data-testid="user_products_dataTable_rangeIndicator">
          {(() => {
            const total = pageInfo?.total ?? rows.length;
            const start = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
            const end = Math.min(total, start + pagination.pageSize - 1);
            return t("rows_selected") === "Вибрано"
              ? `Показано ${start}-${end} із ${total}`
              : `Showing ${start}-${end} of ${total}`;
          })()}
        </div>
      </div>
    </div>
  );
}
