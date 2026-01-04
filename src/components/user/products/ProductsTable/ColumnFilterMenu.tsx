import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { ChevronDown } from "lucide-react";

export function ColumnFilterMenu<TData>({ column, extraOptions }: { column: import("@tanstack/react-table").Column<TData, unknown>; extraOptions?: string[] }) {
  const { t } = useI18n();
  const hasAccessor = Boolean((column as unknown as { columnDef?: { accessorFn?: unknown; accessorKey?: unknown } }).columnDef?.accessorFn
    || (column as unknown as { columnDef?: { accessorFn?: unknown; accessorKey?: unknown } }).columnDef?.accessorKey);
  const canFilter = (column.getCanFilter?.() ?? false) && (hasAccessor || ((extraOptions || []).length > 0));
  if (!canFilter) return null;
  let faceted: Map<unknown, number> | undefined;
  try {
    faceted = column.getFacetedUniqueValues?.();
  } catch {
    faceted = undefined;
  }
  const values = faceted ? Array.from(faceted.keys()) : [];
  const providedOptions = Array.isArray(extraOptions) ? extraOptions : [];
  const isStores = column.id === "stores";
  const baseValues = isStores ? [] : values.map((v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v)));
  const unionValues = Array.from(new Set([
    ...baseValues,
    ...providedOptions,
  ]));
  const current = column.getFilterValue?.();
  const currentArr = Array.isArray(current) ? (current as unknown[]).map((v) => String(v as unknown as string)) : ((current == null ? [] : [String(current)]) as string[]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 p-0 ml-1 inline-flex items-center justify-center rounded-md transition-all duration-200 hover:bg-muted hover:shadow-sm active:scale-[0.98]"
          aria-label={t("filter")}
          data-testid={`user_products_filter_${column.id}_trigger`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit max-w-[min(24rem,92vw)] p-2">
        <DropdownMenuItem disabled className="text-xs">{t("filter_values")}</DropdownMenuItem>
        <div className="max-h-[12rem] max-w-[min(24rem,92vw)] overflow-auto">
          {unionValues.map((v) => {
              const id = String(v);
              const checked = currentArr.includes(id);
              return (
                <div key={id} className="flex items-center gap-2 px-2 py-1 min-w-0">
                  <input type="checkbox" checked={checked} onChange={(e) => {
                    const next = e.target.checked ? Array.from(new Set([...currentArr, id])) : currentArr.filter((x) => x !== id);
                    column.setFilterValue(next);
                  }} />
                  <span className="text-xs truncate max-w-[clamp(10rem,28vw,16rem)]" title={id}>{id}</span>
                </div>
              );
            })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
