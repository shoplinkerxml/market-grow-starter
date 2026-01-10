import { useEffect, useMemo, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { ExportService, type ExportLink } from "@/lib/export-service";
import { Copy, RefreshCw, Link as LinkIcon, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { UserProtectedOutletContext } from "@/components/user-layout/types";

type Props = {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ExportDialog = ({ storeId, open, onOpenChange }: Props) => {
  const { t } = useI18n();
  const [links, setLinks] = useState<ExportLink[]>([]);
  const [loading, setLoading] = useState(false);
  const { sidebarCollapsed } = useOutletContext<UserProtectedOutletContext>() || {};

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ExportService.listForStore(storeId);
      setLinks(data);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (open) {
      loadLinks();
    }
  }, [open, loadLinks]);

  const xmlLink = useMemo(() => links.find((l) => l.format === "xml") ?? null, [links]);
  const csvLink = useMemo(() => links.find((l) => l.format === "csv") ?? null, [links]);

  const xmlUrl = useMemo(() => {
    if (!xmlLink) return "";
    return ExportService.buildPublicUrl(window.location.origin, "xml", xmlLink.token);
  }, [xmlLink]);

  const csvUrl = useMemo(() => {
    if (!csvLink) return "";
    return ExportService.buildPublicUrl(window.location.origin, "csv", csvLink.token);
  }, [csvLink]);

  const hasAnyLink = !!xmlLink || !!csvLink;

  const createOrUpdate = useCallback(
    async (format: "xml" | "csv") => {
      const exists = format === "xml" ? !!xmlLink : !!csvLink;
      try {
        setLoading(true);
        if (!exists) {
          const link = await ExportService.createLink(storeId, format);
          if (!link) {
            toast.error(t("export_link_create_failed"));
            return;
          }
          const ok = await ExportService.generateAndUpload(storeId, format);
          if (!ok) {
            toast.error(t("export_update_failed"));
            return;
          }
          await loadLinks();
          toast.success(t("export_link_created"));
          return;
        }

        const ok = await ExportService.regenerate(storeId, format);
        if (!ok) {
          toast.error(t("export_update_failed"));
          return;
        }
        await loadLinks();
        toast.success(t("export_updated"));
      } catch {
        toast.error(exists ? t("export_update_failed") : t("export_link_create_failed"));
      } finally {
        setLoading(false);
      }
    },
    [csvLink, loadLinks, storeId, t, xmlLink],
  );

  const copyToClipboard = useCallback(
    async (value: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        toast.success(t("link_copied"));
      } catch {
        toast.error(t("export_update_failed"));
      }
    },
    [t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[95vw] w-full overflow-x-hidden border border-emerald-200",
          "sm:max-w-lg",
          sidebarCollapsed === false && "min-[1393px]:left-[calc(50%+8rem)]",
          sidebarCollapsed === true && "min-[1393px]:left-[calc(50%+2rem)]"
        )}
        data-testid="user_shop_export_dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            {t("export_section")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("export_section")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2" data-testid="user_shop_export_progress">
              <Spinner className="h-4 w-4" />
              <div className="text-sm text-muted-foreground">{t("export_updating")}</div>
            </div>
          )}

          <div className="space-y-3" data-testid="user_shop_export_links">
            {!hasAnyLink ? <div className="text-sm text-muted-foreground">{t("no_export_links")}</div> : null}

            <div className="space-y-3">
              <div className="space-y-2" data-testid="user_shop_export_xml">
                <div className="text-sm font-medium">XML</div>
                <div className="flex items-center gap-2">
                  <Input 
                    readOnly 
                    value={xmlUrl} 
                    placeholder={t("export_link_placeholder")}
                    className="text-xs min-w-0 w-auto" 
                    size={Math.max(40, xmlUrl.length)}
                    data-testid="user_shop_export_xml_value" 
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => createOrUpdate("xml")}
                      disabled={loading}
                      data-testid="user_shop_export_create_xml"
                      title={xmlLink ? t("refresh_export") : t("create")}
                    >
                      {xmlLink ? <RefreshCw className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void copyToClipboard(xmlUrl)}
                      disabled={!xmlUrl || loading}
                      data-testid="user_shop_export_copy_xml"
                      title={t("copy_link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2" data-testid="user_shop_export_csv">
                <div className="text-sm font-medium">CSV</div>
                <div className="flex items-center gap-2">
                  <Input 
                    readOnly 
                    value={csvUrl} 
                    placeholder={t("export_link_placeholder")}
                    className="text-xs min-w-0 w-auto" 
                    size={Math.max(40, csvUrl.length)}
                    data-testid="user_shop_export_csv_value" 
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => createOrUpdate("csv")}
                      disabled={loading}
                      data-testid="user_shop_export_create_csv"
                      title={csvLink ? t("refresh_export") : t("create")}
                    >
                      {csvLink ? <RefreshCw className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void copyToClipboard(csvUrl)}
                      disabled={!csvUrl || loading}
                      data-testid="user_shop_export_copy_csv"
                      title={t("copy_link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
