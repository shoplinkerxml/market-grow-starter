import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenuItem } from "@/lib/user-menu-service";
import { UserProfile } from "@/lib/user-auth-schemas";
import { useI18n } from "@/i18n";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { toast } from "sonner";
import TariffPage from "./TariffPage";
import { ListPage } from "@/pages/page-types/ListPage";
import { DashboardPage } from "@/pages/page-types/DashboardPage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShopService, type Shop, type ShopAggregated } from "@/lib/shop-service";
import { ShopStructureEditor } from "@/components/user/shops";
import { ExportDialog } from "@/components/user/shops/ExportDialog";
import { FullPageLoader } from "@/components/LoadingSkeletons";

interface UserDashboardContextType {
  user: UserProfile;
  menuItems: UserMenuItem[];
}

const UserMenuContentByPath = () => {
  const { path } = useParams();
  const navigate = useNavigate();
  const { user, menuItems } = useOutletContext<UserDashboardContextType>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const uid = user?.id ? String(user.id) : "current";
  const [menuItem, setMenuItem] = useState<UserMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get the full path including any nested routes
  const location = useLocation();
  const initialPathRef = useRef<string>(location.pathname);
  const fullPath = location.pathname.replace('/user/', '');
  const shopRoute = useMemo(() => {
    const raw = String(fullPath || path || "");
    const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
    const match = normalized.match(/^shops\/([^/]+)\/(structure|export)\/?$/);
    if (!match) return null;
    return { storeId: String(match[1] || ""), action: match[2] as "structure" | "export" };
  }, [fullPath, path]);
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const isReload = useMemo(() => {
    try {
      const entries = typeof performance !== "undefined" ? (performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]) : [];
      const navType = entries?.[0]?.type;
      if (navType === "reload") return true;
      const legacy = (performance as unknown as { navigation?: { type?: number } })?.navigation?.type;
      return legacy === 1;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!shopRoute) return;
    if (isReload && location.pathname === initialPathRef.current) {
      setShopDialogOpen(false);
      navigate(`/user/shops/${shopRoute.storeId}`, { replace: true });
      return;
    }
    setShopDialogOpen(true);
  }, [isReload, location.pathname, navigate, shopRoute]);

  const {
    data: shopForStructure,
    isLoading: shopForStructureLoading,
  } = useQuery<Shop | null>({
    queryKey: ["user", uid, "shopStructure", shopRoute?.storeId || ""],
    queryFn: async () => {
      const storeId = String(shopRoute?.storeId || "").trim();
      if (!storeId) return null;
      try {
        return await ShopService.getShop(storeId);
      } catch {
        const cached = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]);
        const fromCache = Array.isArray(cached)
          ? cached.find((s) => String(s.id) === storeId)
          : null;
        return (fromCache as unknown as Shop) ?? null;
      }
    },
    enabled: !!shopRoute?.storeId && shopRoute.action === "structure",
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const dashboardWidgets = useMemo(() => {
    const cfg = (menuItem?.content_data || {}) as Record<string, unknown>;
    const widgets = Array.isArray((cfg as { widgets?: unknown[] }).widgets) ? ((cfg as { widgets?: unknown[] }).widgets as unknown[]) : [];
    return widgets as unknown[];
  }, [menuItem?.content_data]);
  const dashboardData = useMemo(() => {
    const cfg = (menuItem?.content_data || {}) as Record<string, unknown>;
    const dataObj = typeof (cfg as { data?: unknown }).data === 'object' && (cfg as { data?: unknown }).data !== null ? ((cfg as { data?: Record<string, unknown> }).data as Record<string, unknown>) : {};
    return { lastUpdated: Date.now(), ...dataObj } as Record<string, unknown>;
  }, [menuItem?.content_data]);

  const pageMetaForLoader = useMemo(() => {
    const currentPath = String(fullPath || path || "").replace(/^\//, "");
    const normalizedPath = currentPath.startsWith("/") ? currentPath.substring(1) : currentPath;
    const foundItem =
      menuItems.find((item) => {
        const itemPath = item.path.startsWith("/") ? item.path.substring(1) : item.path;
        return itemPath === normalizedPath;
      }) || menuItem;

    const titleFallback = normalizedPath
      ? normalizedPath
          .split("/")
          .filter((part) => part.length > 0)
          .slice(-1)[0]
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()) || normalizedPath
      : "";

    const title = String(foundItem?.title || titleFallback || "");
    const iconName = String(foundItem?.icon_name || (normalizedPath.includes("tariff") ? "credit-card" : "") || "FileText");
    return { title, iconName };
  }, [fullPath, menuItem, menuItems, path]);

  const PageLoaderIcon = useMemo(() => {
    const iconName = pageMetaForLoader.iconName;
    return ({ className }: { className?: string }) => <DynamicIcon name={iconName} className={className} />;
  }, [pageMetaForLoader.iconName]);

  useEffect(() => {
    const loadMenuItem = async () => {
      if (shopRoute) {
        setError(null);
        setLoading(false);
        return;
      }
      // Use the full path instead of just the path parameter
      const currentPath = fullPath || path;
      
      if (!currentPath) {
        setError("No menu item path provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // First, try to find the item in the context menu items
        const normalizedPath = currentPath.startsWith('/') ? currentPath.substring(1) : currentPath;
        
        const foundItem = menuItems.find(item => {
          const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
          return itemPath === normalizedPath;
        });
        
        if (foundItem) {
          setMenuItem(foundItem);
          setLoading(false);
          return;
        }

        // If still not found, create a virtual item with the path as title
        const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
        const title = pathParts.length > 0 
          ? pathParts[pathParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : normalizedPath;
        
        // Create a virtual menu item
        const virtualItem: UserMenuItem = {
          id: -1, // Virtual ID
          user_id: user.id,
          title: title,
          path: normalizedPath,
          order_index: 0,
          is_active: true,
          page_type: 'content',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setMenuItem(virtualItem);
        setLoading(false);
      } catch (err) {
        console.error("Error loading menu item:", err);
        setError("Failed to load menu item");
        toast.error(t("failed_load_menu_item"));
      } finally {
        setLoading(false);
      }
    };

    loadMenuItem();
  }, [path, fullPath, user.id, t, menuItems, shopRoute]);

  if (shopRoute) {
    const handleClose = (open: boolean) => {
      setShopDialogOpen(open);
      if (!open) {
        navigate(`/user/shops/${shopRoute.storeId}`);
      }
    };

    if (shopRoute.action === "export") {
      return (
        <div className="p-6">
          <ExportDialog storeId={shopRoute.storeId} open={shopDialogOpen} onOpenChange={handleClose} />
        </div>
      );
    }

    if (shopForStructureLoading || !shopForStructure) {
      return (
        <FullPageLoader
          title="Завантаження магазину…"
          subtitle="Готуємо структуру магазину"
          icon={({ className }) => <DynamicIcon name="Store" className={className} />}
        />
      );
    }

    return (
      <div className="p-6">
        <ShopStructureEditor shop={shopForStructure} open={shopDialogOpen} onOpenChange={handleClose} />
      </div>
    );
  }

  if (loading) {
    return (
      <FullPageLoader
        title="Завантаження сторінки…"
        subtitle={pageMetaForLoader.title || undefined}
        icon={PageLoaderIcon}
      />
    );
  }

  if (error || !menuItem) {
    // Instead of showing just an error, display a page with title and description
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <DynamicIcon 
            name="FileText" 
            className="h-8 w-8 text-emerald-600" 
          />
          <div>
            <h1 className="text-2xl font-bold">{path}</h1>
            <p className="text-sm text-muted-foreground">This page is currently empty</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Page Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">This page has not been configured yet.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <DynamicIcon 
          name={menuItem.icon_name || "FileText"} 
          className="h-8 w-8 text-emerald-600" 
        />
        <div>
          <h1 className="text-2xl font-bold">{menuItem.title}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("content")}</CardTitle>
        </CardHeader>
        <CardContent>
          {(menuItem.path === 'tariff' || menuItem.path?.includes('/tariff') || menuItem.title === 'menu_pricing' || menuItem.title?.includes('Тариф')) ? (
            <TariffPage />
          ) : menuItem.page_type === 'content' && menuItem.content_data ? (
            <div className="prose max-w-none">
              {menuItem.content_data.content ? (
                <div dangerouslySetInnerHTML={{ __html: menuItem.content_data.content }} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t("no_content_available")}</p>
                </div>
              )}
            </div>
          ) : menuItem.page_type === 'form' ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Form content would be displayed here.</p>
            </div>
          ) : menuItem.page_type === 'list' ? (
            // Render ListPage component for list-type pages
            <ListPage 
              config={menuItem.content_data || {}} 
              title={menuItem.title} 
            />
          ) : menuItem.page_type === 'dashboard' ? (
            <DashboardPage widgets={dashboardWidgets} title={menuItem.title} data={dashboardData} />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Custom page content would be displayed here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserMenuContentByPath;
