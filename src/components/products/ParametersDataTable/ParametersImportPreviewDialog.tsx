import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { File } from "lucide-react";

import type { ProductParam } from "./ParametersDataTable";

export const ParametersImportPreviewDialog = React.memo(function ParametersImportPreviewDialog({
  open,
  onOpenChange,
  filename,
  rowsCount,
  sampleRows,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  rowsCount: number;
  sampleRows: ProductParam[];
  onCancel: () => void;
  onConfirm: () => void;
  t: (k: string) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent noOverlay>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="h-4 w-4 text-muted-foreground" />
            {t("tab_preview")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("tab_preview")}</DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">{filename}</div>
        <div className="max-h-64 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("characteristic_name")}</TableHead>
                <TableHead>{t("value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm text-muted-foreground">{r.name}</TableCell>
                  <TableCell className="text-sm font-medium">{r.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-xs text-muted-foreground mt-2">{rowsCount} rows</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("btn_cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t("btn_update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
