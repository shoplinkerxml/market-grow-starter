import * as React from "react";
import type { Table as TanTable } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { ChevronDown } from "lucide-react";

import type { ProductParam } from "./ParametersDataTable";

export function ParametersTableFooter({
  table,
  t,
}: {
  table: TanTable<ProductParam>;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2" data-testid="parametersDataTable_footer">
      <div className="flex items-center gap-2" data-testid="parametersDataTable_rowsPerPage">
        <div className="text-sm hidden sm:block" data-testid="parametersDataTable_rowsPerPageLabel">
          {t("page_size")}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8" data-testid="parametersDataTable_pageSize">
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
                data-testid={`parametersDataTable_pageSize_${size}`}
              >
                {size}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2" data-testid="parametersDataTable_pagination">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} data-testid="parametersDataTable_prevPage">
          {"<"}
        </Button>
        <span className="text-sm">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
        </span>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} data-testid="parametersDataTable_nextPage">
          {">"}
        </Button>
      </div>
    </div>
  );
}
