import { Button } from "@/components/ui/button";
import {
  DialogNoOverlay,
  DialogNoOverlayContent,
  DialogNoOverlayDescription,
  DialogNoOverlayFooter,
  DialogNoOverlayHeader,
  DialogNoOverlayTitle,
} from "@/components/ui/dialog-no-overlay";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Info, Loader2, Trash2 } from "lucide-react";
import type { Product } from "@/lib/product-service";

export function CopyProgressDialog({ open, name, t }: { open: boolean; name: string | null; t: (k: string) => string }) {
  return (
    <DialogNoOverlay open={open} onOpenChange={() => void 0} modal={false}>
      <DialogNoOverlayContent
        position="top-right"
        variant="info"
        className="p-4 w-[min(24rem,92vw)] border-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="user_products_copy_progress"
      >
        <DialogNoOverlayHeader>
          <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
            <Loader2 className="h-[1rem] w-[1rem] animate-spin text-emerald-600" />
            {t("product_copying")}
          </DialogNoOverlayTitle>
          {name ? (
            <DialogNoOverlayDescription className="text-xs text-muted-foreground">
              {name}
            </DialogNoOverlayDescription>
          ) : (
            <DialogNoOverlayDescription className="sr-only">
              {t("product_copying")}
            </DialogNoOverlayDescription>
          )}
        </DialogNoOverlayHeader>
      </DialogNoOverlayContent>
    </DialogNoOverlay>
  );
}

export function DeleteProgressDialog({ open, t }: { open: boolean; t: (k: string) => string }) {
  return (
    <DialogNoOverlay open={open} onOpenChange={() => void 0} modal={false}>
      <DialogNoOverlayContent
        position="top-right"
        variant="info"
        className="p-4 w-[min(24rem,92vw)] border-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="user_products_delete_progress"
      >
        <DialogNoOverlayHeader>
          <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
            <Loader2 className="h-[1rem] w-[1rem] animate-spin text-emerald-600" />
            {t("products_deleting")}
          </DialogNoOverlayTitle>
          <DialogNoOverlayDescription className="sr-only">
            {t("products_deleting")}
          </DialogNoOverlayDescription>
        </DialogNoOverlayHeader>
      </DialogNoOverlayContent>
    </DialogNoOverlay>
  );
}

export function ExportProgressDialog({
  open,
  progress,
  title,
  description,
}: {
  open: boolean;
  progress: number;
  title: string;
  description?: string | null;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <DialogNoOverlay open={open} onOpenChange={() => void 0} modal={false}>
      <DialogNoOverlayContent
        position="top-right"
        variant="info"
        className="p-4 w-[min(24rem,92vw)] border border-emerald-200"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="user_products_export_progress"
      >
        <DialogNoOverlayHeader>
          <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
            <Loader2 className="h-[1rem] w-[1rem] animate-spin text-emerald-600" />
            {title}
          </DialogNoOverlayTitle>
          {description ? (
            <DialogNoOverlayDescription className="text-xs text-muted-foreground">
              {description}
            </DialogNoOverlayDescription>
          ) : (
            <DialogNoOverlayDescription className="sr-only">
              {title}
            </DialogNoOverlayDescription>
          )}
        </DialogNoOverlayHeader>
        <div className="mt-3 relative">
          <Progress value={pct} className="h-3" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2">
            <span className="tabular-nums text-[10px] leading-none text-foreground/80">
              {pct}%
            </span>
          </div>
        </div>
      </DialogNoOverlayContent>
    </DialogNoOverlay>
  );
}

export function ImportUpdateProgressDialog({
  open,
  progress,
  title,
  description,
  status,
  summary,
  labels,
  closeLabel,
  onClose,
}: {
  open: boolean;
  progress: number;
  title: string;
  description?: string | null;
  status: "running" | "done" | "error";
  summary?: { updated: number; skipped: number; errors?: number } | null;
  labels: { updated: string; skipped: string; errors: string };
  closeLabel: string;
  onClose: () => void;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const showSummary = status !== "running" && summary;
  return (
    <DialogNoOverlay open={open} onOpenChange={(next) => (next ? void 0 : onClose())} modal={false}>
      <DialogNoOverlayContent
        position="top-right"
        variant="info"
        className="p-4 w-[min(26rem,92vw)] border border-sky-200 bg-gradient-to-b from-sky-50 to-background"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="user_products_import_progress"
      >
        <DialogNoOverlayHeader>
          <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              {status === "done" ? <CheckCircle2 className="h-4 w-4" /> : status === "error" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </span>
            {title}
          </DialogNoOverlayTitle>
          {description ? (
            <DialogNoOverlayDescription className="text-xs text-muted-foreground">
              {description}
            </DialogNoOverlayDescription>
          ) : (
            <DialogNoOverlayDescription className="sr-only">
              {title}
            </DialogNoOverlayDescription>
          )}
        </DialogNoOverlayHeader>
        <div className="mt-3 relative">
          <Progress value={pct} className="h-3" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
            {status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
            ) : status === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            )}
            <span className="tabular-nums text-[10px] leading-none text-foreground/80">
              {pct}%
            </span>
          </div>
        </div>
        {showSummary ? (
          <div className="mt-3 rounded-md border bg-background/60 px-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{labels.updated}</span>
                <span className="tabular-nums text-foreground">{summary.updated}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{labels.skipped}</span>
                <span className="tabular-nums text-foreground">{summary.skipped}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{labels.errors}</span>
                <span className="tabular-nums text-foreground">{Number(summary.errors ?? 0)}</span>
              </div>
            </div>
          </div>
        ) : null}
        {status !== "running" ? (
          <DialogNoOverlayFooter className="mt-3">
            <Button variant="outline" onClick={onClose}>
              {closeLabel}
            </Button>
          </DialogNoOverlayFooter>
        ) : null}
      </DialogNoOverlayContent>
    </DialogNoOverlay>
  );
}

export function DeleteDialog({
  open,
  product,
  t,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  product: Product | null;
  t: (k: string) => string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <DialogNoOverlay open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogNoOverlayContent
        position="center"
        className="p-6 w-[min(28rem,92vw)]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogNoOverlayHeader>
          <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            {t("delete_product_confirm")}
          </DialogNoOverlayTitle>
          <DialogNoOverlayDescription>
            {product?.name ? (
              <span>
                {t("delete")}: "{product?.name}". {t("cancel")}? 
              </span>
            ) : (
              <span>{t("delete_product_confirm")}</span>
            )}
          </DialogNoOverlayDescription>
        </DialogNoOverlayHeader>
        <DialogNoOverlayFooter>
          <Button variant="outline" data-testid="user_products_delete_cancel" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            data-testid="user_products_delete_confirm"
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90"
          >
            {t("delete")}
          </Button>
        </DialogNoOverlayFooter>
      </DialogNoOverlayContent>
    </DialogNoOverlay>
  );
}
