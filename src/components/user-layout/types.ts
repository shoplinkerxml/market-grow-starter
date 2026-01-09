import type { ComponentType } from "react";
import type { UserMenuItem } from "@/lib/user-menu-service";
import type { UserProfile } from "@/lib/user-auth-schemas";
import type { UserProfile as UIUserProfile } from "@/components/ui/profile-types";
import type { TariffLimit } from "@/lib/tariff-service";

export type SubscriptionEntity = {
  tariff_id?: number;
  end_date?: string | null;
  tariffs?: {
    id?: number;
    name?: string | null;
    duration_days?: number | null;
    is_lifetime?: boolean | null;
  };
};

export type AuthLoaderMeta = {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
};

export type UserProtectedOutletContext = {
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
  sidebarCollapsed?: boolean;
};

export type MenuSectionModel = {
  key: string;
  titleKey: string;
  items: UserMenuItem[];
  isCollapsible: boolean;
};

