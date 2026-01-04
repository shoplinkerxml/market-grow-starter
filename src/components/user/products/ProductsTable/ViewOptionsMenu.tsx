import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Columns as ColumnsIcon } from "lucide-react";
import { useI18n } from "@/i18n";

export function ViewOptionsMenu<TData>({ table, disabled }: { table: import("@tanstack/react-table").Table<TData>; disabled?: boolean }) {
  const { t } = useI18n();
  const isDisabled = !!disabled;
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
          {table
            .getAllLeafColumns()
            .filter((column) => column.id !== "select" && column.id !== "actions")
            .map((column) => {
              const isVisible = column.getIsVisible();
              const labelMap: Record<string, string> = {
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
              };
              const translatedLabel = labelMap[column.id] ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id);
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={isVisible}
                  data-testid={`user_products_columns_item_${column.id}`}
                  onSelect={(e) => {
                    e.preventDefault();
                  }}
                  onCheckedChange={(value) => column.toggleVisibility(value === true)}
                >
                  {translatedLabel}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
