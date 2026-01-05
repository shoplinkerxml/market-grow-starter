import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, File, FileSpreadsheet, FileText, Upload } from "lucide-react";
import type { ProductRow } from "./columns";

import { ExportProgressDialog, ImportUpdateProgressDialog } from "./Dialogs";
import { ProductService, type ProductAggregated } from "@/lib/product-service";
import { exportProducts } from "./ImportExport/exporting";
import { downloadBlob, downloadText } from "./ImportExport/file";
import { PRODUCTS_SHEET_NAME } from "./ImportExport/constants";
import { importProducts, readImportFile, validateImportRows } from "./ImportExport/importing";
import { supabase } from "@/integrations/supabase/client";

export function ImportExportMenu({
  t,
  storeId,
  queryClient,
  selectedProducts,
  disabled,
}: {
  t: (k: string) => string;
  storeId?: string;
  queryClient: QueryClient;
  selectedProducts?: ProductRow[];
  disabled?: boolean;
}) {
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const exportingRef = useRef(false);
  const importingRef = useRef(false);

  const [exportProgressOpen, setExportProgressOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportTitle, setExportTitle] = useState<string>("");
  const exportProgressTimerRef = useRef<number | null>(null);

  const exportDescription = useMemo(() => {
    return t("import_export_export_hint");
  }, [t]);

  useEffect(() => {
    if (!exportProgressOpen) return;
    if (exportProgressTimerRef.current != null) globalThis.clearInterval(exportProgressTimerRef.current);
    exportProgressTimerRef.current = globalThis.setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 90) return prev;
        const next = prev + Math.max(1, Math.round((90 - prev) * 0.08));
        return Math.min(90, next);
      });
    }, 250) as unknown as number;

    return () => {
      if (exportProgressTimerRef.current != null) globalThis.clearInterval(exportProgressTimerRef.current);
      exportProgressTimerRef.current = null;
    };
  }, [exportProgressOpen]);

  const closeExportProgress = useCallback(() => {
    setExportProgress(100);
    globalThis.setTimeout(() => {
      setExportProgressOpen(false);
      setExportProgress(0);
      setExportTitle("");
    }, 650);
  }, []);

  const [importProgressOpen, setImportProgressOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTitle, setImportTitle] = useState<string>("");
  const [importStatus, setImportStatus] = useState<"running" | "done" | "error">("running");
  const [importSummary, setImportSummary] = useState<{ updated: number; skipped: number; errors: number } | null>(null);
  const importProgressChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      const ch = importProgressChannelRef.current;
      if (ch) {
        importProgressChannelRef.current = null;
        supabase.removeChannel(ch).catch(() => void 0);
      }
    };
  }, []);

  const cleanupImportChannel = useCallback(() => {
    const ch = importProgressChannelRef.current;
    if (ch) {
      importProgressChannelRef.current = null;
      supabase.removeChannel(ch).catch(() => void 0);
    }
  }, []);

  const closeImportProgress = useCallback(() => {
    cleanupImportChannel();
    setImportProgressOpen(false);
    setImportProgress(0);
    setImportTitle("");
    setImportStatus("running");
    setImportSummary(null);
  }, [cleanupImportChannel]);

  const runExport = useCallback(
    async (format: "csv" | "xlsx") => {
      if (exportingRef.current || importingRef.current) return;
      exportingRef.current = true;

      setExportTitle(`${t("export")} · ${String(format).toUpperCase()}`);
      setExportProgress(8);
      setExportProgressOpen(true);

      try {
        const selected = (selectedProducts || []).filter(Boolean);
        const selectedAgg: ProductAggregated[] = selected.length > 0 ? (selected as unknown as ProductAggregated[]) : [];
        const effectiveStoreId = storeId ? String(storeId) : null;
        const res = await exportProducts({ format, storeId: effectiveStoreId, selectedProducts: selectedAgg });
        const scope = effectiveStoreId ? `store-${effectiveStoreId}` : "user";
        const filename =
          selected.length > 0
            ? `products-${scope}-selected-${Date.now()}.${format}`
            : `products-${scope}-${Date.now()}.${format}`;

        if (typeof res.data === "string") {
          await downloadText(res.data, filename, res.mime);
        } else {
          await downloadBlob(res.data, filename);
        }
        toast.success(t("import_export_exported"));
      } catch {
        toast.error(t("operation_failed"));
      } finally {
        exportingRef.current = false;
        closeExportProgress();
      }
    },
    [closeExportProgress, selectedProducts, storeId, t],
  );

  const runImportFromFile = useCallback(
    async (file: File) => {
      if (importingRef.current || exportingRef.current) return;
      importingRef.current = true;

      const effectiveStoreId = storeId ? String(storeId) : null;
      setImportTitle(t("import_export_update_title"));
      setImportProgress(8);
      setImportProgressOpen(true);
      setImportStatus("running");
      setImportSummary(null);

      try {
        const { products } = await readImportFile(file);
        setImportProgress(15);
        const validated = validateImportRows(products, t).map((r) => ({
          ...r,
          data: { ...r.data, __sheet: PRODUCTS_SHEET_NAME },
        }));
        const errorsCount = validated.reduce((acc, r) => acc + (r.ok ? 0 : 1), 0);
        if (validated.length === 0 || errorsCount > 0) {
          cleanupImportChannel();
          setImportProgress(100);
          setImportStatus("error");
          setImportSummary({ updated: 0, skipped: 0, errors: Math.max(1, errorsCount) });
          return;
        }

        const jobId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());

        const cleanupPrev = importProgressChannelRef.current;
        if (cleanupPrev) {
          importProgressChannelRef.current = null;
          supabase.removeChannel(cleanupPrev).catch(() => void 0);
        }

        const channel = supabase
          .channel(`product_import_jobs_${jobId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "product_import_jobs", filter: `id=eq.${jobId}` },
            (payload: any) => {
              const job = payload?.new || null;
              const total = Number(job?.total_rows ?? 0);
              const processed = Number(job?.processed_rows ?? 0);
              const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;
              setImportProgress(pct);
            },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "product_import_jobs", filter: `id=eq.${jobId}` },
            (payload: any) => {
              const job = payload?.new || null;
              const total = Number(job?.total_rows ?? 0);
              const processed = Number(job?.processed_rows ?? 0);
              const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;
              setImportProgress(pct);
            },
          )
          .subscribe();

        importProgressChannelRef.current = channel;

        const { updated, skipped } = await importProducts({ jobId, rows: validated, effectiveStoreId });
        ProductService.clearAllProductsCaches();
        queryClient.invalidateQueries({ queryKey: ["user", uid, "products"], exact: false });
        cleanupImportChannel();
        setImportProgress(100);
        setImportStatus("done");
        setImportSummary({ updated: Number(updated || 0), skipped: Number(skipped || 0), errors: 0 });
      } catch {
        cleanupImportChannel();
        setImportProgress(100);
        setImportStatus("error");
        setImportSummary({ updated: 0, skipped: 0, errors: 1 });
        ProductService.clearAllProductsCaches();
        queryClient.invalidateQueries({ queryKey: ["user", uid, "products"], exact: false });
      } finally {
        importingRef.current = false;
      }
    },
    [cleanupImportChannel, queryClient, storeId, t, uid],
  );

  const openImportFilePicker = useCallback(() => {
    if (importingRef.current || exportingRef.current) return;
    globalThis.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }, []);

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (e) => {
      const f = e.target.files?.[0] || null;
      e.currentTarget.value = "";
      if (!f) return;
      await runImportFromFile(f);
    },
    [runImportFromFile],
  );

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-transparent"
                  aria-label={t("import_export_title")}
                  disabled={!!disabled}
                  aria-disabled={!!disabled}
                  data-testid="user_products_import_export_open"
                >
                  <Upload className={`h-4 w-4 transition-colors ${disabled ? "text-muted-foreground" : ""}`} />
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent side="bottom">{t("import_export_title")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="user_products_export_menu">
              <Download className="h-4 w-4" />
              <span>{t("export")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => void runExport("xlsx")} data-testid="user_products_export_xlsx">
                <FileSpreadsheet className="h-4 w-4" />
                <span>XLSX</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runExport("csv")} data-testid="user_products_export_csv">
                <FileText className="h-4 w-4" />
                <span>CSV</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="user_products_import_menu">
              <Upload className="h-4 w-4" />
              <span>{t("import")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={openImportFilePicker} data-testid="user_products_import_pick_file">
                <File className="h-4 w-4" />
                <span>{t("import_export_from_file")}</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xlsx" onChange={onFileChange} />

      <ExportProgressDialog
        open={exportProgressOpen}
        progress={exportProgress}
        title={exportTitle || t("export")}
        description={exportDescription}
      />

      <ImportUpdateProgressDialog
        open={importProgressOpen}
        progress={importProgress}
        title={importTitle || t("import_export_update_title")}
        description={importStatus === "error" ? t("operation_failed") : t("import_export_update_description")}
        status={importStatus}
        summary={
          importSummary
            ? { updated: importSummary.updated, skipped: importSummary.skipped, errors: importSummary.errors }
            : null
        }
        labels={{
          updated: t("import_export_updated"),
          skipped: t("import_export_skipped"),
          errors: t("import_export_errors"),
        }}
        closeLabel={t("import_export_close")}
        onClose={closeImportProgress}
      />
    </>
  );
}
