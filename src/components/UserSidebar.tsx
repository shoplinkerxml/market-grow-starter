import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Edit3, 
  Copy, 
  Trash2, 
  MenuIcon,
  Plus,
  Settings
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { UserMenuItem } from "@/lib/user-menu-service";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface DefaultMenuItem {
  title: string;
  path: string;
  icon: string;
  isDefault: true;
}

const defaultMenuItems: DefaultMenuItem[] = [
  {
    title: "Dashboard",
    path: "dashboard",
    icon: "LayoutDashboard",
    isDefault: true as const
  }
];

export const UserSidebar = ({ 
  user, 
  menuItems = [], 
  collapsed = false, 
  onToggle,
  onMenuChange
}) => {
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { t } = useI18n()

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  const handleMenuAction = (action: string, item: UserMenuItem) => {
    switch (action) {
      case 'edit':
        navigate(`/user/content/${item.id}`);
        break;
      case 'duplicate':
        toast({
          title: t("duplicate_menu_item"),
          description: t("feature_not_implemented"),
          variant: "destructive"
        });
        break;
      case 'delete':
        toast({
          title: t("delete_menu_item"),
          description: t("feature_not_implemented"),
          variant: "destructive"
        });
        break;
    }
  };

  const isActive = (path: string) => {
    // Ensure path doesn't have leading slash to prevent double slashes
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return window.location.pathname === `/user/${cleanPath}` || 
           (window.location.pathname.startsWith(`/user/${cleanPath}`) && 
            (window.location.pathname.length === `/user/${cleanPath}`.length || 
             window.location.pathname.charAt(`/user/${cleanPath}`.length) === '/'));
  };

  // Helper function to translate menu items
  const translateMenuItem = (title: string): string => {
    const translationMap: Record<string, string> = {
      "Forms": "menu_forms",
      "Settings": "menu_settings", 
      "Users": "menu_users",
      "Dashboard": "menu_dashboard",
      "Analytics": "menu_analytics",
      "Reports": "menu_reports",
      "Content": "menu_content",
      "Categories": "menu_categories",
      "Products": "menu_products",
      "Форми": "menu_forms",
      "Налаштування": "menu_settings",
      "Користувачі": "menu_users",
      "Панель управління": "menu_dashboard",
      "Аналітика": "menu_analytics",
      "Звіти": "menu_reports",
      "Контент": "menu_content",
      "Категорії": "menu_categories",
      "Товари": "menu_products",
      // Additional translations
      "Головна": "menu_main",
      "Тарифні плани": "menu_pricing",
      "Валюта": "menu_currency",
      "Платіжні системи": "menu_payment",
      "Pricing Plans": "menu_pricing",
      "Currency": "menu_currency",
      "Payment Systems": "menu_payment",
    };
    
    const translationKey = translationMap[title];
    return translationKey ? t(translationKey as any) : title;
  };

  const isDefaultMenuItem = (item: any): item is DefaultMenuItem => {
    return item && typeof item === 'object' && 'isDefault' in item && item.isDefault === true;
  };

  const renderMenuItem = (item: DefaultMenuItem | UserMenuItem, level = 0) => {
    const isDefaultItem = isDefaultMenuItem(item);
    // Ensure path doesn't have leading slash to prevent double slashes
    const cleanPath = isDefaultItem ? item.path : (item as UserMenuItem).path;
    const normalizedPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    const itemPath = `/user/${normalizedPath}`;
    const translatedTitle = translateMenuItem(item.title);
    
    return (
      <div 
        key={isDefaultItem ? item.path : (item as UserMenuItem).id}
        className={cn(
          "group relative",
          level > 0 && "ml-4"
        )}
        onMouseEnter={() => !isDefaultItem && setHoveredItem((item as UserMenuItem).id)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <div
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
            isActive(itemPath)
              ? "bg-emerald-100 text-emerald-900"
              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <div 
            className="flex items-center gap-3 flex-1"
            onClick={() => handleMenuClick(itemPath)}
          >
            <DynamicIcon 
              name={isDefaultItem ? item.icon : (item as UserMenuItem).icon_name || "FileText"} 
              className="h-4 w-4" 
            />
            {!collapsed && (
              <span className="truncate">{translatedTitle}</span>
            )}
          </div>
          
          {!collapsed && !isDefaultItem && hoveredItem === (item as UserMenuItem).id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MenuIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleMenuAction('edit', item as UserMenuItem)}>
                  <Edit3 className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMenuAction('duplicate', item as UserMenuItem)}>
                  <Copy className="h-3 w-3 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleMenuAction('delete', item as UserMenuItem)}
                  className="text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* Render children if any */}
        {!isDefaultItem && 'children' in item && (item as any).children && (item as any).children.map(child => 
          renderMenuItem(child, level + 1)
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative flex flex-col border-r bg-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">MG</span>
            </div>
            <span className="font-semibold">MarketGrow</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator />

      {/* User Info */}
      {!collapsed && (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <User className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 py-4">
          {/* Default Menu Items */}
          {!collapsed && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Main
              </p>
            </div>
          )}
          
          {defaultMenuItems.map(item => renderMenuItem(item))}

          {/* User Custom Menu Items */}
          {menuItems.length > 0 && (
            <>
              {!collapsed && (
                <div className="mt-6 mb-4">
                  <div className="flex items-center justify-between px-3 mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      My Menu
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {menuItems.length}
                    </Badge>
                  </div>
                </div>
              )}
              
              {menuItems.map(item => renderMenuItem(item))}
            </>
          )}

        </div>
      </ScrollArea>

      <Separator />

      {/* Settings */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start",
            collapsed && "justify-center"
          )}
          onClick={() => navigate('/user/settings')}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Settings</span>}
        </Button>
      </div>
    </div>
  );
};
