import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  onValueChange?: (rowIndex: number, value: string, valueid?: string | null) => void;
  onNameChange?: (rowIndex: number, value: string) => void;
}): ColumnDef<ProductParam>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-start">
          <Checkbox
            type="button"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
            aria-label={args.t("select_all")}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-start">
          <Checkbox
            type="button"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
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
      cell: ({ row }) => (
        <Input
          className="h-8 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={row.original.name}
          onChange={(e) => {
            const v = e.target.value;
            args.onNameChange?.(row.index, v);
          }}
        />
      ),
    },
    {
      accessorKey: "value",
      header: args.t("value"),
      cell: ({ row }) => {
        const options = row.original.value_options || [];
        if (options.length === 0) {
          return (
            <Input
              className="h-8 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              value={row.original.value}
              onChange={(e) => {
                const v = e.target.value;
                args.onValueChange?.(row.index, v, null);
              }}
            />
          );
        }
        const currentValue = options.some((o) => o.value === row.original.value)
          ? row.original.value
          : options[0]?.value || "";
        return (
          <Select
            value={currentValue}
            onValueChange={(value) => {
              const selected = options.find((o) => o.value === value);
              args.onValueChange?.(row.index, value, selected?.valueid ?? null);
            }}
          >
            <SelectTrigger className="h-9 w-fit gap-2 pl-3 pr-3 [&>svg]:h-5 [&>svg]:w-5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]">
              {options.map((opt) => (
                <SelectItem key={opt.id} value={opt.value}>
                  {opt.display_value || `${opt.value}${row.original.unit ? ` ${row.original.unit}` : ""}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
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
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-emerald-600" data-testid="parametersDataTable_rowActions">
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
