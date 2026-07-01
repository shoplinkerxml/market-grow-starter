import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenuService, type UserMenuItem } from "@/lib/user-menu-service";
import { UserMenuContext, type UserMenuContextState } from "@/components/user-layout/user-menu-store";

type StaticRouteConfig = {
  id: number;
  title: string;
  path: string;
  page_type: UserMenuItem["page_type"];
  order_index: number;
  icon_name?: string;
};

const STATIC_ROUTES: StaticRouteConfig[] = [
  {
    id: -1,
    title: "Dashboard",
    path: "dashboard",
    page_type: "dashboard",
    order_index: 0,
    icon_name: "layout-dashboard",
  },
  {
    id: -3,
    title: "Тарифні плани",
    path: "tariff",
    page_type: "content",
    order_index: 2,
    icon_name: "credit-card",
  },
  {
    id: -4,
    title: "Імпорт XML",
    path: "xml-imports",
    page_type: "list",
    order_index: 4.5,
    icon_name: "file-code",
  },
];

function normalizeItemPath(path: string): string {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/^user\/?/, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function normalizeLocationPath(pathname: string): string {
  return String(pathname || "")
    .replace(/^\/user\/?/, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function isPathMatch(current: string, candidate: string): boolean {
  if (!candidate) return false;
  return current === candidate || current.startsWith(`${candidate}/`);
}

function getStaticMenuItems(existing: UserMenuItem[]): UserMenuItem[] {
  const existingPaths = new Set(existing.map((it) => normalizeItemPath(it.path)));
  const now = new Date().toISOString();

  return STATIC_ROUTES.filter((cfg) => !existingPaths.has(cfg.path)).map((cfg) => {
    return {
      id: cfg.id,
      user_id: "static",
      title: cfg.title,
      path: cfg.path,
      parent_id: null,
      order_index: cfg.order_index,
      is_active: true,
      page_type: cfg.page_type,
      content_data: {},
      template_name: null,
      meta_data: null,
      icon_name: cfg.icon_name ?? null,
      description: null,
      created_at: now,
      updated_at: now,
    };
  });
}

export const UserMenuProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
  hasAccess: boolean;
  menuItems: UserMenuItem[];
}> = ({ children, userId, hasAccess, menuItems: menuItemsFromAuthMe }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeMenuItem, setActiveMenuItemState] = useState<UserMenuItem | null>(null);
  const [menuItemsRaw, setMenuItemsRaw] = useState<UserMenuItem[]>(Array.isArray(menuItemsFromAuthMe) ? menuItemsFromAuthMe : []);

  useEffect(() => {
    if (!Array.isArray(menuItemsFromAuthMe)) return;
    setMenuItemsRaw(menuItemsFromAuthMe);
  }, [menuItemsFromAuthMe]);

  const menuLoading = false;

  const menuItemsDb: UserMenuItem[] = useMemo(() => {
    let items = Array.isArray(menuItemsRaw) ? menuItemsRaw : [];
    items = items.filter((i) => i && typeof i === "object");
    items = items.filter((i) => (i.user_id ? String(i.user_id) === String(userId) : true));
    items = items.filter((i) => i && typeof i.title === "string" && typeof i.path === "string");
    items = items.filter((i) => (i && typeof i.is_active === "boolean" ? i.is_active === true : true));
    return items.map((item) => {
      const title = String(item.title || "").toLowerCase();
      const path = String(item.path || "").toLowerCase();
      const needsAutoIcon =
        (!item.icon_name || item.icon_name === "circle" || item.icon_name === "Circle") &&
        (title.includes("supplier") ||
          title.includes("постачальник") ||
          title.includes("shop") ||
          title.includes("магазин") ||
          title.includes("payment") ||
          title.includes("платеж") ||
          title.includes("довідник") ||
          title.includes("directory") ||
          title.includes("reference") ||
          path.includes("supplier") ||
          path.includes("постачальник") ||
          path.includes("shop") ||
          path.includes("магазин") ||
          path.includes("payment") ||
          path.includes("платеж") ||
          path.includes("dovid") ||
          path.includes("directory") ||
          path.includes("reference"));
      if (!needsAutoIcon) return item;
      return { ...item, icon_name: UserMenuService.getAutoIconForMenuItem({ title: item.title, path: item.path }) };
    });
  }, [menuItemsRaw, userId]);

  const menuItems: UserMenuItem[] = useMemo(() => {
    const staticItems = getStaticMenuItems(menuItemsDb);
    return [...staticItems, ...menuItemsDb];
  }, [menuItemsDb]);

  const refreshMenuItems = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["auth", "me"], exact: true });
  }, [queryClient]);

  const findActiveMenuItem = useCallback((pathname: string, items: UserMenuItem[]) => {
    const current = normalizeLocationPath(pathname);
    let best: UserMenuItem | null = null;
    let bestLen = -1;
    for (const item of items) {
      const candidate = normalizeItemPath(item.path);
      if (isPathMatch(current, candidate) && candidate.length > bestLen) {
        best = item;
        bestLen = candidate.length;
      }
    }
    return best;
  }, []);

  const setActiveMenuItem = useCallback((item: UserMenuItem | null) => {
    setActiveMenuItemState(item);
  }, []);

  const navigateToMenuItem = useCallback(
    (item: UserMenuItem) => {
      setActiveMenuItem(item);
      const cleanPath = normalizeItemPath(item.path);
      const target = `/user/${cleanPath}`;
      if (location.pathname === target) return;
      navigate(target, { replace: false });
    },
    [location.pathname, navigate, setActiveMenuItem],
  );

  useEffect(() => {
    if (!menuItems.length) {
      setActiveMenuItem(null);
      return;
    }
    const activeItem = findActiveMenuItem(location.pathname, menuItems);
    if (activeItem?.id !== activeMenuItem?.id) {
      setActiveMenuItem(activeItem);
    }
  }, [activeMenuItem?.id, findActiveMenuItem, location.pathname, menuItems, setActiveMenuItem]);

  const contextValue: UserMenuContextState = useMemo(
    () => ({
      menuItems,
      activeMenuItem,
      menuLoading,
      setActiveMenuItem,
      navigateToMenuItem,
      refreshMenuItems,
      hasAccess,
    }),
    [activeMenuItem, hasAccess, menuItems, menuLoading, navigateToMenuItem, refreshMenuItems, setActiveMenuItem],
  );

  return <UserMenuContext.Provider value={contextValue}>{children}</UserMenuContext.Provider>;
};
