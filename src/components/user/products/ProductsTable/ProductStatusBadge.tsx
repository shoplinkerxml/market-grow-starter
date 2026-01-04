import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

export function ProductStatusBadge({ state }: { state?: string }) {
  const { t } = useI18n();
  const s = state || 'new';
  const labelKey = s === 'stock' ? 'status_stock' : s === 'used' ? 'status_used' : s === 'refurbished' ? 'status_refurbished' : 'status_new';
  const cls = s === 'new' ? 'bg-emerald-200/60 text-emerald-700 border-emerald-300 shadow-sm' : s === 'refurbished' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow' : s === 'used' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-50 text-emerald-500 border-neutral-300';
  return (
    <Badge variant="outline" className={cls} data-testid="user_products_statusBadge">
      {t(labelKey)}
    </Badge>
  );
}
