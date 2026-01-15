import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns as ColumnsIcon, GripVertical } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { ensureActionsLast } from "./state";

function SortableColumnOption({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = useMemo(
    () =>
      ({
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }) as React.CSSProperties,
    [isDragging, transform, transition],
  );

  return (
    <div
      ref={setNodeRef as any}
      style={style}
      data-testid={`user_products_columns_item_${id}`}
      className={`w-full grid grid-cols-[auto,1fr,auto] items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
        "bg-white"
      } ${isDragging ? "ring-2 ring-emerald-400" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          aria-label={label}
        />
        <div className="min-w-0 flex-1 truncate capitalize">
          {label}
        </div>
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Reorder"
          className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-md border border-transparent text-muted-foreground hover:text-foreground hover:border-border justify-self-end cursor-grab touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
    </div>
  );
}

export function ViewOptionsMenu<TData>({ table, disabled }: { table: import("@tanstack/react-table").Table<TData>; disabled?: boolean }) {
  const { t } = useI18n();
  const isDisabled = !!disabled;
  const [isDragging, setIsDragging] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const labelMap = useMemo<Record<string, string>>(
    () => ({
      photo: t("photo"),
      name_ua: t("table_product"),
      status: t("table_status"),
      supplier: t("supplier"),
      price: t("table_price"),
      price_old: t("old_price"),
      price_promo: t("promo_price"),
      category: t("category"),
      stock_quantity: t("table_stock"),
      created_at: t("table_created"),
      article: t("article"),
      vendor: t("vendor"),
      docket_ua: t("short_name_ua"),
      description_ua: t("product_description_ua"),
      active: t("table_active"),
    }),
    [t],
  );

  const columns = useMemo(() => {
    const leaf = table.getAllLeafColumns().filter((column) => column.id !== "select" && column.id !== "actions");
    const order = table.getState().columnOrder || [];
    const byId = new Map(leaf.map((c) => [c.id, c]));
    const ordered: typeof leaf = [];

    for (const id of order) {
      const col = byId.get(id);
      if (col) ordered.push(col);
    }

    for (const col of leaf) {
      if (!order.includes(col.id)) ordered.push(col);
    }

    return ordered;
  }, [table]);

  const items = useMemo(() => columns.map((c) => c.id), [columns]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      table.setColumnOrder((prev) => {
        const fromIndex = items.indexOf(String(active.id));
        const toIndex = items.indexOf(String(over.id));
        if (fromIndex === -1 || toIndex === -1) return ensureActionsLast(prev);

        const moved = arrayMove(items, fromIndex, toIndex);
        const withSelect = prev.includes("select") ? ["select", ...moved] : moved;
        const withActions = prev.includes("actions") ? [...withSelect, "actions"] : withSelect;
        return ensureActionsLast(withActions);
      });
    },
    [items, table],
  );

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-label={t("columns_short")}
                data-testid="user_products_dataTable_viewOptions"
              >
                <ColumnsIcon className={`h-4 w-4 ${isDisabled ? "text-muted-foreground" : ""}`} />
              </Button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <TooltipContent side="bottom" data-testid="user_products_tooltip_columns">
            {t("columns_short")}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="w-48 max-h-[70vh] bg-white text-slate-900 border-emerald-400 overflow-y-auto"
          data-testid="user_products_columns_menu"
          onInteractOutside={(e) => {
            if (isDragging) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          <DropdownMenuItem disabled className="text-sm">
            {t("toggle_columns")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={
              isDisabled
                ? undefined
                : (e) => {
                    setIsDragging(false);
                    handleDragEnd(e);
                  }
            }
            onDragStart={() => setIsDragging(true)}
            onDragCancel={() => setIsDragging(false)}
            sensors={isDisabled ? [] : sensors}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="px-1 py-1">
                {columns.map((column) => (
                  <SortableColumnOption
                    key={column.id}
                    id={column.id}
                    label={labelMap[column.id] ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)}
                    checked={column.getIsVisible()}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => column.toggleVisibility(checked)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
