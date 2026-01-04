"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // Base toast styles + variant-specific overrides
          toast: [
            // Base visuals
            "group toast group-[.toaster]:bg-background group-[.toaster]:shadow-lg",
            // Base colors for unspecified types
            "group-[.toaster]:text-foreground group-[.toaster]:border-border",
            // Always show a visible border for clarity
            "border-2",
            // Variant coloring: success/info -> green; error -> red border + black text
            "data-[type=success]:border-green-500 data-[type=success]:text-green-700",
            "data-[type=info]:border-green-500 data-[type=info]:text-green-700",
            "data-[type=error]:border-red-500 data-[type=error]:text-black",
            // Set icon color via CSS variable to allow per-variant control
            "data-[type=success]:[--toast-icon:theme(colors.green.600)]",
            "data-[type=info]:[--toast-icon:theme(colors.green.600)]",
            "data-[type=error]:[--toast-icon:theme(colors.red.600)]",
          ].join(" "),
          // Ensure title/description inherit the parent color so error uses black
          title: "group-[.toast]:text-current",
          description: "group-[.toast]:text-current",
          // Icon uses the per-toast CSS variable set above
          icon: "group-[.toast]:text-[var(--toast-icon)]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
