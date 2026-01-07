import { createContext, useContext } from "react";
import type { UserMenuItem } from "@/lib/user-menu-service";

export type UserMenuContextState = {
  menuItems: UserMenuItem[];
  activeMenuItem: UserMenuItem | null;
  menuLoading: boolean;
  setActiveMenuItem: (item: UserMenuItem | null) => void;
  navigateToMenuItem: (item: UserMenuItem) => void;
  refreshMenuItems: () => Promise<void>;
  hasAccess: boolean;
};

export const UserMenuContext = createContext<UserMenuContextState | null>(null);

export function useUserMenu(): UserMenuContextState {
  const context = useContext(UserMenuContext);
  if (!context) {
    throw new Error("useUserMenu must be used within UserMenuProvider");
  }
  return context;
}

