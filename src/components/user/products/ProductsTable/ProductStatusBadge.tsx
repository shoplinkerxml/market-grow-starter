import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { inactiveProductBadgeClassName } from "./inactiveProductStyles";

export function ProductStatusBadge({ state, inactive = false }: { state?: string; inactive?: boolean }) {
  const { t } = useI18n();
  if (inactive) {
    return (
      <Badge variant="outline" className={`${inactiveProductBadgeClassName} font-medium uppercase tracking-[0.08em]`} data-testid="user_products_statusBadge">
        {t("product_inactive_badge")}
      </Badge>
    );
  }
  const s = state || 'new';
  const labelKey = s === 'stock' ? 'status_stock' : s === 'used' ? 'status_used' : s === 'refurbished' ? 'status_refurbished' : 'status_new';
  const cls = s === 'new'
    ? 'bg-emerald-200/60 text-emerald-700 border-emerald-300 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60'
    : s === 'refurbished'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60'
      : s === 'used'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60'
        : 'bg-emerald-50 text-emerald-500 border-neutral-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60';
  return (
    <Badge variant="outline" className={cls} data-testid="user_products_statusBadge">
      {t(labelKey)}
    </Badge>
  );
}
