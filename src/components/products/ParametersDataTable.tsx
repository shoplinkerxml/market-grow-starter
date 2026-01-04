import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Columns as ColumnsIcon, ChevronDown, Trash2, Pencil, Plus, Upload, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";

// Keep local type consistent with ProductFormTabs
export interface ProductParam {
  id?: string;
  name: string;
  value: string;
  order_index: number;
  paramid?: string;
  valueid?: string;
}

type Props = {
  data: ProductParam[];
  onEditRow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDeleteSelected?: (rowIndexes: number[]) => void;
  onSelectionChange?: (rowIndexes: number[]) => void;
  onAddParam?: () => void;
  onReplaceData?: (rows: ProductParam[]) => void;
};

export function ParametersDataTable({ data, onEditRow, onDeleteRow, onDeleteSelected, onSelectionChange, onAddParam, onReplaceData }: Props) {
  const { t } = useI18n();

  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    select: true,
    paramid: false,
    valueid: false,
    order_index: false,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewRows, setPreviewRows] = React.useState<ProductParam[]>([]);
  const [previewFilename, setPreviewFilename] = React.useState<string>("");

  const columns = React.useMemo<ColumnDef<ProductParam>[]>(() => [
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
            aria-label={t("select_all")}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-start">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t("select_row")}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
    {
      accessorKey: "name",
      header: t("characteristic_name"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "value",
      header: t("value"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.value}</span>,
    },
    {
      accessorKey: "paramid",
      header: t("param_id"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.paramid || ""}</span>,
      enableHiding: true,
    },
    {
      accessorKey: "valueid",
      header: t("value_id"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.valueid || ""}</span>,
      enableHiding: true,
    },
    {
      accessorKey: "order_index",
      header: t("order"),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.order_index}</span>,
      enableHiding: true,
    },
    {
      id: "actions",
      header: t("actions"),
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
              <DropdownMenuItem onClick={() => onEditRow(row.index)} data-testid="parametersDataTable_rowAction_edit">
                <Pencil className="h-4 w-4 mr-2" /> {t("edit_characteristic")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteRow(row.index)} data-testid="parametersDataTable_rowAction_delete">
                <Trash2 className="h-4 w-4 mr-2" /> {t("delete_characteristic")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [onEditRow, onDeleteRow, t]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const selectedIndices = React.useMemo(() => {
    return table
      .getSelectedRowModel()
      .flatRows.map((r) => r.index);
  }, [table]);

  React.useEffect(() => {
    onSelectionChange?.(selectedIndices);
  }, [selectedIndices, onSelectionChange]);

  React.useEffect(() => {
    setRowSelection({});
  }, [data]);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const apply = () => {
      const valueCol = table.getColumn("value");
      const paramCol = table.getColumn("paramid");
      if (mq.matches) {
        valueCol?.toggleVisibility(false);
        paramCol?.toggleVisibility(false);
      } else {
        valueCol?.toggleVisibility(true);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [table]);

  const buildCsv = (rows: ProductParam[]) => {
    const header = ["name","value","paramid","valueid","order_index"].join(",");
    const payload = rows.map(r => [
      JSON.stringify(r.name || ""),
      JSON.stringify(r.value || ""),
      JSON.stringify(r.paramid || ""),
      JSON.stringify(r.valueid || ""),
      String(typeof r.order_index === "number" ? r.order_index : 0)
    ].join(","));
    return [header, ...payload].join("\n");
  };
  const downloadText = (text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const handleExportCsv = () => {
    const csv = buildCsv(data);
    downloadText(csv, "product-params.csv", "text/csv;charset=utf-8");
  };
  const handleExportJson = () => {
    const json = JSON.stringify(data);
    downloadText(json, "product-params.json", "application/json;charset=utf-8");
  };
  const triggerImport = () => {
    fileInputRef.current?.click();
  };
  const openPreview = (rows: ProductParam[], filename: string) => {
    setPreviewRows(rows);
    setPreviewFilename(filename);
    setPreviewOpen(true);
  };
  const confirmReplace = () => {
    if (previewRows.length === 0) {
      setPreviewOpen(false);
      return;
    }
    onReplaceData?.(previewRows);
    setPreviewOpen(false);
  };
  const cancelPreview = () => {
    setPreviewOpen(false);
    setPreviewRows([]);
    setPreviewFilename("");
  };
  const processFile = async (file: File) => {
    const text = await file.text();
    const name = (file.name || "").toLowerCase();
    let rows: ProductParam[] = [];
    if (name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rows = parsed.map((p: unknown, idx: number) => {
            const obj = p as Record<string, unknown>;
            return {
              name: String(obj?.name ?? ""),
              value: String(obj?.value ?? ""),
              paramid: obj?.paramid ? String(obj.paramid as string) : "",
              valueid: obj?.valueid ? String(obj.valueid as string) : "",
              order_index: typeof obj?.order_index === 'number' ? (obj.order_index as number) : idx,
            };
          });
        }
      } catch {
        rows = [];
      }
    } else if (name.endsWith('.csv')) {
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const header = parseCsvRow(lines[0]).map(h => h.toLowerCase());
        const idxName = header.indexOf('name');
        const idxValue = header.indexOf('value');
        const idxParamId = header.indexOf('paramid');
        const idxValueId = header.indexOf('valueid');
        const idxOrder = header.indexOf('order_index');
        if (idxName < 0 || idxValue < 0) {
          toast.error(t('validation_error'));
          return;
        }
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvRow(lines[i]);
          rows.push({
            name: String(cols[idxName] || ""),
            value: String(cols[idxValue] || ""),
            paramid: idxParamId >= 0 ? String(cols[idxParamId] || "") : "",
            valueid: idxValueId >= 0 ? String(cols[idxValueId] || "") : "",
            order_index: idxOrder >= 0 ? Number(cols[idxOrder] || i - 1) || (i - 1) : (i - 1),
          });
        }
      }
    }
    if (rows.length > 0) {
      openPreview(rows, file.name || "import");
    } else {
      toast.error(t('invalid_file_type'));
    }
  };
  const parseCsvRow = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0] || null;
    e.currentTarget.value = "";
    if (!file) return;
    await processFile(file);
  };
  const handleDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!onReplaceData) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };
  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!onReplaceData) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!onReplaceData) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="parametersDataTable_root">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative w-[clamp(12rem,40vw,22rem)] hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
              className="pl-9 h-8 py-1"
              data-testid="parametersDataTable_filter"
            />
          </div>
        </div>
        <div
          className={`flex items-center gap-2 h-9 ${dragActive ? 'ring-2 ring-primary' : ''}`}
          data-testid="parametersDataTable_actions_block"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {onAddParam && (
            <Button
              type="button"
              onClick={onAddParam}
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-transparent"
              data-testid="parametersDataTable_addParam"
              aria-label={t('add_characteristic')}
            >
              <Plus className="h-4 w-4 transition-colors" />
            </Button>
          )}
          {onReplaceData && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={triggerImport}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-transparent"
                    data-testid="parametersDataTable_import"
                    aria-label={t('upload')}
                  >
                    <Download className="h-4 w-4 transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('upload')}</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <DropdownMenuTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-transparent"
                        data-testid="parametersDataTable_export"
                        aria-label={t('export_section')}
                      >
                        <Upload className="h-4 w-4 transition-colors" />
                      </Button>
                    </TooltipTrigger>
                  </DropdownMenuTrigger>
                  <TooltipContent side="bottom">{t('export_section')}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCsv} data-testid="parametersDataTable_export_csv">CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJson} data-testid="parametersDataTable_export_json">JSON</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input ref={fileInputRef} className="hidden" type="file" accept=".csv,.json" onChange={handleFileChange} />
            </>
          )}
          {(() => {
            const canDeleteSelected = selectedIndices.length > 0;
            return (
              <Button
                type="button"
                onClick={() => {
                  if (selectedIndices.length > 0) {
                    onDeleteSelected?.(selectedIndices);
                    table.resetRowSelection();
                  }
                }}
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-transparent"
                disabled={!canDeleteSelected}
                aria-disabled={!canDeleteSelected}
                data-testid="parametersDataTable_deleteSelected"
                aria-label={t('btn_delete_selected')}
              >
                <Trash2 className={`h-4 w-4 transition-colors ${!canDeleteSelected ? 'text-muted-foreground' : ''}`} />
              </Button>
            );
          })()}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent" data-testid="parametersDataTable_viewOptions" aria-label={t('view_options')}>
                <ColumnsIcon className="h-4 w-4 transition-colors" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled className="text-sm">
                {t("toggle_columns")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((column) => column.id !== "select" && column.id !== "actions")
                .map((column) => {
                  const isVisible = column.getIsVisible();
                  const header = column.columnDef.header as string | JSX.Element;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={isVisible}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      data-testid={`parametersDataTable_toggle_${column.id}`}
                    >
                      {header}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent noOverlay>
          <DialogHeader>
            <DialogTitle>{t('tab_preview')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('tab_preview')}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">{previewFilename}</div>
          <div className="max-h-64 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('characteristic_name')}</TableHead>
                  <TableHead>{t('value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.slice(0, 5).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-muted-foreground">{r.name}</TableCell>
                    <TableCell className="text-sm font-medium">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-xs text-muted-foreground mt-2">{previewRows.length} rows</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelPreview}>{t('btn_cancel')}</Button>
            <Button type="button" onClick={confirmReplace}>{t('btn_update')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="overflow-hidden rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={header.column.id === "actions" ? "text-center w-[3.5rem] px-0 pr-2 whitespace-nowrap" : header.column.id === "select" ? "text-left w-[3rem] pl-2 pr-0" : "text-left"}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableCell key={cell.id} className={cell.column.id === "actions" ? "w-[3.5rem] px-0 pr-2 text-center" : cell.column.id === "select" ? "w-[3rem] pl-2 pr-0" : ""}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t("no_results")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: selection status + rows per page + pagination (single row) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2" data-testid="parametersDataTable_footer">
        <div className="flex items-center gap-2" data-testid="parametersDataTable_rowsPerPage">
          <div className="text-sm hidden sm:block" data-testid="parametersDataTable_rowsPerPageLabel">{t("page_size")}</div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            data-testid="parametersDataTable_prevPage"
          >
            {"<"}
          </Button>
          <span className="text-sm">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            data-testid="parametersDataTable_nextPage"
          >
            {">"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ParametersDataTable;
