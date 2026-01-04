import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useCallback, useState } from "react";
import type { ComponentType } from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductService } from "@/lib/product-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { UserProfile } from "@/lib/user-auth-schemas";
import { SessionValidator } from "@/lib/session-validation";
import { UserProfile as UIUserProfile } from "@/components/ui/profile-types";
import { CreditCard, LayoutDashboard, Loader2, Package, Store, Truck, User } from "lucide-react";
import { PageLoadingModal } from "@/components/LoadingSkeletons";
import type { TariffLimit } from "@/lib/tariff-service";
import type { UserMenuItem } from "@/lib/user-menu-service";

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

type SubscriptionState = {
  hasValidSubscription: boolean;
  subscription: SubscriptionEntity | null;
  isDemo: boolean;
};

type AuthMeData = Awaited<ReturnType<typeof UserAuthService.fetchAuthMe>>;

type AuthLoaderMeta = {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
};

const UserProtected = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const isHardReload = useMemo(() => {
    try {
      const navEntry = (performance.getEntriesByType?.("navigation")?.[0] ??
        null) as PerformanceNavigationTiming | null;
      if (navEntry?.type === "reload") return true;
      const legacyType = (performance as any)?.navigation?.type;
      return legacyType === 1;
    } catch {
      return false;
    }
  }, []);
  const [reloadBootstrapping, setReloadBootstrapping] = useState(isHardReload);

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      let validation = await SessionValidator.ensureValidSession();
      for (
        let i = 0;
        i < 6 &&
        !validation.isValid &&
        (validation.error === "No active session" || validation.error === "Get session timeout");
        i++
      ) {
        try {
          SessionValidator.clearCache();
        } catch {
          void 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        validation = await SessionValidator.ensureValidSession();
      }
      return validation;
    },
    retry: false,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { isFetching: sessionIsFetching } = sessionQuery;
  const sessionValidation = sessionQuery.data ?? null;
  const sessionValid = sessionValidation?.isValid === true;

  const authMeQuery = useQuery<AuthMeData>({
    queryKey: ["auth", "me"],
    queryFn: async () => UserAuthService.fetchAuthMe(),
    enabled: sessionValid,
    retry: false,
    staleTime: 900_000,
    gcTime: 86_400_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const authMe = authMeQuery.data ?? null;
  const fallbackUser = useMemo<UserProfile | null>(() => {
    if (!sessionValidation?.user) return null;
    const u: any = sessionValidation.user as any;
    const email = typeof u.email === "string" ? u.email : "";
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.display_name === "string" && meta.display_name) ||
      (email ? email.split("@")[0] : "") ||
      "User";
    const avatarUrl =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      undefined;
    const createdAt = typeof u.created_at === "string" ? u.created_at : new Date().toISOString();
    const updatedAt = typeof u.updated_at === "string" ? u.updated_at : createdAt;
    return {
      id: String(u.id),
      email,
      name,
      role: "user",
      status: "active",
      avatar_url: avatarUrl,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }, [sessionValidation?.user]);
  const user = (authMe?.user ?? fallbackUser ?? null) as UserProfile | null;
  const tariffLimits = useMemo<TariffLimit[]>(() => {
    return Array.isArray(authMe?.tariffLimits) ? (authMe?.tariffLimits as any) : [];
  }, [authMe?.tariffLimits]);

  // Мемоизация UI профиля
  const uiUserProfile = useMemo<UIUserProfile | null>(() => {
    if (!user) return null;
    return {
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatar_url || "",
    };
  }, [user]);

  // Проверка валидности подписки
  const checkSubscriptionValidity = useCallback((sub: SubscriptionEntity | null): boolean => {
    if (!sub) return false;
    if (sub.is_active === false) return false;
    if (sub.tariffs?.is_lifetime === true) return true;
    const rawEndDate = typeof sub.end_date === "string" ? sub.end_date.trim() : "";
    if (!rawEndDate) return true;
    const parsedEndDate = (() => {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawEndDate);
      const value = dateOnly ? `${rawEndDate}T23:59:59.999` : rawEndDate;
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    })();
    if (!parsedEndDate) return true;
    return parsedEndDate.getTime() >= Date.now();
  }, []);

  const authenticated = sessionValid && !!user;

  const subscriptionState = useMemo<SubscriptionState>(() => {
    const edgeSub = (authMe?.subscription ?? null) as SubscriptionEntity | null;
    const hasAuthMe = authMeQuery.data != null;
    const valid = hasAuthMe ? checkSubscriptionValidity(edgeSub) : true;

    const isDemo =
      !!edgeSub &&
      !!edgeSub.tariffs &&
      (edgeSub.tariffs as any).is_free === true &&
      (edgeSub.tariffs as any).visible === false;

    return {
      hasValidSubscription: valid,
      subscription: edgeSub,
      isDemo,
    };
  }, [authMe?.subscription, authMeQuery.data, checkSubscriptionValidity]);

  // Функция обновления данных
  const refresh = useCallback(async () => {
    try {
      await queryClient.refetchQueries({ queryKey: ["auth", "me"], exact: true });
    } catch {
      void 0;
    }
  }, [queryClient]);

  // Prefetch магазинов при необходимости
  useEffect(() => {
    if (!authenticated) return;

    const path = location.pathname.toLowerCase();
    const isShopsListPage = path === '/user/shops' || path === '/user/shops/';
    const needsShops = isShopsListPage;
    
    if (needsShops) {
      ProductService.getUserStores().catch(() => void 0);
    }
  }, [authenticated, location.pathname]);

  const prefetchData = useCallback(async () => {
    try {
      const path = location.pathname.toLowerCase();
      const shouldPrefetchSuppliers =
        path.startsWith("/user/suppliers") ||
        path.includes("/user/products/new") ||
        path.includes("/user/products/edit");

      const tasks: Promise<unknown>[] = [];
      if (shouldPrefetchSuppliers) {
        const uid = user?.id ? String(user.id) : "current";
        tasks.push(
          queryClient.prefetchQuery({
            queryKey: ["user", uid, "suppliers", "list"],
            queryFn: async () => {
              const { SupplierService } = await import("@/lib/supplier-service");
              return await SupplierService.getSuppliers();
            },
            staleTime: 900_000,
          }),
        );
      }
      await Promise.allSettled(tasks);
    } catch {
      void 0;
    }
  }, [location.pathname, queryClient, user?.id]);

  useEffect(() => {
    if (!authenticated) return;
    void prefetchData();
  }, [authenticated, prefetchData]);

  const sessionPending = sessionQuery.data == null && (sessionQuery.isLoading || sessionIsFetching);
  const authMePending = sessionValid && authMeQuery.data == null && (authMeQuery.isLoading || authMeQuery.isFetching);

  const authLoading = sessionPending || authMePending;
  const fetchingCount = useIsFetching();
  const bootstrapPending = authLoading || fetchingCount > 0;
  const overlayVisible = isHardReload && reloadBootstrapping && bootstrapPending;
  const bootstrapping = isHardReload && reloadBootstrapping;
  const layoutContentBlocked = !isHardReload && authLoading;
  const authLoader = useMemo<AuthLoaderMeta>(() => {
    const path = location.pathname.toLowerCase();
    if (path.startsWith("/user/dashboard") || path === "/user" || path === "/user/") {
      return { title: "Завантаження панелі…", subtitle: "Готуємо дані кабінету", icon: LayoutDashboard };
    }
    if (path.startsWith("/user/products")) {
      return { title: "Завантаження товарів…", subtitle: "Готуємо дані та форму", icon: Package };
    }
    if (path.startsWith("/user/shops")) {
      return { title: "Завантаження магазинів…", subtitle: "Готуємо список та дані", icon: Store };
    }
    if (path.startsWith("/user/profile")) {
      return { title: "Завантаження профілю…", subtitle: "Готуємо дані користувача", icon: User };
    }
    if (path.startsWith("/user/tariff")) {
      return { title: "Завантаження тарифів…", subtitle: "Готуємо плани та обмеження", icon: CreditCard };
    }
    if (path.startsWith("/user/suppliers")) {
      return { title: "Завантаження постачальників…", subtitle: "Готуємо список та дані", icon: Truck };
    }
    return { title: "Завантаження сторінки…", subtitle: "Готуємо дані", icon: Loader2 };
  }, [location.pathname]);

  const contextValue = useMemo(() => ({
    hasAccess: subscriptionState.hasValidSubscription,
    user,
    uiUserProfile,
    subscription: subscriptionState,
    tariffLimits,
    menuItems: (Array.isArray(authMe?.menuItems) ? (authMe?.menuItems as UserMenuItem[]) : []),
    refresh,
    authLoading: layoutContentBlocked,
    contentBlocked: layoutContentBlocked,
    bootstrapping,
    authLoader,
  }), [
    subscriptionState,
    user,
    uiUserProfile,
    tariffLimits,
    authMe?.menuItems,
    refresh,
    layoutContentBlocked,
    bootstrapping,
    authLoader,
  ]);

  useEffect(() => {
    if (!reloadBootstrapping) return;
    if (!bootstrapPending) setReloadBootstrapping(false);
  }, [bootstrapPending, reloadBootstrapping]);

  // Redirect to login if not authenticated
  if (!authLoading && !authenticated) {
    return <Navigate to="/user-auth" replace />;
  }

  // Redirect admin/manager to admin interface
  if (!authLoading && user && (user.role === 'admin' || user.role === 'manager')) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen">
      <Outlet context={contextValue} />
      {overlayVisible ? <PageLoadingModal title={authLoader.title} subtitle={authLoader.subtitle} icon={authLoader.icon} /> : null}
    </div>
  );
};

export default UserProtected;
