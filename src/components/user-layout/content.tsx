import { useCallback, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUserMenu } from "@/components/user-layout/user-menu-store";
import type { AuthLoaderMeta, MenuSectionModel, SubscriptionEntity } from "@/components/user-layout/types";
import type { TariffLimit } from "@/lib/tariff-service";
import type { UserProfile } from "@/lib/user-auth-schemas";
import type { UserProfile as UIUserProfile } from "@/components/ui/profile-types";
import { DesktopSidebar, MobileMenuSheet } from "@/components/user-layout/sidebar";
import { UserHeader } from "@/components/user-layout/header";
import { FullPageLoader, ProgressiveLoader } from "@/components/LoadingSkeletons";
import type { UserMenuItem } from "@/lib/user-menu-service";
import { useCountersRealtime } from "@/hooks/useCountersRealtime";
import { useUserStoresRealtime } from "@/hooks/useUserStoresRealtime";

function normalizeItemPath(path: string): string {
  return String(path || "").replace(/^\/+/, "");
}

function useAutoCollapseSidebar(setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>): void {
  useEffect(() => {
    const applyCollapse = () => {
      const w = window.innerWidth;
      setSidebarCollapsed(w <= 1393);
    };
    applyCollapse();
    window.addEventListener("resize", applyCollapse);
    return () => window.removeEventListener("resize", applyCollapse);
  }, [setSidebarCollapsed]);
}

function useSubscriptionRedirect(args: {
  contentBlocked: boolean;
  hasValidSubscription: boolean;
  pathname: string;
  navigate: ReturnType<typeof useNavigate>;
}): void {
  const { contentBlocked, hasValidSubscription, pathname, navigate } = args;
  useEffect(() => {
    if (contentBlocked) return;
    if (hasValidSubscription) return;
    const path = pathname.toLowerCase();
    const isTariffPage = path.startsWith("/user/tariff");
    const isDashboardPage = path === "/user/dashboard" || path === "/user" || path === "/user/";
    const isShopsPage = path.startsWith("/user/shops");
    if (!isTariffPage && !isDashboardPage && !isShopsPage) {
      navigate("/user/tariff", { replace: true });
    }
  }, [contentBlocked, hasValidSubscription, navigate, pathname]);
}

function isActivePath(currentPath: string, itemPath: string): boolean {
  const cleanItem = normalizeItemPath(itemPath);
  const current = String(currentPath || "");
  const expected = `/user/${cleanItem}`;
  if (current === expected || current.startsWith(`${expected}/`)) return true;
  const currentLower = current.toLowerCase();
  const expectedLower = expected.toLowerCase();
  return currentLower === expectedLower || currentLower.startsWith(`${expectedLower}/`);
}

export const UserLayoutContent = ({
  user,
  uiUserProfile,
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  profileSheetOpen,
  setProfileSheetOpen,
  toggleTheme,
  lang,
  setLang,
  t,
  handleProfileNavigation,
  handleLogout,
  refreshUserData,
  guardSubscription,
  guardTariffLimits,
  contentBlocked,
  contentLoader,
}: {
  user: UserProfile;
  uiUserProfile: UIUserProfile;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profileSheetOpen: boolean;
  setProfileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleTheme: () => void;
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
  handleProfileNavigation: (path: string) => void;
  handleLogout: () => void;
  refreshUserData: () => Promise<void>;
  guardSubscription: { hasValidSubscription: boolean; subscription: SubscriptionEntity | null; isDemo: boolean } | null;
  guardTariffLimits: TariffLimit[];
  contentBlocked: boolean;
  contentLoader: AuthLoaderMeta;
}) => {
  const { menuItems, menuLoading, activeMenuItem, navigateToMenuItem, refreshMenuItems, hasAccess } = useUserMenu();
  const location = useLocation();
  const navigate = useNavigate();

  // Realtime sync (tabs/devices)
  useCountersRealtime(user?.id);
  useUserStoresRealtime(user?.id);

  useAutoCollapseSidebar(setSidebarCollapsed);
  useSubscriptionRedirect({
    contentBlocked,
    hasValidSubscription: guardSubscription?.hasValidSubscription ?? true,
    pathname: location.pathname,
    navigate,
  });

  const menuSections: MenuSectionModel[] = useMemo(
    () => [
      {
        key: "main",
        titleKey: "menu_main",
        items: menuItems.filter((item) => !item.parent_id),
        isCollapsible: false,
      },
    ],
    [menuItems],
  );

  const handleMenuClick = useCallback(
    (item: UserMenuItem) => {
      navigateToMenuItem(item);
      setMobileMenuOpen(false);
    },
    [navigateToMenuItem, setMobileMenuOpen],
  );

  const isActiveItem = useCallback(
    (item: UserMenuItem) => {
      if (activeMenuItem?.id === item.id) return true;
      return isActivePath(location.pathname, item.path);
    },
    [activeMenuItem?.id, location.pathname],
  );

  const mainOffsetClass = useMemo(() => {
    return `${sidebarCollapsed ? "md:ml-16" : "md:ml-64"} max-[1393px]:ml-0 transition-all duration-300`;
  }, [sidebarCollapsed]);

  const outletContextValue = useMemo(
    () => ({
      user,
      menuItems,
      onMenuUpdate: refreshMenuItems,
      refetch: refreshUserData,
      subscription: guardSubscription,
      tariffLimits: guardTariffLimits,
      sidebarCollapsed,
    }),
    [guardSubscription, guardTariffLimits, menuItems, refreshMenuItems, refreshUserData, user, sidebarCollapsed],
  );

  return (
    <div className="h-screen bg-background dark:bg-neutral-950 flex overflow-hidden">
      <MobileMenuSheet
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        t={t}
        menuLoading={menuLoading}
        menuSections={menuSections}
        menuItems={menuItems}
        onMenuClick={handleMenuClick}
        isActiveItem={isActiveItem}
        hasAccess={hasAccess}
        user={user}
        onLogout={handleLogout}
      />

      <DesktopSidebar
        collapsed={sidebarCollapsed}
        t={t}
        menuLoading={menuLoading}
        menuSections={menuSections}
        menuItems={menuItems}
        onMenuClick={handleMenuClick}
        isActiveItem={isActiveItem}
        hasAccess={hasAccess}
        user={user}
        onLogout={handleLogout}
      />

      <div className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${mainOffsetClass}`}>
        <UserHeader
          setSidebarCollapsed={setSidebarCollapsed}
          setMobileMenuOpen={setMobileMenuOpen}
          toggleTheme={toggleTheme}
          lang={lang}
          setLang={setLang}
          t={t}
          uiUserProfile={uiUserProfile}
          profileSheetOpen={profileSheetOpen}
          setProfileSheetOpen={setProfileSheetOpen}
          onNavigateProfile={handleProfileNavigation}
          onLogout={handleLogout}
        />

        <main className="flex-1 min-h-0 overflow-y-auto bg-background dark:bg-neutral-950 scrollbar-unified">
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
              <Outlet context={outletContextValue} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
