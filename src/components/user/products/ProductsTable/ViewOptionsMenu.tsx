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
  reorderEnabled,
  onToggleReorder,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  reorderEnabled: boolean;
  onToggleReorder: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: disabled ? true : { draggable: !reorderEnabled, droppable: false },
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
    <DropdownMenuItem
      asChild
      disabled={disabled}
      data-testid={`user_products_columns_item_${id}`}
      onSelect={(e) => {
        e.preventDefault();
      }}
    >
      <div
        ref={setNodeRef as any}
        style={style}
        className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
          reorderEnabled
            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/40"
            : ""
        } ${isDragging ? "ring-2 ring-emerald-400" : ""}`}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label={label}
        />
        <div
          ref={reorderEnabled ? setActivatorNodeRef : undefined}
          className={`min-w-0 flex-1 truncate capitalize ${reorderEnabled ? "cursor-grab select-none touch-none" : ""}`}
          {...(reorderEnabled ? { ...attributes, ...listeners } : {})}
        >
          {label}
        </div>
        <button
          type="button"
          className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${
            reorderEnabled
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300"
              : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          aria-pressed={reorderEnabled}
          aria-label="Toggle reorder"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleReorder();
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </DropdownMenuItem>
  );
}

export function ViewOptionsMenu<TData>({ table, disabled }: { table: import("@tanstack/react-table").Table<TData>; disabled?: boolean }) {
  const { t } = useI18n();
  const isDisabled = !!disabled;
  const [activeReorderId, setActiveReorderId] = useState<string | null>(null);
  const isTouch = useMemo(() => {
    try {
      if (typeof window === "undefined") return false;
      const nav = window.navigator as any;
      return ("ontouchstart" in window) || (typeof nav?.maxTouchPoints === "number" && nav.maxTouchPoints > 0);
    } catch {
      return false;
    }
  }, []);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
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
        const withoutFixed = prev.filter((id) => id !== "select" && id !== "actions");
        const fromIndex = withoutFixed.indexOf(String(active.id));
        const toIndex = withoutFixed.indexOf(String(over.id));
        if (fromIndex === -1 || toIndex === -1) return ensureActionsLast(prev);

        const moved = arrayMove(withoutFixed, fromIndex, toIndex);
        const next = prev.includes("select") ? ["select", ...moved] : moved;
        return ensureActionsLast(next);
      });
    },
    [table],
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
        <DropdownMenuContent align="end" className="w-56" data-testid="user_products_columns_menu">
          <DropdownMenuItem disabled className="text-sm">
            {t("toggle_columns")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={isDisabled ? undefined : handleDragEnd}
            sensors={isDisabled ? [] : sensors}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {columns.map((column) => (
                <SortableColumnOption
                  key={column.id}
                  id={column.id}
                  label={labelMap[column.id] ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)}
                  checked={column.getIsVisible()}
                  disabled={isDisabled}
                  reorderEnabled={!isDisabled && (isTouch || activeReorderId === column.id)}
                  onToggleReorder={() => setActiveReorderId((prev) => (prev === column.id ? null : column.id))}
                  onCheckedChange={(checked) => column.toggleVisibility(checked)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
