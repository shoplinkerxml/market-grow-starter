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

      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('menu_dashboard') || 'Dashboard'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            
            {/* Tariff Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {tariffName && !expired 
                    ? (isDemo ? `${t("demo_trial_title_prefix")} ${durationDays ?? 7}${t("demo_trial_title_suffix")}` : t("active_tariff_title"))
                    : (t("subscription_expired") || "Ваш тариф закончился")}
                </span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {tariffName && !expired ? (
                  <>
                    {isDemo ? <p className="mb-2">{t("demo_trial_desc")}</p> : null}
                    {!isDemo && (
                      <div className="flex items-center gap-2 mb-2">
                        {isLifetime ? <Crown className="h-4 w-4 text-yellow-500" /> : <CreditCard className="h-4 w-4" />}
                        <span><strong>{tariffName}</strong>{endDate ? ` — ${t("until")} ${formatDateDdMmYyyy(endDate)}` : ""}</span>
                      </div>
                    )}
                    <ul className="list-inside list-disc space-y-1">
                      {limits.map(l => (
                        <li key={l.id ?? `${l.limit_name}`}>{l.limit_name} - {l.value}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>{t("please_select_new_tariff") || "Пожалуйста, выберите новый тариф, чтобы продолжить работу."}</p>
                )}
              </div>
            </div>

            {/* Suppliers Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Package className="h-4 w-4" />
                <span>{t('suppliers_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <ul className="list-inside list-disc space-y-1">
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
              </div>
            </div>

            {/* Shops Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Store className="h-4 w-4" />
                <span>{t('shops_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <ul className="list-inside list-disc space-y-1">
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
              </div>
            </div>

            {/* Totals Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Activity className="h-4 w-4" />
                <span>{t('totals_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                 {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <ul className="list-inside list-disc space-y-1">
                    <li>{t('total_products')}: <strong>{dashboardStats?.totalProducts || 0}</strong></li>
                    <li>{t('total_categories')}: <strong>{dashboardStats?.totalCategories || 0}</strong></li>
                  </ul>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>;
};
export default UserDashboard;
