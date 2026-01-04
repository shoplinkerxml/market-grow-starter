import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { BreadcrumbItem } from "@/components/ui/breadcrumb";

// Route mapping for breadcrumb labels
const ADMIN_ROUTE_MAPPING: Record<string, { labelKey: string; parentPath?: string }> = {
  "/admin": { labelKey: "breadcrumb_dashboard" },
  "/admin/dashboard": { labelKey: "breadcrumb_dashboard", parentPath: "/admin" },
  "/admin/personal": { labelKey: "breadcrumb_personal", parentPath: "/admin" },
  "/admin/users": { labelKey: "breadcrumb_users", parentPath: "/admin" },
  "/admin/tariff": { labelKey: "menu_pricing", parentPath: "/admin" },
  "/admin/tariff/new": { labelKey: "create_new_tariff", parentPath: "/admin/tariff" },
  "/admin/tariff/edit/:id": { labelKey: "edit_tariff", parentPath: "/admin/tariff" },
  "/admin/tariff/features": { labelKey: "tariff_features_and_limits", parentPath: "/admin/tariff" },
  "/admin/storetemplates": { labelKey: "menu_store_templates", parentPath: "/admin" },
  "/admin/settings/currencies": { labelKey: "currency_management", parentPath: "/admin" },
  "/admin/settings/currency": { labelKey: "currency_management", parentPath: "/admin" },
  "/admin/settings/limits": { labelKey: "limits_title", parentPath: "/admin" },
  "/admin/forms": { labelKey: "breadcrumb_forms", parentPath: "/admin" },
  "/admin/forms/elements": { labelKey: "breadcrumb_elements", parentPath: "/admin/forms" },
  "/admin/forms/layouts": { labelKey: "breadcrumb_layouts", parentPath: "/admin/forms" },
  "/admin/forms/horizontal": { labelKey: "breadcrumb_horizontal", parentPath: "/admin/forms" },
  "/admin/forms/vertical": { labelKey: "breadcrumb_vertical", parentPath: "/admin/forms" },
  "/admin/forms/custom": { labelKey: "breadcrumb_custom", parentPath: "/admin/forms" },
  "/admin/forms/validation": { labelKey: "breadcrumb_validation", parentPath: "/admin/forms" },
  "/admin/settings": { labelKey: "breadcrumb_settings", parentPath: "/admin" },
};

const USER_ROUTE_MAPPING: Record<string, { labelKey: string; parentPath?: string }> = {
  "/user": { labelKey: "breadcrumb_dashboard" },
  "/user/dashboard": { labelKey: "breadcrumb_dashboard", parentPath: "/user" },
  "/user/profile": { labelKey: "breadcrumb_personal", parentPath: "/user" },
  "/user/settings": { labelKey: "breadcrumb_settings", parentPath: "/user" },
  "/user/tariff": { labelKey: "menu_pricing", parentPath: "/user" },
  "/user/suppliers": { labelKey: "menu_suppliers", parentPath: "/user" },
  "/user/shops": { labelKey: "shops_title", parentPath: "/user" },
  "/user/products": { labelKey: "products_title", parentPath: "/user" },
  "/user/Products": { labelKey: "products_title", parentPath: "/user" },
  "/user/products/new-product": { labelKey: "create_product", parentPath: "/user/products" },
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const { t } = useI18n();

  return useMemo(() => {
    const path = location.pathname;
    const isUserPath = path.startsWith("/user");
    const ROUTE_MAPPING = isUserPath ? USER_ROUTE_MAPPING : ADMIN_ROUTE_MAPPING;
    
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with home
    breadcrumbs.push({
      label: t("breadcrumb_home"),
      href: isUserPath ? "/user/dashboard" : "/admin/dashboard",
    });

    // Find the route in our mapping
    const route = ROUTE_MAPPING[path];
    if (!route) {
      // Handle dynamic admin tariff edit paths like /admin/tariff/edit/123
      if (path.startsWith("/admin/tariff/edit/")) {
        // Add Home -> Tariffs -> Tariff Name
        breadcrumbs.push({
          label: t("menu_pricing"),
          href: "/admin/tariff",
        });
        
        // Extract tariff ID and add as current page
        const tariffId = path.split("/").pop();
        breadcrumbs.push({
          label: `${t('edit_tariff')}`,
          current: true,
        });
        return breadcrumbs;
      }
      // Handle dynamic user shop detail paths like /user/shops/uuid
      if (isUserPath && path.startsWith("/user/shops/") && path.split("/").length === 4) {
        // Add Home -> Shops
        breadcrumbs.push({
          label: t("shops_title"),
          href: "/user/shops",
        });
        // Shop name will be added by the ShopDetail component itself
        return breadcrumbs;
      }
      // Handle dynamic user menu paths
      if (isUserPath && path.startsWith("/user/")) {
        // Extract the dynamic part
        const dynamicPath = path.substring(5); // Remove "/user"
        const segments = dynamicPath.split("/").filter(Boolean);
        
        if (segments.length > 0) {
          // For user content paths like /user/content/123
          if (segments[0] === "content" && segments.length > 1) {
            breadcrumbs.push({
              label: t("menu_content"),
              href: "/user/content",
            });
            breadcrumbs.push({
              label: segments[1],
              current: true,
            });
            return breadcrumbs;
          }
          
          // For user dynamic menu paths like /user/reports, /user/tariff, etc.
          if (segments.length === 1) {
            // Capitalize first letter
            const label = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
            breadcrumbs.push({
              label,
              current: true,
            });
            return breadcrumbs;
          }
          
          // For nested paths
          segments.forEach((segment, index) => {
            const isLast = index === segments.length - 1;
            const fullPath = "/user/" + segments.slice(0, index + 1).join("/");
            
            breadcrumbs.push({
              label: segment.charAt(0).toUpperCase() + segment.slice(1),
              href: isLast ? undefined : fullPath,
              current: isLast,
            });
          });
          return breadcrumbs;
        }
      }
      
      // If route not found and not a handled dynamic path, show the path as is
      const segments = path.split("/").filter(Boolean);
      if (segments.length > 1) {
        breadcrumbs.push({
          label: segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1),
          current: true,
        });
      }
      return breadcrumbs;
    }

    // Build breadcrumb chain
    const buildChain = (currentPath: string): void => {
      const currentRoute = ROUTE_MAPPING[currentPath];
      if (!currentRoute) return;

      // Add parent first (recursive)
      if (currentRoute.parentPath && currentRoute.parentPath !== (isUserPath ? "/user" : "/admin")) {
        buildChain(currentRoute.parentPath);
      }

      // Add current route
      if (currentPath !== (isUserPath ? "/user" : "/admin")) {
        breadcrumbs.push({
          label: t(currentRoute.labelKey as any),
          href: currentPath === path ? undefined : currentPath,
          current: currentPath === path,
        });
      }
    };

    buildChain(path);

    return breadcrumbs;
  }, [location.pathname, t]);
}

