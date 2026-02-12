import { useOutletContext } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserProfile as UserProfileType } from "@/lib/user-auth-schemas";
import { UserMenuItem } from "@/lib/user-menu-service";
import { useI18n } from "@/i18n";
import { User, Users, Settings, TrendingUp, BarChart3, Activity, Database, Crown, CreditCard, Package, Store, Folder, Layers, Truck, Download, X, List, Building2 } from "lucide-react";
import type { TariffLimit } from "@/lib/tariff-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopService } from "@/lib/shop-service";
import { ProductService } from "@/lib/product-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SupplierService } from "@/lib/supplier-service";
import { ProductLimitService } from "@/lib/product/product-limit-service";
import { DashboardService } from "@/lib/dashboard-service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DemoDataService } from "@/lib/demo-data-service";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import { cache } from "@/lib/cache-helper";

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
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AlertCircle } from "lucide-react";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
 
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
const getLimitLabelMeta = (label: string) => {
  const raw = String(label || "");
  const lower = raw.toLowerCase();
  const withoutCount = raw.replace(/кількість\s*/i, "").trim();
  const hasCount = /кількість/i.test(raw);
  let icon: JSX.Element | null = null;

  if (lower.includes("магазин")) icon = <Store className="h-4 w-4" />;
  else if (lower.includes("постач")) icon = <Truck className="h-4 w-4" />;
  else if (lower.includes("товар")) icon = <Package className="h-4 w-4" />;

  return { text: hasCount ? withoutCount : raw, icon };
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

  const breadcrumbs = useBreadcrumbs();

  const [endDate, setEndDate] = useState<string | null>(null);
  const [tariffName, setTariffName] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [isLifetime, setIsLifetime] = useState<boolean>(false);
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [limits, setLimits] = useState<{
    limit_name: string;
    value: number;
    id?: number;
  }[]>([]);
  
  const queryClient = useQueryClient();
  
  const { data: dashboardStats, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["user", user.id, "dashboard-stats"],
    queryFn: async () => {
      return await DashboardService.getDashboardStats();
    },
    enabled: !!user.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });

  const hasProducts = (dashboardStats?.totalProducts ?? 0) > 0;
  const hasActiveTariff = !!(
    subscription?.hasValidSubscription &&
    subscription?.subscription &&
    subscription.subscription.is_active !== false
  );
  const isDemoButtonVisible = !isStatsLoading && !isDemoLoading && !hasProducts && hasActiveTariff;

  const refreshUserQueries = useCallback(async () => {
    const predicate = (q: { queryKey?: unknown }) => {
      const key = Array.isArray(q.queryKey) ? q.queryKey : [];
      return key[0] === "user" && String(key[1]) === String(user.id);
    };
    await queryClient.invalidateQueries({ predicate, refetchType: "all" });
    await queryClient.refetchQueries({ predicate, type: "all" });
  }, [queryClient, user.id]);

  const handleLoadDemoData = async () => {
    if (isDemoLoading) return;
    setIsDemoLoading(true);
    setDemoProgress(5);
    let timer: number | null = null;
    let toastPayload: { type: "success" | "info" | "error"; message: string } | null = null;
    try {
      timer = window.setInterval(() => {
        setDemoProgress((prev) => {
          if (prev >= 90) return prev;
          return Math.min(prev + 7, 90);
        });
      }, 250);
      const result = await DemoDataService.loadDemoData();
      if (result.status === "already_has_data") {
        toastPayload = {
          type: "info",
          message: t("demo_data_already_loaded") || "Демо-дані вже завантажені",
        };
      } else {
        const counts = result.counts;
        const summary = counts
          ? `${counts.categories} ${t("categories_count_suffix") || "категорій"}, ${counts.products} ${t("products_count_suffix") || "товарів"}, ${counts.stores} ${t("shops_count_suffix") || "магазинів"}, ${counts.suppliers} ${t("suppliers_count_suffix") || "постачальників"}`
          : "";
        toastPayload = {
          type: "success",
          message: summary
            ? `${t("demo_data_loaded") || "Демо-дані завантажені"}: ${summary}`
            : t("demo_data_loaded") || "Демо-дані завантажені",
        };
      }
      await refetchStats();
      cache.clearByPrefix("template:");
      await refreshUserQueries();
    } catch (error) {
      console.error(error);
      toastPayload = {
        type: "error",
        message: t("demo_data_failed") || "Не вдалося завантажити демо-дані",
      };
    } finally {
      if (timer) window.clearInterval(timer);
    }
    setDemoProgress(100);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    if (toastPayload) {
      if (toastPayload.type === "success") toast.success(toastPayload.message);
      if (toastPayload.type === "info") toast.info(toastPayload.message);
      if (toastPayload.type === "error") toast.error(toastPayload.message);
    }
    setIsDemoDialogOpen(false);
    setIsDemoLoading(false);
    setDemoProgress(0);
  };

  const handleRefresh = useCallback(async () => {
    DashboardService.clearCache();
    ProductService.clearAllCaches();
    ShopService.clearAllCaches();
    SupplierService.clearSuppliersCache();
    cache.clearByPrefix("template:");
    await refetchStats();
    await refreshUserQueries();
  }, [refetchStats, refreshUserQueries]);
  
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumb items={breadcrumbs} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RefreshDataButton onRefresh={handleRefresh} />
          {isDemoButtonVisible ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDemoDialogOpen(true)}
              className="h-8 w-8 sm:w-auto sm:px-3 hover:border-emerald-500 hover:shadow-md active:scale-95 active:shadow-inner"
              aria-label={t("load_demo_data") || "Завантажити демо-дані"}
            >
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">{t("load_demo_data") || "Завантажити демо-дані"}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-xl">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('menu_dashboard') || 'Dashboard'}
            </div>
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
                      {limits.map((limit) => {
                        const { text, icon } = getLimitLabelMeta(limit.limit_name);
                        return (
                          <li key={limit.id ?? `${limit.limit_name}`} className="flex items-center gap-2">
                            {icon}
                            <span>{text} - <span className="font-semibold text-emerald-600">{limit.value}</span></span>
                          </li>
                        );
                      })}
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
                <Truck className="h-5 w-5" />
                <span>{t('suppliers_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <div className="space-y-2">
                      {dashboardStats?.suppliers?.map((supplier) => (
                        <div key={supplier.id} className="flex items-center gap-3">
                          <Users className="h-4 w-4 shrink-0 text-foreground" />
                          <span className="truncate max-w-[12rem] sm:max-w-[18rem]">{supplier.supplier_name}</span>
                          <span className="inline-flex items-center gap-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1">
                                  <Package className="h-4 w-4 text-foreground" />
                                  <span className="font-semibold text-emerald-600">{supplier.productCount}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">{t('dashboard_products_tooltip')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1">
                                  <List className="h-4 w-4 text-foreground" />
                                  <span className="font-semibold text-emerald-600">{supplier.categoriesCount ?? 0}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">{t('dashboard_categories_tooltip')}</TooltipContent>
                            </Tooltip>
                          </span>
                        </div>
                      ))}
                      {(!dashboardStats?.suppliers?.length) && (
                        <div>{t('no_suppliers')}</div>
                      )}
                    </div>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Shops Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Store className="h-5 w-5" />
                <span>{t('shops_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <div className="space-y-2">
                      {dashboardStats?.stores?.map((store) => (
                        <div key={store.id} className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 shrink-0 text-foreground" />
                          <span className="truncate max-w-[12rem] sm:max-w-[18rem]">{store.store_name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1">
                                <Package className="h-4 w-4 text-foreground" />
                                <span className="font-semibold text-emerald-600">{store.productsCount || 0}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">{t('dashboard_products_tooltip')}</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                      {(!dashboardStats?.stores?.length) && (
                        <div>{t('no_shops')}</div>
                      )}
                    </div>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Totals Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Activity className="h-5 w-5" />
                <span>{t('totals_title')}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                 {isStatsLoading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      <Package className="h-4 w-4 text-foreground" />
                      <span>{t('products_count_suffix') || 'товарів'}</span>
                      <span className="font-semibold text-emerald-600">{dashboardStats?.totalProducts || 0}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      <List className="h-4 w-4 text-foreground" />
                      <span>{t('categories_count_suffix') || 'категорій'}</span>
                      <span className="font-semibold text-emerald-600">{dashboardStats?.totalCategories || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
      <Dialog
        open={isDemoDialogOpen}
        onOpenChange={(open) => {
          if (isDemoLoading) return;
          setIsDemoDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl border-emerald-200/70 shadow-lg shadow-emerald-200/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600" />
              {t("demo_data_title") || "Завантажити демо-дані"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Store className="h-4 w-4" />
                <span>{t("shops_title")}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                <ul className="list-inside list-disc space-y-1">
                  <li>{t("demo_shops_count") || "3 магазини"}</li>
                  <li>{t("demo_shops_products") || "Товари з фото та описами"}</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Truck className="h-4 w-4" />
                <span>{t("suppliers_title")}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                <ul className="list-inside list-disc space-y-1">
                  <li>{t("demo_suppliers_count") || "2 постачальники"}</li>
                  <li>{t("demo_suppliers_catalog") || "Каталог з товарами"}</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Folder className="h-4 w-4" />
                <span>{t("categories_title") || "Категорії"}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                <ul className="list-inside list-disc space-y-1">
                  <li>{t("demo_categories_count") || "5 категорій"}</li>
                  <li>{t("demo_categories_tree") || "Ієрархія та зв’язки"}</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Package className="h-4 w-4" />
                <span>{t("products_title")}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                <ul className="list-inside list-disc space-y-1">
                  <li>{t("demo_products_count") || "50 товарів"}</li>
                  <li>{t("demo_products_images") || "3 фото на кожен товар"}</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Layers className="h-4 w-4" />
                <span>{t("menu_category_templates")}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                <ul className="list-inside list-disc space-y-1">
                  <li>{t("demo_templates_title") || "Шаблони характеристик"}</li>
                  <li>{t("demo_templates_values") || "Значення для фільтрів та форм"}</li>
                </ul>
              </div>
            </div>
          </div>
          {isDemoLoading ? (
            <div className="space-y-3">
              <Progress value={demoProgress} />
              <div className="text-xs text-muted-foreground">
                {t("loading") || "Завантаження..."}
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button onClick={handleLoadDemoData}>
                <Download className="h-4 w-4 mr-2" />
                {t("load_demo_data_confirm") || "Завантажити"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>;
};
export default UserDashboard;
