import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserProfile as UserProfileType } from "@/lib/user-auth-schemas";
import { UserMenuItem } from "@/lib/user-menu-service";
import { useI18n } from "@/i18n";
import { User, Settings, TrendingUp, BarChart3, Activity, Plus, Crown, CreditCard, Package, Store } from "lucide-react";
import type { TariffLimit } from "@/lib/tariff-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopService } from "@/lib/shop-service";
import { ProductService } from "@/lib/product-service";
import { useQuery } from "@tanstack/react-query";
import { SupplierService } from "@/lib/supplier-service";
import { ProductLimitService } from "@/lib/product/product-limit-service";
import { DashboardService } from "@/lib/dashboard-service";

type SubscriptionEntity = {
  tariff_id?: number;
  end_date?: string | null;
  is_active?: boolean | null;
  tariffs?: {
    id?: number;
    name?: string | null;
    duration_days?: number | null;
    is_lifetime?: boolean | null;
  };
};
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
 
interface UserDashboardContextType {
  user: UserProfileType;
  refetch: () => void;
  subscription: { hasValidSubscription: boolean; subscription: SubscriptionEntity | null; isDemo: boolean } | null;
  tariffLimits: TariffLimit[];
}
const formatDateDdMmYyyy = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
};
const UserDashboard = () => {
  const {
    user,
    subscription,
    tariffLimits
  } = useOutletContext<UserDashboardContextType>();
  const {
    t
  } = useI18n();
  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Breadcrumb items using shadcn/ui breadcrumb
  const breadcrumbs: BreadcrumbItem[] = [{
    label: t('menu_main') || 'Main',
    href: '/user/dashboard'
  }, {
    label: t('menu_dashboard') || 'Dashboard',
    current: true
  }];

  const [endDate, setEndDate] = useState<string | null>(null);
  const [tariffName, setTariffName] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [isLifetime, setIsLifetime] = useState<boolean>(false);
  const [limits, setLimits] = useState<{
    limit_name: string;
    value: number;
    id?: number;
  }[]>([]);
  
  const { data: dashboardStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["user", user.id, "dashboard-stats"],
    queryFn: async () => {
      return await DashboardService.getDashboardStats();
    },
    enabled: !!user.id
  });
  
  useEffect(() => {
    const result = subscription;
    if (result && result.hasValidSubscription && result.subscription && result.subscription.is_active !== false) {
      const data = result.subscription;
      const end = data.end_date ? new Date(data.end_date) : null;
      setEndDate(end ? end.toISOString() : null);
      setTariffName(data.tariffs?.name || null);
      setDurationDays(data.tariffs?.duration_days ?? null);
      setExpired(false);
      setIsDemo(result.isDemo ?? false);
      setIsLifetime(data.tariffs?.is_lifetime === true);
    } else {
      setEndDate(null);
      setTariffName(null);
      setDurationDays(null);
      setExpired(false);
      setIsDemo(false);
      setIsLifetime(false);
      setLimits([]);
    }
  }, [subscription]);
  useEffect(() => {
    if (tariffLimits && tariffLimits.length > 0) setLimits(tariffLimits);
  }, [tariffLimits]);
  
  return <div className="space-y-6 p-6">
      
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {/* Tariff Block */}
        {tariffName && !expired ? (
          <Alert className="relative rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 border-emerald-200 bg-emerald-50 text-emerald-900 h-full">
            <AlertCircle />
            <AlertTitle className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight">
              {isDemo ? `${t("demo_trial_title_prefix")} ${durationDays ?? 7}${t("demo_trial_title_suffix")}` : t("active_tariff_title")}
            </AlertTitle>
            <AlertDescription className="col-start-2 grid justify-items-start gap-2 text-sm [&_p]:leading-relaxed">
              {isDemo ? <p>{t("demo_trial_desc")}</p> : null}
              {!isDemo && <div className="flex items-center gap-2">
                  {isLifetime ? <Crown className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  <span><strong>{tariffName}</strong>{endDate ? ` — ${t("end_date")}: ${formatDateDdMmYyyy(endDate)}` : ""}</span>
                </div>}
              <ul className="list-inside list-disc text-sm">
                {limits.map(l => (
                  <li key={l.id ?? `${l.limit_name}`}>{l.limit_name} - {l.value}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 h-full">
            <AlertTitle>
              {t("subscription_expired") || "Ваш тариф закончился"}
            </AlertTitle>
            <AlertDescription>
              <span>
                {t("please_select_new_tariff") || "Пожалуйста, выберите новый тариф, чтобы продолжить работу."}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Suppliers Block */}
        <Alert className="relative rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 border-emerald-200 bg-emerald-50 text-emerald-900 h-full">
          <Package />
          <AlertTitle className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight">
            {t('suppliers_title')}
          </AlertTitle>
          <AlertDescription className="col-start-2 grid justify-items-start gap-2 text-sm [&_p]:leading-relaxed">
            {isStatsLoading ? (
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <ul className="list-inside list-disc text-sm">
                {dashboardStats?.suppliers?.map((supplier) => (
                  <li key={supplier.id}>
                    {supplier.supplier_name} - {supplier.productCount} {t('products_count_suffix')}
                  </li>
                ))}
                {(!dashboardStats?.suppliers?.length) && (
                  <li>{t('no_suppliers')}</li>
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>

        {/* Shops Block */}
        <Alert className="relative rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 border-emerald-200 bg-emerald-50 text-emerald-900 h-full">
          <Store />
          <AlertTitle className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight">
            {t('shops_title')}
          </AlertTitle>
          <AlertDescription className="col-start-2 grid justify-items-start gap-2 text-sm [&_p]:leading-relaxed">
            {isStatsLoading ? (
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <ul className="list-inside list-disc text-sm">
                {dashboardStats?.stores?.map((store) => (
                  <li key={store.id}>
                    {store.store_name} - {store.productsCount || 0} {t('products_count_suffix')}
                  </li>
                ))}
                {(!dashboardStats?.stores?.length) && (
                  <li>{t('no_shops')}</li>
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>

        {/* Totals Block */}
        <Alert className="relative rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 border-emerald-200 bg-emerald-50 text-emerald-900 h-full">
          <Activity />
          <AlertTitle className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight">
            {t('totals_title')}
          </AlertTitle>
          <AlertDescription className="col-start-2 grid justify-items-start gap-2 text-sm [&_p]:leading-relaxed">
            {isStatsLoading ? (
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <ul className="list-inside list-disc text-sm">
                <li>{t('total_products')}: <strong>{dashboardStats?.totalProducts || 0}</strong></li>
                <li>{t('total_categories')}: <strong>{dashboardStats?.totalCategories || 0}</strong></li>
              </ul>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>;
};
export default UserDashboard;
