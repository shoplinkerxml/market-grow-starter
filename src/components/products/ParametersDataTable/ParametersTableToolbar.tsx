import * as React from "react";
import type { Table as TanTable } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  ArrowLeftRight,
  Columns as ColumnsIcon,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import type { ProductParam } from "./ParametersDataTable";

export const ParametersTableToolbar = React.memo(function ParametersTableToolbar({
  table,
  t,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop,
  leftContent,
  canDeleteSelected,
  onDeleteSelected,
  onAddParam,
  onTriggerImportXlsx,
  onTriggerImportCsv,
  onTriggerImportJson,
  onExportXlsx,
  onExportCsv,
  onExportJson,
  fileInputRef,
  onFileChange,
}: {
  table: TanTable<ProductParam>;
  t: (k: string) => string;
  dragActive: boolean;
  onDragOver: React.DragEventHandler<HTMLDivElement>;
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
  onDrop: React.DragEventHandler<HTMLDivElement>;
  leftContent?: React.ReactNode;
  canDeleteSelected: boolean;
  onDeleteSelected: () => void;
  onAddParam?: (() => void) | undefined;
  onTriggerImportXlsx?: (() => void) | undefined;
  onTriggerImportCsv?: (() => void) | undefined;
  onTriggerImportJson?: (() => void) | undefined;
  onExportXlsx?: (() => void) | undefined;
  onExportCsv?: (() => void) | undefined;
  onExportJson?: (() => void) | undefined;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">{leftContent}</div>
      <div
        className={`flex items-center gap-2 h-9 ${dragActive ? "ring-2 ring-primary" : ""}`}
        data-testid="parametersDataTable_actions_block"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
      {onAddParam && (
        <Button
          type="button"
          onClick={onAddParam}
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-transparent"
          data-testid="parametersDataTable_addParam"
          aria-label={t("add_characteristic")}
        >
          <Plus className="h-4 w-4 transition-colors" />
        </Button>
      )}

        {onTriggerImportXlsx && onTriggerImportCsv && onTriggerImportJson && onExportXlsx && onExportCsv && onExportJson && (
          <>
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-transparent"
                      data-testid="parametersDataTable_importExport"
                      aria-label={`Импорт / ${t("export_section")}`}
                    >
                      <ArrowLeftRight className="h-4 w-4 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent side="bottom">{`Импорт / ${t("export_section")}`}</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    data-testid="parametersDataTable_import_sub"
                    className="flex-row-reverse justify-end [&>svg:last-child]:ml-0 [&>svg:last-child]:mr-2 [&>svg:first-child]:mr-0 [&>svg:first-child]:ml-2"
                  >
                    <Upload className="h-4 w-4" />
                    Импорт
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={onTriggerImportXlsx} data-testid="parametersDataTable_import_xlsx">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      xlsx
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onTriggerImportCsv} data-testid="parametersDataTable_import_csv">
                      <FileText className="h-4 w-4 mr-2" />
                      csv
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onTriggerImportJson} data-testid="parametersDataTable_import_json">
                      <File className="h-4 w-4 mr-2" />
                      json
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    data-testid="parametersDataTable_export_sub"
                    className="flex-row-reverse justify-end [&>svg:last-child]:ml-0 [&>svg:last-child]:mr-2 [&>svg:first-child]:mr-0 [&>svg:first-child]:ml-2"
                  >
                    <Download className="h-4 w-4" />
                    {t("export_section")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={onExportXlsx} data-testid="parametersDataTable_export_xlsx">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      xlsx
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportCsv} data-testid="parametersDataTable_export_csv">
                      <FileText className="h-4 w-4 mr-2" />
                      csv
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportJson} data-testid="parametersDataTable_export_json">
                      <File className="h-4 w-4 mr-2" />
                      json
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".xlsx,.csv,.json,.jsonl,.ndjson"
              onChange={onFileChange}
            />
          </>
        )}

        <Button
          type="button"
          onClick={onDeleteSelected}
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-transparent"
          disabled={!canDeleteSelected}
          aria-disabled={!canDeleteSelected}
          data-testid="parametersDataTable_deleteSelected"
          aria-label={t("btn_delete_selected")}
        >
          <Trash2 className={`h-4 w-4 transition-colors ${!canDeleteSelected ? "text-muted-foreground" : ""}`} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-transparent"
              data-testid="parametersDataTable_viewOptions"
              aria-label={t("view_options")}
            >
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
  );
});
