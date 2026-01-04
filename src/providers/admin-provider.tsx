import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Static routes that are always available regardless of database state
const STATIC_ROUTES: Record<string, Partial<MenuItemData>> = {
  '/dashboard': {
    id: -1,
    title: 'Dashboard',
    path: '/dashboard',
    page_type: 'dashboard',
    is_active: true,
    order_index: 0,
    created_at: new Date().toISOString(),
    icon_name: 'layout-dashboard',
    section_type: 'dashboard'
  },
  '/personal': {
    id: -2,
    title: 'Personal',
    path: '/personal',
    page_type: 'content',
    is_active: true,
    order_index: 999,
    created_at: new Date().toISOString(),
    icon_name: 'user',
    section_type: 'settings'
  },
  '/forms/elements': {
    id: -3,
    title: 'Form Elements',
    path: '/forms/elements',
    page_type: 'form',
    is_active: true,
    order_index: 10,
    created_at: new Date().toISOString(),
    icon_name: 'form-input',
    section_type: 'main'
  },
  '/forms/layouts': {
    id: -4,
    title: 'Form Layouts',
    path: '/forms/layouts',
    page_type: 'form',
    is_active: true,
    order_index: 11,
    created_at: new Date().toISOString(),
    icon_name: 'layout-grid',
    section_type: 'main'
  },
  '/forms/horizontal': {
    id: -5,
    title: 'Horizontal Forms',
    path: '/forms/horizontal',
    page_type: 'form',
    is_active: true,
    order_index: 12,
    created_at: new Date().toISOString(),
    icon_name: 'move-horizontal',
    section_type: 'main'
  },
  '/forms/vertical': {
    id: -6,
    title: 'Vertical Forms',
    path: '/forms/vertical',
    page_type: 'form',
    is_active: true,
    order_index: 13,
    created_at: new Date().toISOString(),
    icon_name: 'move-vertical',
    section_type: 'main'
  },
  '/forms/custom': {
    id: -7,
    title: 'Custom Forms',
    path: '/forms/custom',
    page_type: 'form',
    is_active: true,
    order_index: 14,
    created_at: new Date().toISOString(),
    icon_name: 'palette',
    section_type: 'main'
  },
  '/forms/validation': {
    id: -8,
    title: 'Form Validation',
    path: '/forms/validation',
    page_type: 'form',
    is_active: true,
    order_index: 15,
    created_at: new Date().toISOString(),
    icon_name: 'check-circle',
    section_type: 'main'
  },
  '/users': {
    id: -9,
    title: 'Users',
    path: '/users',
    page_type: 'list',
    is_active: true,
    order_index: 2,
    created_at: new Date().toISOString(),
    icon_name: 'users',
    section_type: 'main'
  },
  '/settings/currency': {
    id: -10,
    title: 'Currency',
    path: '/settings/currency',
    page_type: 'list',
    is_active: true,
    order_index: 100,
    created_at: new Date().toISOString(),
    icon_name: 'dollar-sign',
    section_type: 'settings'
  },
  '/tariff': {
    id: -11,
    title: 'menu_pricing',
    path: '/tariff',
    page_type: 'list',
    is_active: true,
    order_index: 3,
    created_at: new Date().toISOString(),
    icon_name: 'credit-card',
    section_type: 'main'
  },
  '/tariff/features': {
    id: -12,
    title: 'Tariff Features',
    path: '/tariff/features',
    page_type: 'list',
    is_active: true,
    order_index: 4,
    created_at: new Date().toISOString(),
    icon_name: 'check-circle',
    section_type: 'main'
  },
  '/storetemplates': {
    id: -13,
    title: 'Шаблони XML',
    path: '/storetemplates',
    page_type: 'custom',
    is_active: true,
    order_index: 9,
    created_at: new Date().toISOString(),
    icon_name: 'file-code',
    section_type: 'main'
  },
  '/settings/limits': {
    id: -14,
    title: 'Ліміти',
    path: '/settings/limits',
    page_type: 'custom',
    is_active: true,
    order_index: 101,
    created_at: new Date().toISOString(),
    icon_name: 'settings',
    section_type: 'settings'
  }
};

export interface MenuItemData {
  id: number;
  title: string;
  path: string;
  page_type: 'content' | 'form' | 'dashboard' | 'list' | 'custom';
  content_data?: Record<string, unknown>;
  template_name?: string;
  meta_data?: Record<string, unknown>;
  parent_id?: number | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  // New icon and section fields
  icon_name?: string | null;
  section_type?: 'dashboard' | 'main' | 'settings';
  has_separator?: boolean;
  description?: string | null;
  badge_text?: string | null;
  badge_color?: string | null;
}

export interface MenuSectionData {
  id: number;
  name: string;
  type: 'dashboard' | 'main' | 'settings';
  order_index: number;
  icon_name?: string | null;
  is_collapsible: boolean;
  is_collapsed: boolean;
  created_at: string;
}

export interface AdminContextState {
  // Menu state
  menuItems: MenuItemData[];
  activeMenuItem: MenuItemData | null;
  menuLoading: boolean;
  
  // Content state
  contentLoading: boolean;
  contentError: string | null;
  
  // Cache for content data
  contentCache: Record<string, unknown>;
  
