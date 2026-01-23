import * as React from "react";
import { flexRender, type Table as TanTable } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { ProductParam } from "./ParametersDataTable";

export const ParametersTableView = React.memo(function ParametersTableView({
  table,
  visibleColumnsCount,
  t,
}: {
  table: TanTable<ProductParam>;
  visibleColumnsCount: number;
  t: (k: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={
                    header.column.id === "actions"
                      ? "text-center w-[3.5rem] px-0 pr-2 whitespace-nowrap"
                      : header.column.id === "select"
                        ? "text-left w-[3rem] pl-2 pr-0"
                        : "text-left"
                  }
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-testid={`parametersDataTable_row_${row.index}`}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === "actions"
                        ? "w-[3.5rem] px-0 pr-2 text-center"
                        : cell.column.id === "select"
                          ? "w-[3rem] pl-2 pr-0"
                          : ""
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={visibleColumnsCount} className="h-24 text-center">
                {t("no_results")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});
