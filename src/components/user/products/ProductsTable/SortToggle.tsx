import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function SortToggle<TData>({ column, table }: { column: import("@tanstack/react-table").Column<TData, unknown>; table: import("@tanstack/react-table").Table<TData> }) {
  const { t } = useI18n();
  const cur = column.getIsSorted?.();
  const isActive = cur === "asc" || cur === "desc";
  return (
    <Button
      type="button"
      variant="ghost"
      className={`h-8 w-4 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted ${isActive ? "text-primary" : "text-foreground"}`}
      aria-label={t("sort_asc")}
      onClick={() => {
        const next = cur === false ? "asc" : cur === "asc" ? "desc" : "asc";
        table.setSorting([{ id: column.id, desc: next === "desc" }]);
      }}
      data-testid={`user_products_sort_${column.id}_toggle`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-down h-4 w-4">
        <path d="m21 16-4 4-4-4"></path>
        <path d="M17 20V4"></path>
        <path d="m3 8 4-4 4 4"></path>
        <path d="M7 4v16"></path>
      </svg>
    </Button>
  );
}
