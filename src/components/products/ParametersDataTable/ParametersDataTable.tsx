import * as React from "react";
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useI18n } from "@/i18n";

import { exportParams, readParamsFromFile } from "./importExport";
import { createParametersColumns } from "./columns";
import { ParametersImportPreviewDialog, ParametersTableFooter, ParametersTableToolbar, ParametersTableView } from "./ui";

export interface ProductParam {
  id?: string;
  name: string;
  value: string;
  order_index: number;
  paramid?: string;
  valueid?: string;
  template_attribute_id?: number;
  attribute_type?: string;
  value_options?: Array<{
    id: number;
    value: string;
    valueid?: string | null;
    display_value?: string | null;
    value_lang?: Record<string, string> | null;
  }>;
}

type Props = {
  data: ProductParam[];
  onEditRow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDeleteSelected?: (rowIndexes: number[]) => void;
  onSelectionChange?: (rowIndexes: number[]) => void;
  onAddParam?: () => void;
  toolbarLeft?: React.ReactNode;
  onReplaceData?: (rows: ProductParam[]) => void;
  onValueChange?: (rowIndex: number, value: string, valueid?: string | null) => void;
  onNameChange?: (rowIndex: number, value: string) => void;
};

export function ParametersDataTable({
  data,
  onEditRow,
  onDeleteRow,
  onDeleteSelected,
  onSelectionChange,
  onAddParam,
  toolbarLeft,
  onReplaceData,
  onValueChange,
  onNameChange,
}: Props) {
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

  const previewRowsRef = React.useRef<ProductParam[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewSampleRows, setPreviewSampleRows] = React.useState<ProductParam[]>([]);
  const [previewCount, setPreviewCount] = React.useState(0);
  const [previewFilename, setPreviewFilename] = React.useState<string>("");

  const columns = React.useMemo(() => {
    return createParametersColumns({ t, onEditRow, onDeleteRow, onValueChange, onNameChange });
  }, [t, onEditRow, onDeleteRow, onNameChange, onValueChange]);

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
    autoResetPageIndex: false,
  });

  const selectedIndices = table
    .getSelectedRowModel()
    .rows.map((row) => row.index)
    .filter((idx) => Number.isFinite(idx));

  React.useEffect(() => {
    onSelectionChange?.(selectedIndices);
  }, [selectedIndices, onSelectionChange]);

  const dataLength = data.length;
  React.useEffect(() => {
    setRowSelection({});
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [dataLength]);

  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [columnFilters, sorting]);

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

  const handleExport = React.useCallback(
    async (format: "csv" | "json" | "xlsx") => {
      await exportParams({ data, format });
    },
    [data],
  );

  const handleExportCsv = React.useCallback(() => void handleExport("csv"), [handleExport]);
  const handleExportJson = React.useCallback(() => void handleExport("json"), [handleExport]);
  const handleExportXlsx = React.useCallback(() => void handleExport("xlsx"), [handleExport]);

  const triggerImport = React.useCallback((accept: string) => {
    const el = fileInputRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  }, []);

  const openPreview = React.useCallback((rows: ProductParam[], filename: string) => {
    previewRowsRef.current = rows;
    setPreviewSampleRows(rows.slice(0, 5));
    setPreviewCount(rows.length);
    setPreviewFilename(filename);
    setPreviewOpen(true);
  }, []);

  const confirmReplace = React.useCallback(() => {
    const rows = previewRowsRef.current;
    if (!rows || rows.length === 0) {
      setPreviewOpen(false);
      return;
    }
    onReplaceData?.(rows);
    setPreviewOpen(false);
  }, [onReplaceData]);

  const cancelPreview = React.useCallback(() => {
    setPreviewOpen(false);
    setPreviewSampleRows([]);
    setPreviewCount(0);
    setPreviewFilename("");
    previewRowsRef.current = [];
  }, []);

  const processFile = React.useCallback(
    async (file: File) => {
      const rows = await readParamsFromFile({ file, t });
      if (rows.length > 0) {
        openPreview(rows, file.name || "import");
      }
    },
    [openPreview, t],
  );

  const handleFileChange = React.useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const file = e.target.files?.[0] || null;
      e.currentTarget.value = "";
      if (!file) return;
      void processFile(file);
    },
    [processFile],
  );

  const handleDrop = React.useCallback<React.DragEventHandler<HTMLDivElement>>(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (!onReplaceData) return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      void processFile(file);
    },
    [onReplaceData, processFile],
  );

  const handleDragOver = React.useCallback<React.DragEventHandler<HTMLDivElement>>(
    (e) => {
      if (!onReplaceData) return;
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    },
    [onReplaceData],
  );

  const handleDragLeave = React.useCallback<React.DragEventHandler<HTMLDivElement>>(
    (e) => {
      if (!onReplaceData) return;
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    },
    [onReplaceData],
  );

  const handleDeleteSelected = React.useCallback(() => {
    if (!onDeleteSelected) return;
    if (selectedIndices.length === 0) return;
    onDeleteSelected(selectedIndices);
    table.resetRowSelection();
  }, [onDeleteSelected, selectedIndices, table]);

  const triggerImportXlsx = React.useCallback(() => triggerImport(".xlsx"), [triggerImport]);
  const triggerImportCsv = React.useCallback(() => triggerImport(".csv"), [triggerImport]);
  const triggerImportJson = React.useCallback(() => triggerImport(".json,.jsonl,.ndjson"), [triggerImport]);

  const canDeleteSelected = selectedIndices.length > 0;
  const visibleColumnsCount = table.getVisibleLeafColumns().length;

  return (
    <div className="flex flex-col gap-3" data-testid="parametersDataTable_root">
      <ParametersTableToolbar
        table={table}
        t={t}
        dragActive={dragActive}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        leftContent={toolbarLeft}
        canDeleteSelected={canDeleteSelected}
        onDeleteSelected={handleDeleteSelected}
        onAddParam={onAddParam}
        onTriggerImportXlsx={onReplaceData ? triggerImportXlsx : undefined}
        onTriggerImportCsv={onReplaceData ? triggerImportCsv : undefined}
        onTriggerImportJson={onReplaceData ? triggerImportJson : undefined}
        onExportXlsx={onReplaceData ? handleExportXlsx : undefined}
        onExportCsv={onReplaceData ? handleExportCsv : undefined}
        onExportJson={onReplaceData ? handleExportJson : undefined}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
      />

      <ParametersImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        filename={previewFilename}
        rowsCount={previewCount}
        sampleRows={previewSampleRows}
        onCancel={cancelPreview}
        onConfirm={confirmReplace}
        t={t}
      />

      <ParametersTableView table={table} visibleColumnsCount={visibleColumnsCount} t={t} />
      <ParametersTableFooter table={table} t={t} />
    </div>
  );
}

export default ParametersDataTable;
