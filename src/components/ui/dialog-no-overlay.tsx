import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const DialogNoOverlay = DialogPrimitive.Root

const DialogNoOverlayTrigger = DialogPrimitive.Trigger

const DialogNoOverlayPortal = DialogPrimitive.Portal

const DialogNoOverlayClose = DialogPrimitive.Close

type DialogNoOverlayContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  hideClose?: boolean;
  position?: "center" | "top-right";
  /** Visual variant for border color on top-right notifications */
  variant?: "default" | "info" | "warning";
}

const DialogNoOverlayContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogNoOverlayContentProps
>(({ className, children, hideClose = false, position = "top-right", variant = "default", ...props }, ref) => (
  <DialogNoOverlayPortal>
    {/* Без Overlay — немодальне вікно без затемнення */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        position === "center"
          ? "fixed left-[50%] top-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-3 border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg"
          : "fixed top-[clamp(0.75rem,2vw,1rem)] right-[clamp(0.75rem,2vw,1rem)] z-50 grid w-full max-w-sm translate-x-0 translate-y-0 gap-3 border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
        variant === "info" && "border-success",
        variant === "warning" && "border-destructive",
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogNoOverlayPortal>
))
DialogNoOverlayContent.displayName = DialogPrimitive.Content.displayName

const DialogNoOverlayHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogNoOverlayHeader.displayName = "DialogNoOverlayHeader"

const DialogNoOverlayFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogNoOverlayFooter.displayName = "DialogNoOverlayFooter"

const DialogNoOverlayTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogNoOverlayTitle.displayName = DialogPrimitive.Title.displayName

const DialogNoOverlayDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
))
DialogNoOverlayDescription.displayName = DialogPrimitive.Description.displayName

export {
  DialogNoOverlay,
  DialogNoOverlayPortal,
  DialogNoOverlayTrigger,
  DialogNoOverlayClose,
  DialogNoOverlayContent,
  DialogNoOverlayHeader,
  DialogNoOverlayFooter,
  DialogNoOverlayTitle,
  DialogNoOverlayDescription,
}