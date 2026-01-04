import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useMemo, Suspense, lazy } from "react";
import { R2Storage } from "@/lib/r2-storage";
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useParams } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { removeCache, UnifiedCacheManager } from "@/lib/cache-utils";
import { DeduplicationMonitor } from "@/lib/request-deduplicator";
import { SessionValidator } from "@/lib/session-validation";
// Dev diagnostics removed per request

const Index = lazy(() => import("./pages/Index"));
const ExportPublic = lazy(() => import("./pages/ExportPublic"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const AdminProtected = lazy(() => import("./pages/AdminProtected"));
const AdminLayout = lazy(() => import("@/components/AdminLayout"));
import { AdminRoute, UserRoute } from "@/components/ProtectedRoutes";

const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const UserAuth = lazy(() => import("./pages/UserAuth"));
const UserRegister = lazy(() => import("./pages/UserRegister"));
const UserForgotPassword = lazy(() => import("./pages/UserForgotPassword"));
const UserResetPassword = lazy(() => import("./pages/UserResetPassword"));
const UserProtected = lazy(() => import("./pages/UserProtected"));
const UserLayout = lazy(() => import("@/components/UserLayout"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const UserMenuContent = lazy(() => import("./pages/UserMenuContent"));
const UserMenuContentByPath = lazy(() => import("./pages/UserMenuContentByPath"));
const CurrencyManagement = lazy(() => import("./pages/admin/settings/CurrencyManagement"));
const AdminTariffManagement = lazy(() => import("./pages/admin/AdminTariffManagement"));
const AdminTariffFeatures = lazy(() => import("./pages/admin/AdminTariffFeatures"));
const AdminTariffNew = lazy(() => import("./pages/admin/AdminTariffNew"));
const AdminTariffEdit = lazy(() => import("./pages/admin/AdminTariffEdit"));
const StoreTemplates = lazy(() => import("./pages/admin/StoreTemplates").then(m => ({ default: m.StoreTemplates })));
const LimitTemplates = lazy(() => import("./pages/admin/LimitTemplates").then(m => ({ default: m.LimitTemplates })));
const AdminUserDetails = lazy(() => import("./pages/admin/AdminUserDetails"));
const TariffPage = lazy(() => import("./pages/TariffPage"));
const Suppliers = lazy(() => import("./pages/user/Suppliers").then(m => ({ default: m.Suppliers })));
const Shops = lazy(() => import("./pages/user/Shops").then(m => ({ default: m.Shops })));
const ShopDetail = lazy(() => import("@/pages/user/ShopDetail").then(m => ({ default: m.ShopDetail })));
const Products = lazy(() => import("./pages/user/Products").then(m => ({ default: m.Products })));
const ProductCreate = lazy(() => import("./pages/user/ProductCreate").then(m => ({ default: m.ProductCreate })));
const ProductEdit = lazy(() => import("./pages/user/ProductEdit").then(m => ({ default: m.ProductEdit })));
const StoreProducts = lazy(() => import("./pages/user/StoreProducts").then(m => ({ default: m.StoreProducts })));
const ShopSettings = lazy(() => import("./pages/user/ShopSettings"));
import { StoreProductEdit } from "./pages/user/StoreProductEdit";

const LegacyUserShopsRedirect = () => {
  const params = useParams();
  const rest = params["*"];
  const to = rest ? `/user/shops/${rest}` : "/user/shops";
  return <Navigate to={to} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const queryPersister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: "rq:cache",
      })
    : null;

let lastAuthUserId: string | null = null;

const App = () => {
  // Clean up orphan temporary uploads for the current user on app start
  useEffect(() => {
    R2Storage.cleanupPendingUploads().catch(() => {});
  }, []);

  useEffect(() => {
    if (!queryPersister) return;
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: queryPersister,
      maxAge: 1000 * 60 * 60 * 24,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) ? key[0] !== "auth" : true;
        },
      },
    });
    return () => {
      try {
        unsubscribe();
      } catch {
        void 0;
      }
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const stop = DeduplicationMonitor.startMonitoring(60_000);
    try {
      (window as any).__dedup = DeduplicationMonitor;
    } catch {
      void 0;
    }
    return () => {
      stop();
      try {
        delete (window as any).__dedup;
      } catch {
        void 0;
      }
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUserId = session?.user?.id ? String(session.user.id) : null;
      const userChanged = currentUserId !== lastAuthUserId;
      const shouldClear =
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && userChanged) ||
        (event === "USER_UPDATED" && userChanged);
      if (shouldClear) {
        try {
          SessionValidator.clearCache();
        } catch {
          void 0;
        }
        try {
          queryPersister?.removeClient?.();
        } catch {
          void 0;
        }
        try {
          queryClient.clear();
        } catch {
          void 0;
        }
        try {
          UnifiedCacheManager.invalidatePattern(/^rq:/);
        } catch {
          void 0;
        }
        try {
          UnifiedCacheManager.invalidatePattern(/^auth-me(:|$)/);
        } catch {
          void 0;
        }
        try {
          const { SupplierService } = await import("@/lib/supplier-service");
          SupplierService.clearSuppliersCache();
        } catch {
          void 0;
        }
        try {
          const { ShopService } = await import("@/lib/shop-service");
          ShopService.clearAllCaches();
        } catch {
          void 0;
        }
        try {
          const { UserAuthService } = await import("@/lib/user-auth-service");
          UserAuthService.clearAuthMeCache();
        } catch {
          void 0;
        }
        try {
          const { ProductService } = await import("@/lib/product-service");
          (ProductService as unknown as { clearAllProductsCaches?: () => void }).clearAllProductsCaches?.();
        } catch {
          void 0;
        }
        try {
          queryClient.removeQueries({ queryKey: ["auth", "me"], exact: true });
          queryClient.removeQueries({ queryKey: ["auth", "session"], exact: true });
        } catch {
          void 0;
        }
        try {
          removeCache("rq:auth:me");
        } catch {
          void 0;
        }
        try {
          if (typeof window !== "undefined") {
            const storages: Storage[] = [];
            try {
              storages.push(window.localStorage);
            } catch {
              void 0;
            }
            try {
              storages.push(window.sessionStorage);
            } catch {
              void 0;
            }
            for (const s of storages) {
              const keys: string[] = [];
              for (let i = 0; i < s.length; i++) {
                const k = s.key(i);
                if (!k) continue;
                if (k.startsWith("user_") || k.startsWith("pending_uploads:")) {
                  keys.push(k);
                }
              }
              for (const k of keys) {
                try {
                  s.removeItem(k);
                } catch {
                  void 0;
                }
              }
            }
          }
        } catch {
          void 0;
        }
      }
      lastAuthUserId = currentUserId;
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const router = useMemo(() => createBrowserRouter([
    { path: "/", element: <Index /> },
    { path: "/docs", element: <ApiDocs /> },
    { path: "/export/:format/:token", element: <ExportPublic /> },
    { path: "/admin-auth", element: <AdminAuth /> },
    { path: "/admin-/*", element: <NotFound /> },
    {
      path: "/admin",
      element: <AdminRoute><AdminProtected /></AdminRoute>,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: "settings/currency", element: <AdminLayout><CurrencyManagement /></AdminLayout> },
        { path: "settings/limits", element: <AdminLayout><LimitTemplates /></AdminLayout> },
        { path: "storetemplates", element: <AdminLayout><StoreTemplates /></AdminLayout> },
        { path: "tariff", element: <AdminLayout><AdminTariffManagement /></AdminLayout> },
        { path: "tariff/new", element: <AdminLayout><AdminTariffNew /></AdminLayout> },
        { path: "tariff/edit/:id", element: <AdminLayout><AdminTariffEdit /></AdminLayout> },
        { path: "tariff/features", element: <AdminLayout><AdminTariffFeatures /></AdminLayout> },
        { path: "users/:id", element: <AdminLayout><AdminUserDetails /></AdminLayout> },
        { path: "*", element: <AdminLayout><Outlet /></AdminLayout> },
      ],
    },
    { path: "/user-register", element: <UserRegister /> },
    { path: "/user-auth", element: <UserAuth /> },
    { path: "/user-forgot-password", element: <UserForgotPassword /> },
    { path: "/user-reset-password", element: <UserResetPassword /> },
    { path: "/auth/callback", element: <AuthCallback /> },
    {
      path: "/user",
      element: <UserRoute><UserProtected /></UserRoute>,
      children: [
        {
          element: <UserLayout />,
          children: [
            { index: true, element: <Navigate to="dashboard" replace /> },
            { path: "dashboard", element: <UserDashboard /> },
            { path: "profile", element: <UserProfile /> },
            { path: "content/:id", element: <UserMenuContent /> },
            { path: ":path/*", element: <UserMenuContentByPath /> },
            { path: "tariff", element: <TariffPage /> },
            { path: "suppliers", element: <Suppliers /> },
            { path: "Shops/*", caseSensitive: true, element: <LegacyUserShopsRedirect /> },
            { path: "shops", caseSensitive: true, element: <Shops /> },
            { path: "shops/:id/*", caseSensitive: true, element: <ShopDetail /> },
            { path: "shops/:id/settings", caseSensitive: true, element: <ShopSettings /> },
            { path: "shops/:id/products", caseSensitive: true, element: <StoreProducts /> },
            { path: "shops/:id/products/edit/:productId", caseSensitive: true, element: <StoreProductEdit /> },
            { path: "products", element: <Products /> },
            { path: "products/new-product", element: <ProductCreate /> },
            { path: "products/edit/:id", element: <ProductEdit /> },
          ],
        },
      ],
    },
    { path: "*", element: <NotFound /> },
  ], {
    future: ({
      v7_relativeSplatPath: true,
      // Optional flags available in current router types
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: false,
      v7_skipActionErrorRevalidation: true,
    } as any),
  }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <I18nProvider>
            <Suspense fallback={<div data-testid="router_skeleton" className="min-h-screen flex items-center justify-center text-muted-foreground">Завантаження...</div>}>
              <RouterProvider router={router} future={{ v7_startTransition: true } as any} />
            </Suspense>
          </I18nProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
