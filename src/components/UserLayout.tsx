import { useState, useEffect, createContext, useContext, useMemo, useCallback } from "react";
import type { ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SheetNoOverlay, SheetNoOverlayContent, SheetNoOverlayHeader, SheetNoOverlayTitle, SheetNoOverlayTrigger } from "@/components/ui/sheet-no-overlay";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Moon, AlignJustify, LogOut, MoreHorizontal } from "lucide-react";
import { useTheme } from "next-themes";
import { ProfileTrigger } from "@/components/ui/profile-trigger";
import { ProfileSheetContent } from "@/components/ui/profile-sheet-content";
import { UserProfile as UIUserProfile } from "@/components/ui/profile-types";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { UserMenuService, UserMenuItem } from "@/lib/user-menu-service";
import { UserProfile } from "@/lib/user-auth-schemas";
// Subscription access is validated in UserProtected and passed via Outlet context
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MenuSection } from "@/components/user/MenuSection";
import { MenuItemWithIcon } from "@/components/user/MenuItemWithIcon";
import { FullPageLoader, ProgressiveLoader } from "@/components/LoadingSkeletons";
import type { TariffLimit } from "@/lib/tariff-service";

type SubscriptionEntity = {
  tariff_id?: number;
  end_date?: string | null;
  tariffs?: {
    id?: number;
    name?: string | null;
    duration_days?: number | null;
    is_lifetime?: boolean | null;
  };
};

type AuthLoaderMeta = {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
};

type UserProtectedOutletContext = {
  hasAccess: boolean;
  user: UserProfile | null;
  uiUserProfile: UIUserProfile | null;
  subscription: { hasValidSubscription: boolean; subscription: SubscriptionEntity | null; isDemo: boolean } | null;
  tariffLimits: TariffLimit[];
  menuItems: UserMenuItem[];
  refresh: () => Promise<void>;
  authLoading?: boolean;
  contentBlocked?: boolean;
  bootstrapping?: boolean;
  authLoader?: AuthLoaderMeta;
};

