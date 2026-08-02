import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { useSuppliers } from "@/hooks/useSuppliers";
import {
  XmlImportService,
  type SupplierImportRun,
  type SupplierImportItem,
} from "@/lib/xml-import-service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { handleImportRunFinish } from "@/lib/xml-import-cache";

type OutletCtx = { user: { id?: string } | null };

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtDuration(a?: string | null, b?: string | null) {
  if (!a) return "—";
  const end = b ? new Date(b).getTime() : Date.now();
  const ms = end - new Date(a).getTime();
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${s}s`;
}

function statusBadge(status: string, t: (k: string) => string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; key: string }> = {
    queued: { variant: "secondary", key: "xml_import_status_queued" },
    running: { variant: "default", key: "xml_import_status_running" },
    succeeded: { variant: "outline", key: "xml_import_status_succeeded" },
    failed: { variant: "destructive", key: "xml_import_status_failed" },
    cancelled: { variant: "secondary", key: "xml_import_status_cancelled" },
  };
  const cfg = map[status] ?? { variant: "outline" as const, key: status };
  return <Badge variant={cfg.variant}>{t(cfg.key) || status}</Badge>;
}

const XmlImports = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const { user } = useOutletContext<OutletCtx>();
  const uid = user?.id ? String(user.id) : "current";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRunId = searchParams.get("run");
  const navigate = useNavigate();

  const { data: suppliers } = useSuppliers(uid);
  const supplierMap = useMemo(() => {
    const m = new Map<number, string>();
    (suppliers ?? []).forEach((s: any) => m.set(Number(s.id), s.name ?? String(s.id)));
    return m;
  }, [suppliers]);

  const [runs, setRuns] = useState<SupplierImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSupplierId, setUploadSupplierId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const supplierId = Number(uploadSupplierId);
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      toast.error(t("xml_import_upload_no_supplier"));
      return;
    }
    if (!/\.(xml|yml)$/i.test(file.name)) {
      toast.error(t("xml_import_upload_bad_type"));
      return;
    }
    if (file.size > XmlImportService.MAX_UPLOAD_BYTES) {
      toast.error(t("xml_import_upload_too_large"));
      return;
    }

    setUploading(true);
    try {
      await XmlImportService.startImportFromFile(supplierId, file);
      toast.success(t("xml_import_upload_queued"));
      setUploadOpen(false);
      void loadRuns();
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      toast.error(m || t("xml_import_upload_failed"));
    } finally {
      setUploading(false);
    }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      setRuns(await XmlImportService.listAllRuns(100));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  // Realtime: keep list fresh
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`xml-imports-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplier_import_runs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as SupplierImportRun;
          if (row && payload.eventType !== "DELETE") {
            handleImportRunFinish(queryClient, uid, row);
          }
          setRuns((prev) => {
            if (!row) return prev;
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== row.id);
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = { ...next[idx], ...(payload.new as SupplierImportRun) };
              return next;
            }
            return [payload.new as SupplierImportRun, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (selectedRunId) {
    return (
      <RunDetails
        runId={selectedRunId}
        onBack={() => {
          searchParams.delete("run");
          setSearchParams(searchParams, { replace: true });
        }}
        supplierMap={supplierMap}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("xml_imports_title")}
        description={t("xml_imports_description")}
        breadcrumbItems={breadcrumbs}
        hideTitleOnMobile
        mobileActionsInline
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              {t("xml_import_upload_file")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadRuns()}
              disabled={loading}
              title={t("refresh") || "Refresh"}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <Dialog open={uploadOpen} onOpenChange={(o) => !uploading && setUploadOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("xml_import_upload_dialog_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("xml_import_upload_select_supplier")}</Label>
              <Select value={uploadSupplierId} onValueChange={setUploadSupplierId} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue placeholder={t("xml_import_upload_select_supplier_ph")} />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers ?? []).length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {t("xml_import_upload_no_suppliers")}
                    </div>
                  ) : (
                    (suppliers ?? []).map((s: any) => (
                      <SelectItem key={String(s.id)} value={String(s.id)}>
                        {s.name ?? `#${s.id}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{t("xml_import_upload_hint")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !uploadSupplierId}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? t("xml_import_uploading") : t("xml_import_upload_choose_file")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("xml_imports_supplier")}</TableHead>
              <TableHead>{t("xml_imports_trigger")}</TableHead>
              <TableHead>{t("xml_imports_started")}</TableHead>
              <TableHead>{t("xml_imports_duration")}</TableHead>
              <TableHead>{t("xml_imports_status")}</TableHead>
              <TableHead>{t("xml_import_stats")}</TableHead>
              <TableHead className="text-right">{t("xml_imports_details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("xml_imports_empty")}
                </TableCell>
              </TableRow>
            )}
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {supplierMap.get(r.supplier_id) ?? `#${r.supplier_id}`}
                </TableCell>
                <TableCell>
                  {r.trigger === "scheduled"
                    ? t("xml_imports_trigger_scheduled")
                    : t("xml_imports_trigger_manual")}
                </TableCell>
                <TableCell>{fmtDate(r.started_at ?? r.created_at)}</TableCell>
                <TableCell>{fmtDuration(r.started_at, r.finished_at)}</TableCell>
                <TableCell>{statusBadge(r.status, t)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(r.created_count ?? 0)} / {(r.updated_count ?? 0)} / {(r.failed_count ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      searchParams.set("run", r.id);
                      setSearchParams(searchParams, { replace: false });
                    }}
                  >
                    {t("xml_imports_details")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

function RunDetails({
  runId,
  onBack,
  supplierMap,
}: {
  runId: string;
  onBack: () => void;
  supplierMap: Map<number, string>;
}) {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const [run, setRun] = useState<SupplierImportRun | null>(null);
  const [items, setItems] = useState<SupplierImportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, its] = await Promise.all([
        XmlImportService.getRun(runId),
        XmlImportService.listRunItems(runId, 200),
      ]);
      setRun(r);
      setItems(its);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [runId]);

  // Realtime: live progress on this run
  useEffect(() => {
    const ch = supabase
      .channel(`xml-import-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "supplier_import_runs", filter: `id=eq.${runId}` },
        (payload) => setRun((prev) => ({ ...(prev as any), ...(payload.new as any) })),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "supplier_import_items", filter: `run_id=eq.${runId}` },
        (payload) => setItems((prev) => [payload.new as SupplierImportItem, ...prev].slice(0, 200)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [runId]);

  const processed = run?.processed_rows ?? 0;
  const total = run?.total_rows ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : run?.status === "succeeded" ? 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("xml_imports_run_details")}
        description={run ? supplierMap.get(run.supplier_id) ?? `#${run.supplier_id}` : ""}
        breadcrumbItems={breadcrumbs}
        hideTitleOnMobile
        mobileActionsInline
        actions={
          <Button
            variant="ghost"
            onClick={onBack}
            className="shrink-0 group inline-flex items-center gap-2 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent shadow-none hover:shadow-none"
            title={t("xml_imports_back")}
          >
            <span className="inline sm:hidden">{t("xml_imports_back")}</span>
            <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-8 h-8 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
              <ArrowLeft className="h-4 w-4" />
            </span>
          </Button>
        }
      />

      {loading && !run ? (
        <div className="text-muted-foreground">{t("xml_imports_loading")}</div>
      ) : !run ? (
        <div className="text-muted-foreground">{t("xml_imports_empty")}</div>
      ) : (
        <>
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("xml_imports_status")}: {statusBadge(run.status, t)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("xml_imports_duration")}: {fmtDuration(run.started_at, run.finished_at)}
              </div>
            </div>
            <Progress value={pct} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <Stat label={t("xml_imports_processed")} value={`${processed}${total ? ` / ${total}` : ""}`} />
              <Stat label={t("xml_imports_created")} value={run.created_count ?? 0} />
              <Stat label={t("xml_imports_updated")} value={run.updated_count ?? 0} />
              <Stat label={t("xml_imports_skipped")} value={run.skipped_count ?? 0} />
              <Stat label={t("xml_imports_failed")} value={run.failed_count ?? 0} />
            </div>
            {run.error && (
              <div className="text-sm text-destructive">
                {t("xml_imports_error")}: {run.error}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("xml_imports_errors_section")}</div>
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("xml_imports_no_errors")}</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("xml_imports_external_id")}</TableHead>
                      <TableHead>{t("xml_imports_status")}</TableHead>
                      <TableHead>{t("xml_imports_error")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{it.external_id ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={it.status === "failed" ? "destructive" : "outline"}>{it.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{it.error ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export default XmlImports;