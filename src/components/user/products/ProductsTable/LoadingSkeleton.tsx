import { TableRow, TableCell } from "@/components/ui/table";

export function LoadingSkeleton() {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-[clamp(1.75rem,3vw,2.5rem)] w-[clamp(1.75rem,3vw,2.5rem)] rounded-md bg-muted animate-pulse" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-[clamp(6rem,20vw,12rem)] bg-muted rounded animate-pulse"></div>
            <div className="h-3 w-[clamp(8rem,24vw,14rem)] bg-muted rounded animate-pulse mt-1 hidden sm:block"></div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="h-6 w-16 bg-muted rounded-full animate-pulse"></div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
      </TableCell>
      <TableCell className="text-right">
        <div className="h-8 w-8 bg-muted rounded animate-pulse ml-auto"></div>
      </TableCell>
    </TableRow>
  );
}