const STATIC_ROUTES: Record<string, Partial<UserMenuItem>> = {
  '/dashboard': {
    id: -1,
    title: 'Dashboard',
    path: '/dashboard',
    page_type: 'dashboard',
    is_active: true,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    icon_name: 'layout-dashboard'
  },
  '/tariff': {
    id: -3,
    title: 'Тарифні плани',
    path: '/tariff',
    page_type: 'content',
    is_active: true,
    order_index: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    icon_name: 'credit-card'
  }
};
interface UserMenuContextState {
  menuItems: UserMenuItem[];
  activeMenuItem: UserMenuItem | null;
  menuLoading: boolean;
  setActiveMenuItem: (item: UserMenuItem | null) => void;
  navigateToMenuItem: (item: UserMenuItem) => void;
  refreshMenuItems: () => Promise<void>;
  hasAccess: boolean;
}
const UserMenuContext = createContext<UserMenuContextState | null>(null);
const useUserMenu = () => {
  const context = useContext(UserMenuContext);
  if (!context) {
    throw new Error('useUserMenu must be used within UserMenuProvider');
  }
  return context;
};
function buildTree(items: UserMenuItem[]): Record<number | "root", UserMenuItem[]> {
  const map: Record<number | "root", UserMenuItem[]> = {
    root: []
  };
  for (const it of items) {
    const key = (it.parent_id ?? "root") as number | "root";
    if (!map[key]) map[key] = [];
    map[key].push(it);
  }
  for (const key in map) {
    const k = key as unknown as keyof typeof map;
    const arr = map[k];
    if (arr) arr.sort((a, b) => a.order_index - b.order_index);
  }
  return map;
}
const UserMenuProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
  hasAccess: boolean;
  menuItems: UserMenuItem[];
}> = ({
  children,
  userId,
  hasAccess,
  menuItems: menuItemsFromAuthMe
}) => {
  const queryClient = useQueryClient();
  const [activeMenuItem, setActiveMenuItemState] = useState<UserMenuItem | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [menuItemsRaw, setMenuItemsRaw] = useState<UserMenuItem[]>(
    Array.isArray(menuItemsFromAuthMe) ? menuItemsFromAuthMe : [],
  );

  useEffect(() => {
    if (!Array.isArray(menuItemsFromAuthMe)) return;
    setMenuItemsRaw(menuItemsFromAuthMe);
  }, [menuItemsFromAuthMe]);

  const menuLoading = false;

  const menuItems: UserMenuItem[] = useMemo(() => {
    let items = Array.isArray(menuItemsRaw) ? menuItemsRaw : [];
    items = items.filter((i) => i && typeof i === "object");
    items = items.map((i) => ({ ...i })) as UserMenuItem[];
    items = items.filter((i) => (i.user_id ? String(i.user_id) === String(userId) : true));
    items = items.filter((i) => i && typeof i.title === "string" && typeof i.path === "string");
    items = items.filter((i) => (i && typeof i.is_active === "boolean" ? i.is_active === true : true));
    items = items.map((item: UserMenuItem) => {
      const title = String(item.title || "").toLowerCase();
      const path = String(item.path || "").toLowerCase();
      if (
        (!item.icon_name || item.icon_name === "circle" || item.icon_name === "Circle") &&
        (title.includes("supplier") ||
          title.includes("постачальник") ||
          title.includes("shop") ||
          title.includes("магазин") ||
          title.includes("payment") ||
          title.includes("платеж") ||
          path.includes("supplier") ||
          path.includes("постачальник") ||
          path.includes("shop") ||
          path.includes("магазин") ||
          path.includes("payment") ||
          path.includes("платеж"))
      ) {
        return { ...item, icon_name: UserMenuService.getAutoIconForMenuItem({ title: item.title, path: item.path }) };
      }
      return item;
    });
    return items;
  }, [menuItemsRaw, userId]);
  const refreshMenuItems = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["auth", "me"], exact: true });
  }, [queryClient]);

  // Find active menu item based on current path with static route fallback
  const findActiveMenuItem = useCallback((currentPath: string, items: UserMenuItem[]) => {
    const userPath = currentPath.replace('/user', '');

    // First try to find in loaded menu items from database
    // For database items, the path is stored without the leading slash
    const menuItem = items.find(item => {
      // Ensure both paths are in the same format for comparison
      const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
      const normalizedUserPath = userPath.startsWith('/') ? userPath.substring(1) : userPath;
      return itemPath === normalizedUserPath;
    });
    if (menuItem) {
      return menuItem;
    }

    // For static routes, create virtual menu item if not found in database
    const normalizedUserPath = userPath.startsWith('/') ? userPath : `/${userPath}`;
    if (STATIC_ROUTES[normalizedUserPath]) {
      return {
        ...STATIC_ROUTES[normalizedUserPath],
        // Ensure all required fields are present
        id: STATIC_ROUTES[normalizedUserPath].id!,
        title: STATIC_ROUTES[normalizedUserPath].title!,
        path: STATIC_ROUTES[normalizedUserPath].path!.substring(1),
        // Remove leading slash
        page_type: STATIC_ROUTES[normalizedUserPath].page_type!,
        is_active: STATIC_ROUTES[normalizedUserPath].is_active!,
        order_index: STATIC_ROUTES[normalizedUserPath].order_index!,
        created_at: STATIC_ROUTES[normalizedUserPath].created_at!,
        updated_at: STATIC_ROUTES[normalizedUserPath].updated_at!
      } as UserMenuItem;
    }
    return null;
  }, []);

  // Set active menu item
  const setActiveMenuItem = useCallback((item: UserMenuItem | null) => {
    setActiveMenuItemState(item);
  }, []);

  // Navigate to menu item
  const navigateToMenuItem = useCallback((item: UserMenuItem) => {
    setActiveMenuItem(item);
    // Handle static routes (negative IDs) differently from database routes
    if (item.id < 0) {
      // Static routes already have the correct path format
      navigate(`/user${item.path}`, {
        replace: false
      });
    } else {
      // Database routes should not have leading slash
      const cleanPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
      navigate(`/user/${cleanPath}`, {
        replace: false
      });
    }
  }, [navigate, setActiveMenuItem]);

  // Subscription access is provided via props; reactive updates handled higher up

  // Update active menu item when location changes
  useEffect(() => {
    const userPath = location.pathname.replace('/user', '');

    // Handle static routes immediately, even during menu loading
    const normalizedUserPath = userPath.startsWith('/') ? userPath : `/${userPath}`;
    if (STATIC_ROUTES[normalizedUserPath]) {
      const staticMenuItem = findActiveMenuItem(location.pathname, []);
      if (staticMenuItem && staticMenuItem.id !== activeMenuItem?.id) {
        setActiveMenuItem(staticMenuItem);
      }
      return;
    }

    // For dynamic routes, wait for menu items to load
    if (menuItems.length > 0) {
      const activeItem = findActiveMenuItem(location.pathname, menuItems);
      if (activeItem && activeItem.id !== activeMenuItem?.id) {
        setActiveMenuItem(activeItem);
      }
    }
  }, [location.pathname, menuItems, activeMenuItem?.id, findActiveMenuItem, setActiveMenuItem]);
  const contextValue: UserMenuContextState = useMemo(() => ({
    menuItems,
    activeMenuItem,
    menuLoading,
    setActiveMenuItem,
    navigateToMenuItem,
    refreshMenuItems,
    hasAccess
  }), [menuItems, activeMenuItem, menuLoading, hasAccess, navigateToMenuItem, refreshMenuItems, setActiveMenuItem]);
  return <UserMenuContext.Provider value={contextValue}>
      <div data-testid="userMenu_provider_root">{children}</div>
    </UserMenuContext.Provider>;
};
const UserLayout = () => {
  const {
    t,
    lang,
    setLang
  } = useI18n();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const outlet = useOutletContext<UserProtectedOutletContext | null>();
  const hasAccess = outlet?.hasAccess ?? true;
  const ctxUser = outlet?.user ?? null;
  const ctxUiUserProfile = outlet?.uiUserProfile ?? null;
  const subscription = outlet?.subscription ?? null;
  const tariffLimits = outlet?.tariffLimits ?? [];
  const ctxMenuItems = outlet?.menuItems ?? [];
  const refresh = outlet?.refresh ?? (async () => {});
  const bootstrapping = outlet?.bootstrapping === true;
  const contentBlocked = outlet?.contentBlocked === true || outlet?.authLoading === true;
  const contentLoader = outlet?.authLoader ?? { title: "Завантаження…", subtitle: "Готуємо дані" };

  const user: UserProfile = useMemo(() => {
    return (
      ctxUser ?? {
        id: "loading",
        email: "",
        name: "…",
        role: "user",
        status: "active",
        avatar_url: "",
        created_at: "",
        updated_at: "",
      }
    );
  }, [ctxUser]);

  const uiUserProfile: UIUserProfile = useMemo(() => {
    return (
      ctxUiUserProfile ?? {
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url || "",
      }
    );
  }, [ctxUiUserProfile, user.avatar_url, user.email, user.name, user.role]);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/user-auth", { replace: true });
  };
  const handleProfileNavigation = (path: string) => {
    setProfileSheetOpen(false);
    navigate(path);
  };
  const handleLogout = () => {
    setProfileSheetOpen(false);
    signOut();
  };
  const { theme, setTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);
  if (!bootstrapping && !contentBlocked && !ctxUser) {
    return <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access your dashboard.</p>
        </div>
      </div>;
  }
  return <UserMenuProvider userId={user.id} hasAccess={hasAccess} menuItems={ctxMenuItems}>
      <UserLayoutContent user={user} uiUserProfile={uiUserProfile} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} toggleTheme={toggleTheme} lang={lang} setLang={setLang} t={t} profileSheetOpen={profileSheetOpen} setProfileSheetOpen={setProfileSheetOpen} handleProfileNavigation={handleProfileNavigation} handleLogout={handleLogout} refreshUserData={refresh} guardSubscription={subscription} guardTariffLimits={tariffLimits} contentBlocked={contentBlocked} contentLoader={contentLoader} />
    </UserMenuProvider>;
};
const UserLayoutContent = ({
  user,
  uiUserProfile,
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  toggleTheme,
  lang,
  setLang,
  t,
  profileSheetOpen,
  setProfileSheetOpen,
  handleProfileNavigation,
  handleLogout,
  refreshUserData,
  guardSubscription,
  guardTariffLimits,
  contentBlocked,
  contentLoader
}: {
  user: UserProfile;
  uiUserProfile: UIUserProfile;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleTheme: () => void;
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
  profileSheetOpen: boolean;
  setProfileSheetOpen: (open: boolean) => void;
  handleProfileNavigation: (path: string) => void;
  handleLogout: () => void;
  refreshUserData: () => Promise<void>;
  guardSubscription: { hasValidSubscription: boolean; subscription: SubscriptionEntity | null; isDemo: boolean } | null;
  guardTariffLimits: TariffLimit[];
  contentBlocked: boolean;
  contentLoader: AuthLoaderMeta;
}) => {
  const {
    menuItems,
    menuLoading,
    activeMenuItem,
    navigateToMenuItem,
    refreshMenuItems,
    hasAccess
  } = useUserMenu();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const applyCollapse = () => {
      const w = window.innerWidth;
      setSidebarCollapsed(w <= 1393);
    };
    applyCollapse();
    window.addEventListener('resize', applyCollapse);
    return () => window.removeEventListener('resize', applyCollapse);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    if (contentBlocked) return;
    const hasValid = guardSubscription?.hasValidSubscription ?? true;
    const path = location.pathname.toLowerCase();
    const isTariffPage = path.startsWith("/user/tariff");
    const isDashboardPage =
      path === "/user/dashboard" ||
      path === "/user" ||
      path === "/user/";
    const isShopsPage = path.startsWith("/user/shops");
    if (!hasValid && !isTariffPage && !isDashboardPage && !isShopsPage) {
      navigate("/user/tariff", { replace: true });
    }
  }, [contentBlocked, guardSubscription?.hasValidSubscription, location.pathname, navigate]);

  const staticMenuItems = useMemo<UserMenuItem[]>(() => {
    const existingPaths = new Set(
      menuItems.map(item =>
        item.path.startsWith("/") ? item.path : `/${item.path}`,
      ),
    );
    const now = new Date().toISOString();
    return Object.entries(STATIC_ROUTES)
      .filter(([path]) => !existingPaths.has(path))
      .map(([path, cfg]) => ({
        id: cfg.id ?? 0,
        user_id: "static",
        title: cfg.title ?? "",
        path: (cfg.path ?? path).replace(/^\//, ""),
        parent_id: cfg.parent_id,
        order_index: cfg.order_index ?? 0,
        is_active: cfg.is_active ?? true,
        page_type: cfg.page_type ?? "content",
        content_data: cfg.content_data ?? {},
        template_name: cfg.template_name,
        meta_data: cfg.meta_data,
        icon_name: cfg.icon_name,
        description: cfg.description,
        created_at: cfg.created_at ?? now,
        updated_at: cfg.updated_at ?? now,
      }));
  }, [menuItems]);

  const effectiveMenuItems = useMemo(
    () => [...staticMenuItems, ...menuItems],
    [staticMenuItems, menuItems],
  );

  const menuSections = useMemo(
    () => [
      {
        key: "main",
        titleKey: "menu_main",
        items: effectiveMenuItems.filter(item => !item.parent_id),
        isCollapsible: false,
      },
    ],
    [effectiveMenuItems],
  );

  // Handle menu item click
  const handleMenuClick = (item: UserMenuItem) => {
    navigateToMenuItem(item);
    // Close mobile menu after navigation
    setMobileMenuOpen(false);
  };

  // Check if item is active
  const isActiveItem = (item: UserMenuItem) => {
    // For static routes, compare with the full path
    if (item.id < 0) {
      // Static routes have negative IDs
      return activeMenuItem?.id === item.id || location.pathname === `/user${item.path}`;
    }
    // For database routes, compare with the path without leading slash
    return activeMenuItem?.id === item.id || location.pathname === `/user/${item.path}`;
  };
  return <div className="min-h-screen bg-background dark:bg-neutral-950 flex">
      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 flex flex-col h-full">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            {/* Logo/Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">UG</span>
                </div>
                <span className="font-semibold text-lg">UserGrow</span>
              </div>
            </div>

            {/* Navigation - Scrollable */}
            <nav className="space-y-1 flex-1 overflow-y-auto">
              {menuLoading ? null : <>
                  {menuSections.map((section, sectionIndex) => {
                if (!section.items.length) return null;
                return <div key={section.key}>
                        {sectionIndex > 0 && <div className="py-2">
                            <div className="border-t border-gray-200" />
                          </div>}
                        
                        <MenuSection title={section.key === 'main' ? undefined : t(section.titleKey as string)} type={section.key === 'main' ? 'main' : 'settings'} items={section.items} collapsed={false} isCollapsible={section.isCollapsible} children={effectiveMenuItems.filter(item => section.items.some(parent => parent.id === item.parent_id))} onItemClick={handleMenuClick} isActiveItem={isActiveItem} buildTree={buildTree} hasAccess={hasAccess} />
                      </div>;
              })}
                </>}
            </nav>

            {/* User Menu - Mobile (Fixed at bottom) */}
            <div className="pt-4 border-t shrink-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleLogout} className="focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* User Sidebar - Desktop - Fixed Position */}
      <aside className={`hidden md:flex max-[1393px]:hidden ${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 shrink-0 border-r bg-background flex-col fixed left-0 top-0 h-screen z-40 overflow-hidden`}>
        <div className="p-4 shrink-0">
          {/* Logo/Header */}
          <div className="flex items-center justify-between mb-6">
          {sidebarCollapsed ? (
            <div className="flex items-center justify-center w-full">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">UG</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">UG</span>
              </div>
              <span className="font-semibold text-lg">UserGrow</span>
            </div>
          )}
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="space-y-1 flex-1 overflow-y-auto px-4">
          {menuLoading ? null : <>
              {menuSections.map((section, sectionIndex) => {
            if (!section.items.length) return null;
            return <div key={section.key}>
                    {/* Section separator */}
                    {sectionIndex > 0 && <div className="py-2">
                        <div className="border-t border-gray-200" />
                      </div>}
                    
                    <MenuSection title={section.key === 'main' ? undefined : sidebarCollapsed ? undefined : t(section.titleKey as string)} type={section.key === 'main' ? 'main' : 'settings'} items={section.items} collapsed={sidebarCollapsed} isCollapsible={section.isCollapsible} children={effectiveMenuItems.filter(item => section.items.some(parent => parent.id === item.parent_id))} onItemClick={handleMenuClick} isActiveItem={isActiveItem} buildTree={buildTree} hasAccess={hasAccess} />
                  </div>;
          })}
            </>}
        </nav>

        {/* User Menu - Desktop (Fixed at bottom) */}
        <div className="p-4 shrink-0">
          {sidebarCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full" title={user.name}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url} alt={user.name} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} className="focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={user.avatar_url} alt={user.name} />
                <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleLogout} className="focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area - Adjusted for fixed sidebar */}
      <div className={`flex-1 min-w-0 flex flex-col ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'} max-[1393px]:ml-0 transition-all duration-300`}>
        {/* Header */}
        <header className="h-16 bg-background flex items-center px-4 md:px-6 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => {
            if (window.innerWidth < 768) {
              setMobileMenuOpen(!mobileMenuOpen);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }} className="md:inline-flex">
              <AlignJustify className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-transparent cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400">
              <Sun className="h-5 w-5 hidden dark:block" />
              <Moon className="h-5 w-5 block dark:hidden" />
            </Button>
            
            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-transparent cursor-pointer" title={lang === "uk" ? "Українська" : "English"}>
                  <span className="text-lg">{lang === "uk" ? "🇺🇦" : "🇺🇸"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLang("uk")}>🇺🇦 Українська</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang("en")}>🇺🇸 English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Profile */}
            <SheetNoOverlay open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
              <SheetNoOverlayTrigger asChild>
                <ProfileTrigger userProfile={uiUserProfile} position="header" onClick={() => setProfileSheetOpen(true)} />
              </SheetNoOverlayTrigger>
              <SheetNoOverlayContent side="right" className="w-96">
                <SheetNoOverlayHeader>
                  <SheetNoOverlayTitle>{t("user_profile")}</SheetNoOverlayTitle>
                </SheetNoOverlayHeader>
                <ProfileSheetContent userProfile={uiUserProfile} onNavigate={handleProfileNavigation} onLogout={handleLogout} onClose={() => setProfileSheetOpen(false)} />
              </SheetNoOverlayContent>
            </SheetNoOverlay>
          </div>
        </header>

        {/* Content - Scrollable */}
        <main className="flex-1 overflow-y-auto bg-background dark:bg-neutral-950">
          <div className="h-full">
            {contentBlocked ? (
              <ProgressiveLoader
                isLoading={true}
                delay={250}
                fallback={<FullPageLoader title={contentLoader.title} subtitle={contentLoader.subtitle} icon={contentLoader.icon} />}
              >
                {null}
              </ProgressiveLoader>
            ) : (
              <Outlet context={{
                user,
                menuItems,
                onMenuUpdate: refreshMenuItems,
                refetch: refreshUserData,
                subscription: guardSubscription,
                tariffLimits: guardTariffLimits
              }} />
            )}
          </div>
        </main>
      </div>
    </div>;
};
export default UserLayout;
