import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-emerald-600 hover:shadow-sm hover:[&_svg]:[stroke-width:2.5] active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:2]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:text-destructive-foreground",
        outline:
          "border-input bg-background shadow-sm hover:bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:text-secondary-foreground",
        ghost: "hover:bg-transparent",
        link: "text-primary underline-offset-4 hover:bg-transparent hover:border-transparent hover:underline",
        hero: "bg-gradient-success bg-[length:200%_200%] animate-gradient-shift text-white shadow-primary hover:bg-gradient-success hover:text-white hover:shadow-glow hover:scale-105 transition-all duration-300",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
