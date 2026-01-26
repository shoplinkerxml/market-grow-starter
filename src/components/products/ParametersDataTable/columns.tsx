import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { ProductParam } from "./ParametersDataTable";

export function createParametersColumns(args: {
  t: (k: string) => string;
  onEditRow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
}): ColumnDef<ProductParam>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-start">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onTouchStart={(event) => {
              event.stopPropagation();
            }}
            aria-label={args.t("select_all")}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-start">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onTouchStart={(event) => {
              event.stopPropagation();
            }}
            aria-label={args.t("select_row")}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
    {
      accessorKey: "name",
      header: args.t("characteristic_name"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "value",
      header: args.t("value"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.value}</span>,
    },
    {
      accessorKey: "paramid",
      header: args.t("param_id"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.paramid || ""}</span>,
      enableHiding: true,
    },
    {
      accessorKey: "valueid",
      header: args.t("value_id"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.valueid || ""}</span>,
      enableHiding: true,
    },
    {
      accessorKey: "order_index",
      header: args.t("order"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.order_index}</span>,
      enableHiding: true,
    },
    {
      id: "actions",
      header: args.t("actions"),
      enableSorting: false,
      enableHiding: false,
      size: 56,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent" data-testid="parametersDataTable_rowActions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => args.onEditRow(row.index)} data-testid="parametersDataTable_rowAction_edit">
                <Pencil className="h-4 w-4 mr-2" /> {args.t("edit_characteristic")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => args.onDeleteRow(row.index)} data-testid="parametersDataTable_rowAction_delete">
                <Trash2 className="h-4 w-4 mr-2" /> {args.t("delete_characteristic")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
