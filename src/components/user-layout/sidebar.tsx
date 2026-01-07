import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogOut, MoreHorizontal } from "lucide-react";
import { MenuSection } from "@/components/user/MenuSection";
import type { MenuSectionModel } from "@/components/user-layout/types";
import type { UserMenuItem } from "@/lib/user-menu-service";
import type { UserProfile } from "@/lib/user-auth-schemas";

function buildTree(items: UserMenuItem[]): Record<number | "root", UserMenuItem[]> {
  const map: Record<number | "root", UserMenuItem[]> = { root: [] };
  for (const it of items) {
    const key = (it.parent_id ?? "root") as number | "root";
    if (!map[key]) map[key] = [];
    map[key].push(it);
  }
  for (const key in map) {
    const arr = map[key as unknown as keyof typeof map];
    if (arr) arr.sort((a, b) => a.order_index - b.order_index);
  }
  return map;
}

export const UserSidebarBrand = memo(({ collapsed }: { collapsed: boolean }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      {collapsed ? (
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
  );
});
UserSidebarBrand.displayName = "UserSidebarBrand";

export const UserSidebarNav = memo(
  ({
    menuLoading,
    menuSections,
    collapsed,
    t,
    menuItems,
    onMenuClick,
    isActiveItem,
    hasAccess,
  }: {
    menuLoading: boolean;
    menuSections: MenuSectionModel[];
    collapsed: boolean;
    t: (key: string) => string;
    menuItems: UserMenuItem[];
    onMenuClick: (item: UserMenuItem) => void;
    isActiveItem: (item: UserMenuItem) => boolean;
    hasAccess: boolean;
  }) => {
    return (
      <nav className={collapsed ? "space-y-1 flex-1 overflow-y-auto" : "space-y-1 flex-1 overflow-y-auto"}>
        {menuLoading ? null : (
          <>
            {menuSections.map((section, sectionIndex) => {
              if (!section.items.length) return null;
              const title = section.key === "main" ? undefined : collapsed ? undefined : t(section.titleKey as string);
              return (
                <div key={section.key}>
                  {sectionIndex > 0 ? (
                    <div className="py-2">
                      <div className="border-t border-gray-200" />
                    </div>
                  ) : null}
                  <MenuSection
                    title={title}
                    type={section.key === "main" ? "main" : "settings"}
                    items={section.items}
                    collapsed={collapsed}
                    isCollapsible={section.isCollapsible}
                    children={menuItems.filter((item) => section.items.some((parent) => parent.id === item.parent_id))}
                    onItemClick={onMenuClick}
                    isActiveItem={isActiveItem}
                    buildTree={buildTree}
                    hasAccess={hasAccess}
                  />
                </div>
              );
            })}
          </>
        )}
      </nav>
    );
  },
);
UserSidebarNav.displayName = "UserSidebarNav";

export const UserSidebarFooter = memo(
  ({
    collapsed,
    user,
    t,
    onLogout,
  }: {
    collapsed: boolean;
    user: UserProfile;
    t: (key: string) => string;
    onLogout: () => void;
  }) => {
    return (
      <div className={collapsed ? "p-4 pb-6 shrink-0" : "pt-4 pb-6 shrink-0"}>
        {collapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-full" title={user.name}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onLogout} className="focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 ml-2">
              <AvatarImage src={user.avatar_url} alt={user.name} />
              <AvatarFallback className="bg-emerald-100 text-emerald-600 font-semibold">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent hover:border-transparent hover:shadow-none active:scale-100 hover:[&_svg]:[stroke-width:2]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onLogout} className="focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  },
);
UserSidebarFooter.displayName = "UserSidebarFooter";

export const MobileMenuSheet = memo(
  ({
    open,
    onOpenChange,
    t,
    menuLoading,
    menuSections,
    menuItems,
    onMenuClick,
    isActiveItem,
    hasAccess,
    user,
    onLogout,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    t: (key: string) => string;
    menuLoading: boolean;
    menuSections: MenuSectionModel[];
    menuItems: UserMenuItem[];
    onMenuClick: (item: UserMenuItem) => void;
    isActiveItem: (item: UserMenuItem) => boolean;
    hasAccess: boolean;
    user: UserProfile;
    onLogout: () => void;
  }) => {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="p-0 w-64 flex flex-col h-full">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            <UserSidebarBrand collapsed={false} />
            <UserSidebarNav
              menuLoading={menuLoading}
              menuSections={menuSections}
              collapsed={false}
              t={t}
              menuItems={menuItems}
              onMenuClick={onMenuClick}
              isActiveItem={isActiveItem}
              hasAccess={hasAccess}
            />
            <div className="pt-4 pb-6 shrink-0">
              <UserSidebarFooter collapsed={false} user={user} t={t} onLogout={onLogout} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  },
);
MobileMenuSheet.displayName = "MobileMenuSheet";

export const DesktopSidebar = memo(
  ({
    collapsed,
    t,
    menuLoading,
    menuSections,
    menuItems,
    onMenuClick,
    isActiveItem,
    hasAccess,
    user,
    onLogout,
  }: {
    collapsed: boolean;
    t: (key: string) => string;
    menuLoading: boolean;
    menuSections: MenuSectionModel[];
    menuItems: UserMenuItem[];
    onMenuClick: (item: UserMenuItem) => void;
    isActiveItem: (item: UserMenuItem) => boolean;
    hasAccess: boolean;
    user: UserProfile;
    onLogout: () => void;
  }) => {
    return (
      <aside
        className={`hidden md:flex max-[1393px]:hidden ${collapsed ? "w-16" : "w-64"} transition-all duration-300 shrink-0 border-r bg-background flex-col fixed left-0 top-0 h-screen z-40 overflow-hidden shadow-lg`}
      >
        <div className="p-4 shrink-0">
          <UserSidebarBrand collapsed={collapsed} />
        </div>
        <UserSidebarNav
          menuLoading={menuLoading}
          menuSections={menuSections}
          collapsed={collapsed}
          t={t}
          menuItems={menuItems}
          onMenuClick={onMenuClick}
          isActiveItem={isActiveItem}
          hasAccess={hasAccess}
        />
        <UserSidebarFooter collapsed={collapsed} user={user} t={t} onLogout={onLogout} />
      </aside>
    );
  },
);
DesktopSidebar.displayName = "DesktopSidebar";
