import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
}

export const Spinner = ({ className }: SpinnerProps) => {
  return (
    <div
      className={cn(
        "animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600",
        className
      )}
    />
  );
};