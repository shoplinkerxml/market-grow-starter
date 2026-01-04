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
import { Loader2 } from "lucide-react";
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
          <DialogNoOverlayTitle>{t("delete_product_confirm")}</DialogNoOverlayTitle>
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
