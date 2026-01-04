import React from 'react';
import { UserMenuItem } from '@/lib/user-menu-service';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { getAutoIcon } from '@/components/ui/dynamic-icon-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from "@/i18n";

export interface MenuItemWithIconProps {
  item: UserMenuItem;
  isActive: boolean;
  collapsed?: boolean;
  variant?: 'default' | 'dashboard' | 'child';
  onClick: (item: UserMenuItem) => void;
  onHover?: (item: UserMenuItem) => void;
  disabled?: boolean;
}

export const MenuItemWithIcon: React.FC<MenuItemWithIconProps> = ({
  item,
  isActive,
  collapsed = false,
  variant = 'default',
  onClick,
  onHover,
  disabled = false,
}) => {
  const { t } = useI18n();

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

  const translatedTitle = translateMenuItem(item.title);
  
  const baseClasses = "w-full text-left rounded-md text-sm transition-all duration-200 group";
  
  const variantClasses = {
    default: "px-3 py-2", // 12px horizontal padding
    dashboard: "px-4 py-3 font-medium",
    child: "px-3 py-1.5 ml-2", // Child items with additional left margin
  };

  const stateClasses = disabled
    ? "opacity-50 cursor-not-allowed pointer-events-none"
    : (isActive
    ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50 shadow-sm"
    : "hover:bg-emerald-50 hover:text-[#10b981] border border-transparent hover:border-emerald-200/30 hover:shadow-sm");

  const iconSize = variant === 'dashboard' ? "w-6 h-6" : "w-5 h-5";
  const iconMargin = collapsed ? "" : "mr-3"; // 12px gap between icon and text
  
  // Auto-assign icon if none is explicitly set
  // For child items (submenus), use 'dot' icon
  const iconName = variant === 'child' ? 'dot' : (item.icon_name || getAutoIcon({ 
    title: item.title, 
    path: item.path, 
    page_type: item.page_type 
  }));

  const renderContent = () => (
    <div className={cn("flex items-center w-full", collapsed ? "justify-center" : "justify-between")}>
      <div className={cn("flex items-center", collapsed ? "justify-center" : "min-w-0 flex-1")}>
        <DynamicIcon 
          name={iconName} 
          className={cn(iconSize, iconMargin, "shrink-0", variant === 'child' ? "fill-emerald-400 stroke-emerald-400 scale-50" : "")}
        />
        {!collapsed && (
          <span className="truncate flex-1">
            {translatedTitle}
          </span>
        )}
      </div>
    </div>
  );

  const button = (
    <button
      onClick={() => { if (!disabled) onClick(item); }}
      onMouseEnter={() => onHover && onHover(item)}
      className={cn(baseClasses, variantClasses[variant], stateClasses)}
      aria-label={collapsed ? translatedTitle : undefined}
    >
      {renderContent()}
    </button>
  );

  // Wrap in tooltip if collapsed or has description
  if (collapsed || item.description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            <div>
              <div>{translatedTitle}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export default MenuItemWithIcon;