  // Actions
  setActiveMenuItem: (item: MenuItemData | null) => void;
  navigateToMenuItem: (item: MenuItemData) => void;
  preloadContent: (item: MenuItemData) => Promise<void>;
  clearContentError: () => void;
  refreshMenuItems: () => Promise<void>;
}

const AdminContext = createContext<AdminContextState | null>(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: React.ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [activeMenuItem, setActiveMenuItemState] = useState<MenuItemData | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentCache, setContentCache] = useState<Record<string, unknown>>({});
  
  const navigate = useNavigate();
  const location = useLocation();

  // Build menu tree structure
  const buildMenuTree = useCallback((items: MenuItemData[]) => {
    const map: Record<number | "root", MenuItemData[]> = { root: [] };
    
    for (const item of items) {
      const key = (item.parent_id ?? "root") as number | "root";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    
    // Sort by order_index
    const keys = Object.keys(map) as Array<keyof typeof map>;
    for (const key of keys) {
      map[key].sort((a, b) => a.order_index - b.order_index);
    }
    
    return map;
  }, []);

  // Load menu items on mount
  const loadMenuItems = useCallback(async () => {
    setMenuLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Failed to load menu items:', error);
        return;
      }

      // Map database rows to MenuItemData format
      const menuItemsData: MenuItemData[] = (data || []).map(item => ({
        ...item,
        page_type: 'content' as const,
        content_data: {},
        meta_data: {},
        section_type: 'main' as const,
        icon_name: null,
        has_separator: false,
        description: null,
        badge_text: null,
        badge_color: null,
      }));

      setMenuItems(menuItemsData);
    } catch (error) {
      console.error('Error loading menu items:', error);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // Refresh menu items
  const refreshMenuItems = useCallback(async () => {
    await loadMenuItems();
  }, [loadMenuItems]);

  // Find active menu item based on current path with static route fallback
  const findActiveMenuItem = useCallback((currentPath: string, items: MenuItemData[]) => {
    const adminPath = currentPath.replace('/admin', '');
    
    // First try to find in loaded menu items from database
    const menuItem = items.find(item => item.path === adminPath);
    if (menuItem) {
      return menuItem;
    }
    
    // For static routes, create virtual menu item if not found in database
    if (STATIC_ROUTES[adminPath]) {
      return {
        ...STATIC_ROUTES[adminPath],
        // Ensure all required fields are present
        id: STATIC_ROUTES[adminPath].id!,
        title: STATIC_ROUTES[adminPath].title!,
        path: STATIC_ROUTES[adminPath].path!,
        page_type: STATIC_ROUTES[adminPath].page_type!,
        is_active: STATIC_ROUTES[adminPath].is_active!,
        order_index: STATIC_ROUTES[adminPath].order_index!,
        created_at: STATIC_ROUTES[adminPath].created_at!
      } as MenuItemData;
    }
    
    return null;
  }, []);

  // Set active menu item
  const setActiveMenuItem = useCallback((item: MenuItemData | null) => {
    setActiveMenuItemState(item);
    setContentError(null);
  }, []);

  // Navigate to menu item
  const navigateToMenuItem = useCallback((item: MenuItemData) => {
    setContentLoading(true);
    setContentError(null);
    setActiveMenuItem(item);
    navigate(`/admin${item.path}`, { replace: false });
  }, [navigate, setActiveMenuItem]);

  // Preload content for a menu item
  const preloadContent = useCallback(async (item: MenuItemData) => {
    const cacheKey = `content_${item.id}`;
    
    // Don't preload if already cached
    if (cacheKey in contentCache) {
      return;
    }

    try {
      // For pages that have dynamic content, cache the content_data
      if (item.page_type === 'content' || item.content_data) {
        setContentCache(prev => ({
          ...prev,
          [cacheKey]: (item.content_data ?? {}) as Record<string, unknown>
        }));
      }
    } catch (error) {
      console.error('Error preloading content for item:', item.title, error);
    }
  }, [contentCache]);

  // Clear content error
  const clearContentError = useCallback(() => {
    setContentError(null);
  }, []);

  // Initialize menu items on mount
  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  // Update active menu item when location changes
  useEffect(() => {
    const adminPath = location.pathname.replace('/admin', '');
    
    // Handle static routes immediately, even during menu loading
    if (STATIC_ROUTES[adminPath]) {
      const staticMenuItem = findActiveMenuItem(location.pathname, []);
      if (staticMenuItem && staticMenuItem.id !== activeMenuItem?.id) {
        setActiveMenuItem(staticMenuItem);
      }
      return;
    }
    
    // For dynamic routes, wait for menu items to load
    if (menuItems.length > 0) {
      const activeItem = findActiveMenuItem(location.pathname, menuItems);
      if (activeItem && activeItem.id !== activeMenuItem?.id) {
        setActiveMenuItem(activeItem);
      }
    }
  }, [location.pathname, menuItems, activeMenuItem?.id, findActiveMenuItem, setActiveMenuItem]);

  // Set content loading to false when not navigating
  useEffect(() => {
    if (activeMenuItem) {
      setContentLoading(false);
    }
  }, [activeMenuItem]);

  const contextValue: AdminContextState = {
    menuItems,
    activeMenuItem,
    menuLoading,
    contentLoading,
    contentError,
    contentCache,
    setActiveMenuItem,
    navigateToMenuItem,
    preloadContent,
    clearContentError,
    refreshMenuItems,
  };

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};
