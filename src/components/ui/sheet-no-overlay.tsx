import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const SheetNoOverlay = SheetPrimitive.Root

const SheetNoOverlayTrigger = SheetPrimitive.Trigger

const SheetNoOverlayClose = SheetPrimitive.Close

const SheetNoOverlayPortal = SheetPrimitive.Portal

const sheetNoOverlayVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetNoOverlayContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
  VariantProps<typeof sheetNoOverlayVariants> { }

const SheetNoOverlayContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetNoOverlayContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetNoOverlayPortal>
    {/* No SheetOverlay here - that's the key difference */}
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetNoOverlayVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetNoOverlayPortal>
))
SheetNoOverlayContent.displayName = SheetPrimitive.Content.displayName

const SheetNoOverlayHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetNoOverlayHeader.displayName = "SheetNoOverlayHeader"

const SheetNoOverlayTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetNoOverlayTitle.displayName = SheetPrimitive.Title.displayName

export {
  SheetNoOverlay,
  SheetNoOverlayClose,
  SheetNoOverlayContent,
  SheetNoOverlayHeader,
  SheetNoOverlayPortal,
  SheetNoOverlayTitle,
  SheetNoOverlayTrigger
}