export function usePageInfo() {
  const location = useLocation();
  const { t } = useI18n();

  return useMemo(() => {
    const path = location.pathname;
    const isUserPath = path.startsWith("/user");
    const ROUTE_MAPPING = isUserPath ? USER_ROUTE_MAPPING : ADMIN_ROUTE_MAPPING;
    const route = ROUTE_MAPPING[path];

    if (!route) {
      // Handle dynamic user menu paths
      if (isUserPath && path.startsWith("/user/")) {
        const dynamicPath = path.substring(5); // Remove "/user"
        const segments = dynamicPath.split("/").filter(Boolean);
        
        if (segments.length > 0) {
          // For user content paths like /user/content/123
          if (segments[0] === "content" && segments.length > 1) {
            return {
              title: segments[1],
              description: t("menu_content"),
            };
          }
          
          // For user dynamic menu paths like /user/reports, /user/tariff, etc.
          if (segments.length === 1) {
            const title = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
            return {
              title,
              description: undefined,
            };
          }
          
          // For nested paths, use the last segment as title
          const title = segments[segments.length - 1].charAt(0).toUpperCase() + segments[segments.length - 1].slice(1);
          return {
            title,
            description: undefined,
          };
        }
      }
      
      const segments = path.split("/").filter(Boolean);
      return {
        title: segments[segments.length - 1]?.charAt(0).toUpperCase() + segments[segments.length - 1]?.slice(1) || "Page",
        description: undefined,
      };
    }

    // Get page-specific info
    switch (path) {
      case "/admin/users":
      case "/user/users":
        return {
          title: t("users_title"),
          description: t("users_subtitle"),
        };
      case "/admin/personal":
      case "/user/profile":
        return {
          title: t("user_profile_title"),
          description: t("menu_profile_desc"),
        };
      case "/admin/dashboard":
      case "/user/dashboard":
        return {
          title: t("breadcrumb_dashboard"),
          description: undefined,
        };
      case "/admin/settings/currency":
      case "/admin/settings/currencies":
        return {
          title: t("currency_management"),
          description: t("currency_management_description"),
        };
      case "/admin/tariff/new":
        return {
          title: t("create_new_tariff"),
          description: t("create_tariff_description"),
        };
      case "/user/suppliers":
        return {
          title: t("suppliers_title"),
          description: t("suppliers_description"),
        };
      case "/user/shops":
        return {
          title: t("shops_title"),
          description: t("shops_description"),
        };
      case "/user/products":
      case "/user/Products":
        return {
          title: t("products_title"),
          description: t("products_description"),
        };
      case "/admin/settings/limits":
        return {
          title: t("limits_title"),
          description: t("limits_description"),
        };
      default:
        return {
          title: t(route.labelKey as any),
          description: undefined,
        };
    }
  }, [location.pathname, t]);
}
