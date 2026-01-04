import React, { Suspense, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdmin } from '@/providers/admin-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NotFoundFallback } from '@/components/NotFoundFallback';
import ErrorBoundary from '@/components/ErrorBoundary';
import { FullPageLoader, ProgressiveLoader } from '@/components/LoadingSkeletons';
import { DynamicIcon } from "@/components/ui/dynamic-icon";

// Import page components
import { ContentRenderer } from '@/pages/ContentRenderer';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminPersonal from '@/pages/AdminPersonal';
import FormsElements from '@/pages/admin/FormsElements';
import FormsLayouts from '@/pages/admin/FormsLayouts';
import FormsHorizontal from '@/pages/admin/FormsHorizontal';
import FormsVertical from '@/pages/admin/FormsVertical';
import FormsCustom from '@/pages/admin/FormsCustom';
import FormValidation from '@/pages/admin/FormValidation';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import CurrencyManagement from '@/pages/admin/settings/CurrencyManagement';
import AdminTariffManagement from '@/pages/admin/AdminTariffManagement';
import AdminTariffFeatures from '@/pages/admin/AdminTariffFeatures';
import AdminTariffNew from '@/pages/admin/AdminTariffNew';
import AdminTariffEdit from '@/pages/admin/AdminTariffEdit';
import AdminUserDetails from '@/pages/admin/AdminUserDetails';
import { StoreTemplates } from '@/pages/admin/StoreTemplates';
import { LimitTemplates } from '@/pages/admin/LimitTemplates';

// Error display component
const ContentError = ({ error }: { error: string }) => (
  <div className="p-4 md:p-6">
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  </div>
);

// Component map for static routes
const STATIC_COMPONENTS: Record<string, React.ComponentType> = {
  '/dashboard': AdminDashboard,
  '/personal': AdminPersonal,
  '/forms/elements': FormsElements,
  '/forms/layouts': FormsLayouts,
  '/forms/horizontal': FormsHorizontal,
  '/forms/vertical': FormsVertical,
  '/forms/custom': FormsCustom,
  '/forms/validation': FormValidation,
  '/users': AdminUsersPage,
  '/settings/currency': CurrencyManagement,
  '/settings/limits': LimitTemplates,
  '/tariff': AdminTariffManagement,
  '/tariff/features': AdminTariffFeatures,
  '/tariff/new': AdminTariffNew,
  '/storetemplates': StoreTemplates,
};

const ContentWorkspace: React.FC = () => {
  const location = useLocation();
  const { 
    activeMenuItem, 
    contentLoading, 
    contentError, 
    menuLoading,
    menuItems,
    clearContentError 
  } = useAdmin();

  // Get the current admin path (remove /admin prefix)
  const adminPath = useMemo(() => {
    return location.pathname.replace('/admin', '');
  }, [location.pathname]);

  // Check if the active item has children (is a parent item)
  const isParentItem = useMemo(() => {
    if (!activeMenuItem) return false;
    return menuItems.some(item => item.parent_id === activeMenuItem.id);
  }, [activeMenuItem, menuItems]);

  // Determine content skeleton type based on active menu item and route
  const loaderMeta = useMemo(() => {
    const itemTitle = String(activeMenuItem?.title || "").trim();
    const title = itemTitle ? "Завантаження сторінки…" : "Завантаження…";
    const subtitle = itemTitle || undefined;

    if (activeMenuItem?.icon_name) {
      return { title, subtitle, iconName: String(activeMenuItem.icon_name) };
    }

    if (adminPath === "/dashboard") return { title, subtitle, iconName: "layout-dashboard" };
    if (adminPath === "/users") return { title, subtitle, iconName: "users" };
    if (adminPath.startsWith("/forms/")) return { title, subtitle, iconName: "form-input" };
    if (adminPath === "/settings/currency") return { title, subtitle, iconName: "dollar-sign" };
    if (adminPath === "/settings/limits") return { title, subtitle, iconName: "sliders" };
    if (adminPath === "/tariff" || adminPath.startsWith("/tariff/")) return { title, subtitle, iconName: "credit-card" };
    if (adminPath === "/storetemplates") return { title, subtitle, iconName: "file-code" };
    return { title, subtitle, iconName: "FileText" };
  }, [activeMenuItem?.icon_name, activeMenuItem?.title, adminPath]);

  const LoaderIcon = useMemo(() => {
    const iconName = loaderMeta.iconName;
    return ({ className }: { className?: string }) => (
      <DynamicIcon name={iconName} className={className} />
    );
  }, [loaderMeta.iconName]);

  const ContentComponent = useMemo(() => {
    // Check for static components first
    if (STATIC_COMPONENTS[adminPath]) {
      return STATIC_COMPONENTS[adminPath];
    }
    
    // Handle dynamic routes with parameters
    if (adminPath.startsWith('/tariff/edit/')) {
      return AdminTariffEdit;
    }
    
    // Handle user details route
    if (adminPath.startsWith('/users/')) {
      return AdminUserDetails;
    }
    
    // For dynamic menu items, return null to render via ContentRenderer
    return null;
  }, [adminPath]);

  // Handle errors
  if (contentError) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{contentError}</AlertDescription>
        </Alert>
        <button 
          onClick={clearContentError}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Render static component immediately (don't wait for menu loading for core admin routes)
  if (ContentComponent) {
    return (
      <ErrorBoundary>
        <ProgressiveLoader
          isLoading={contentLoading}
          fallback={<FullPageLoader title={loaderMeta.title} subtitle={loaderMeta.subtitle} icon={LoaderIcon} />}
          delay={50}
        >
          <ContentComponent />
        </ProgressiveLoader>
      </ErrorBoundary>
    );
  }

  // Handle loading states for dynamic content only
  if (menuLoading && !ContentComponent) {
    return (
      <FullPageLoader title={loaderMeta.title} subtitle={loaderMeta.subtitle} icon={LoaderIcon} />
    );
  }

  // If active item is a parent item with children, show a message
  if (activeMenuItem && isParentItem) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-muted/50 border rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">
            Please Select a Submenu Item
          </h2>
          <p className="text-muted-foreground">
            This menu item contains sub-items. Please select one of the sub-items from the sidebar to view its content.
          </p>
        </div>
      </div>
    );
  }

  // Render dynamic content using ContentRenderer
  if (activeMenuItem) {
    return (
      <ErrorBoundary>
        <ProgressiveLoader
          isLoading={contentLoading}
          fallback={<FullPageLoader title={loaderMeta.title} subtitle={loaderMeta.subtitle} icon={LoaderIcon} />}
          delay={50}
        >
          <div className="p-4 md:p-6">
            <ContentRenderer menuItem={activeMenuItem} />
          </div>
        </ProgressiveLoader>
      </ErrorBoundary>
    );
  }

  // Show not found only if menu has finished loading and no match found
  // This prevents premature "not found" during initialization
  return (
    <div className="h-full overflow-auto">
      <NotFoundFallback 
        title="Page Not Found"
        description={`The admin page "${adminPath}" could not be found.`}
        suggestions={[
          "Check if the page exists in the menu",
          "Verify you have permission to access this page",
          "Try navigating from the sidebar menu",
          "Contact your administrator if the problem persists"
        ]}
      />
    </div>
  );
};

export default ContentWorkspace;
