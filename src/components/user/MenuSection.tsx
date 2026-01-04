import React, { useState } from 'react';
import { UserMenuItem } from '@/lib/user-menu-service';
import { MenuItemWithIcon } from './MenuItemWithIcon';
import { Separator } from '@/components/ui/separator';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { getAutoIcon } from '@/components/ui/dynamic-icon-utils';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from "@/i18n";

export interface MenuSectionProps {
  title?: string;
  type: 'dashboard' | 'main' | 'settings';
  items: UserMenuItem[];
  collapsed?: boolean;
  isCollapsible?: boolean;
  icon?: string | null;
  children?: UserMenuItem[];
  onItemClick: (item: UserMenuItem) => void;
  onItemHover?: (item: UserMenuItem) => void;
  isActiveItem: (item: UserMenuItem) => boolean;
  buildTree: (items: UserMenuItem[]) => Record<number | "root", UserMenuItem[]>;
  hasAccess?: boolean;
}

interface SubmenuState {
  [itemId: number]: boolean;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  title,
  type,
  items,
  collapsed = false,
  isCollapsible = false,
  icon,
  children = [],
  onItemClick,
  onItemHover,
  isActiveItem,
  buildTree,
  hasAccess = true,
}) => {
  const [submenuStates, setSubmenuStates] = useState<SubmenuState>({});
  const tree = buildTree([...items, ...children]);
  const { t } = useI18n();

  const isAlwaysAccessibleItem = (it: UserMenuItem) => {
    const title = it.title || '';
    const path = it.path || '';
    const isTariff = (
      path === 'tariff' || path.includes('tariff') ||
      title === 'menu_pricing' || title.includes('Тариф') || title.includes('Pricing')
    );
    const isDashboard = (
      path === 'dashboard' ||
      title === 'menu_dashboard' || title === 'Dashboard' || title.includes('Панель управління')
    );
    return isTariff || isDashboard;
  };

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
      "Головна": "menu_main",
      "Тарифні плани": "menu_pricing",
      "Валюта": "menu_currency",
      "Платіжні системи": "menu_payment",
      "Pricing Plans": "menu_pricing",
      "Currency": "menu_currency",
      "Payment Systems": "menu_payment",
      "Tariff Features": "menu_tariff_features",
      "Функції тарифів": "menu_tariff_features",
      "Магазини": "menu_stores",
      "Stores": "menu_stores",
      "Постачальники": "menu_suppliers",
      "Suppliers": "menu_suppliers",
    };
    const translationKey = translationMap[title];
    return translationKey ? t(translationKey as any) : title;
  };

  const renderSectionHeader = () => {
    if (!title || collapsed) return null;
    return (
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center gap-2">
          {icon && <DynamicIcon name={icon} className="w-3 h-3" />}
          {title}
        </div>
      </div>
    );
  };

  const toggleSubmenu = (itemId: number) => {
    setSubmenuStates(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const shouldShowSeparator = (item: UserMenuItem, index: number) => {
    return false;
  };

  return (
    <div className={cn("space-y-1", type === 'dashboard' && "mb-4")}> 
      {renderSectionHeader()}
      {items.map((item, index) => {
        const hasChildren = tree[item.id]?.length > 0;
        const isExpanded = submenuStates[item.id];
        const translatedTitle = translateMenuItem(item.title);
        return (
          <div key={item.id}>
            {shouldShowSeparator(item, index) && (
              <div className="py-2">
                <Separator />
              </div>
            )}
            <div className="relative">
              {hasChildren ? (
                <button
                  onClick={() => {
                    const isDisabled = !hasAccess && !isAlwaysAccessibleItem(item);
                    if (isDisabled) return;
                    onItemClick(item);
                    toggleSubmenu(item.id);
                  }}
                  onMouseEnter={() => onItemHover && onItemHover(item)}
                  className={cn(
                    "w-full text-left rounded-md text-sm transition-all duration-200 group flex items-center",
                    collapsed ? "justify-center" : "justify-between",
                    "px-3 py-2",
                    (!hasAccess && !isAlwaysAccessibleItem(item)) ? "opacity-50 cursor-not-allowed pointer-events-none" : (
                      isActiveItem(item)
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50 shadow-sm"
                        : "hover:bg-emerald-50 hover:text-[#10b981] border border-transparent hover:border-emerald-200/30 hover:shadow-sm"
                    )
                  )}
                  aria-label={`${translatedTitle} - ${isExpanded ? "Collapse" : "Expand"} submenu`}
                >
                  <div className={cn("flex items-center", collapsed ? "justify-center" : "min-w-0 flex-1")}> 
                    <DynamicIcon 
                      name={item.icon_name || getAutoIcon({ title: item.title, path: item.path, page_type: item.page_type })} 
                      className={cn(collapsed ? "w-5 h-5 shrink-0" : "w-5 h-5 mr-3 shrink-0")}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1">{translatedTitle}</span>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#10b981] transform rotate-180 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#10b981] transition-transform duration-200" />
                      )}
                    </div>
                  )}
                </button>
              ) : (
                <MenuItemWithIcon
                  item={item}
                  isActive={isActiveItem(item)}
                  collapsed={collapsed}
                  onClick={(it) => { if (!hasAccess && !isAlwaysAccessibleItem(it)) return; onItemClick(it); }}
                  onHover={onItemHover}
                  variant={type === 'dashboard' ? 'dashboard' : 'default'}
                  disabled={!hasAccess && !isAlwaysAccessibleItem(item)}
                />
              )}
              {!collapsed && hasChildren && isExpanded && (
                <div className="ml-6 mt-1 space-y-1 border-l border-gray-100 pl-3">
                  {tree[item.id].map((child) => (
                    <MenuItemWithIcon
                      key={child.id}
                      item={child}
                      isActive={isActiveItem(child)}
                      collapsed={false}
                      onClick={(it) => { if (!hasAccess && !isAlwaysAccessibleItem(it)) return; onItemClick(it); }}
                      onHover={onItemHover}
                      variant="child"
                      disabled={!hasAccess && !isAlwaysAccessibleItem(child)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MenuSection;
