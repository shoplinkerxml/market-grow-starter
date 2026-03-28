import { useMemo } from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ProductRow } from "./columns";

export function SortableProductRow({
  row,
  columnsLength,
  rowHeight,
  rowReorderEnabled,
}: {
  row: Row<ProductRow>;
  columnsLength: number;
  rowHeight: number;
  rowReorderEnabled: boolean;
}) {
  const id = String(row.original.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !rowReorderEnabled,
  });
  const style = useMemo(
    () =>
      ({
        transform: CSS.Transform.toString(transform),
        transition,
        height: rowHeight,
      }) as React.CSSProperties,
    [rowHeight, transform, transition],
  );

  const isInactive = row.original.is_active === false;

  return (
    <TableRow
      ref={setNodeRef}
      key={row.id}
      data-state={row.getIsSelected() && "selected"}
      className={`hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${isInactive ? "bg-muted/40 dark:bg-muted/20 [&_img]:grayscale [&_img]:opacity-60 [&_[data-testid='user_products_name']_button]:text-muted-foreground [&_[data-testid='user_products_supplier']]:text-muted-foreground" : ""} ${isDragging ? "opacity-70" : ""}`}
      style={style}
    >
      {row.getVisibleCells().map((cell) => {
        if (cell.column.id !== "name_ua") {
          return <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>;
        }
        return (
          <TableCell key={cell.id}>
            <div className="flex items-start gap-2 min-w-0">
              {rowReorderEnabled ? (
                <button
                  ref={setActivatorNodeRef}
                  type="button"
                  className={`h-11 w-11 sm:h-8 sm:w-8 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing ${isDragging ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  {...attributes}
                  {...listeners}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label="Reorder row"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
            </div>
          </TableCell>
        );
      })}
      {row.getVisibleCells().length === 0 ? <TableCell colSpan={columnsLength} /> : null}
    </TableRow>
  );
}

