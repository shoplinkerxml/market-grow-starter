import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeWithAuth } from "@/lib/session-validation";
export interface UserMenuItem {
  id: number;
  user_id: string;
  title: string;
  path: string;
  parent_id?: number;
  order_index: number;
  is_active: boolean;
  page_type: 'content' | 'form' | 'dashboard' | 'list' | 'custom';
  content_data?: Record<string, unknown>;
  template_name?: string;
  meta_data?: Record<string, unknown>;
  icon_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserMenuItem {
  title: string;
  path: string;
  parent_id?: number;
  order_index?: number;
  page_type?: 'content' | 'form' | 'dashboard' | 'list' | 'custom';
  content_data?: Record<string, unknown>;
  template_name?: string;
  meta_data?: Record<string, unknown>;
  icon_name?: string;
  description?: string;
}

export interface UpdateUserMenuItem {
  title?: string;
  path?: string;
  parent_id?: number;
  order_index?: number;
  is_active?: boolean;
  page_type?: 'content' | 'form' | 'dashboard' | 'list' | 'custom';
  content_data?: Record<string, unknown>;
  template_name?: string;
  meta_data?: Record<string, unknown>;
  icon_name?: string;
  description?: string;
}

export interface MenuReorderItem {
  id: number;
  order_index: number;
  parent_id?: number;
}

export class UserMenuService {
  /**
   * Auto-assign icon based on menu item properties
   * Used as fallback when no explicit icon is set
   */
  static getAutoIconForMenuItem(item: { title: string; path: string }): string {
    const title = item.title.toLowerCase();
    const path = item.path.toLowerCase();
    
    // Supplier-related icons
    if (title.includes('supplier') || title.includes('постачальник')) {
      return 'Truck';
    }
    
    if (path.includes('supplier') || path.includes('постачальник')) {
      return 'Truck';
    }
    
    // Shop-related icons
    if (title.includes('shop') || title.includes('магазин')) {
      return 'Store';
    }
    
    if (path.includes('shop') || path.includes('магазин')) {
      return 'Store';
    }
    
    // Payment-related icons
    if (title.includes('payment') || title.includes('платеж')) {
      return 'CreditCard';
    }
    
    if (path.includes('payment') || path.includes('платеж')) {
      return 'CreditCard';
    }
    
    // Return existing icon or default to circle if none
    return 'circle';
  }
  
  /**
   * Get all menu items for a user
   */
  static async getUserMenuItems(userId: string, activeOnly: boolean = true): Promise<UserMenuItem[]> {
    const resp = await invokeEdgeWithAuth<{ items?: UserMenuItem[] }>("user-menu-items", {
      action: "list",
      active_only: !!activeOnly,
    });
    const rows: UserMenuItem[] = Array.isArray(resp.items) ? (resp.items as UserMenuItem[]) : [];
    return rows.map((item: UserMenuItem) => {
      if ((!item.icon_name || item.icon_name === 'circle' || item.icon_name === 'Circle') &&
          (item.title.toLowerCase().includes('supplier') ||
           item.title.toLowerCase().includes('постачальник') ||
           item.title.toLowerCase().includes('shop') ||
           item.title.toLowerCase().includes('магазин') ||
           item.title.toLowerCase().includes('payment') ||
           item.title.toLowerCase().includes('платеж') ||
           item.path.toLowerCase().includes('supplier') ||
           item.path.toLowerCase().includes('постачальник') ||
           item.path.toLowerCase().includes('shop') ||
           item.path.toLowerCase().includes('магазин') ||
           item.path.toLowerCase().includes('payment') ||
           item.path.toLowerCase().includes('платеж'))) {
        return { ...item, icon_name: this.getAutoIconForMenuItem({ title: item.title, path: item.path }) };
      }
      return item;
    });
  }

  /**
   * Get menu items organized in hierarchical structure
   */
  static async getMenuHierarchy(userId: string): Promise<UserMenuItem[]> {
    try {
      console.log('getMenuHierarchy called with userId:', userId); // Debug log
      // Get all active menu items for the user
      const allItems = await this.getUserMenuItems(userId, true);
      console.log('All items for hierarchy:', allItems); // Debug log
      
      // Build a map of all items by ID for quick lookup
      const itemMap = new Map<number, UserMenuItem & { children?: UserMenuItem[] }>();
      allItems.forEach(item => {
        itemMap.set(item.id, { ...item, children: [] });
      });
      
      // Build hierarchy by assigning children to their parents
      const rootItems: (UserMenuItem & { children?: UserMenuItem[] })[] = [];
      
      allItems.forEach(item => {
        if (item.parent_id) {
          // This is a child item, add it to its parent's children array
          const parent = itemMap.get(item.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(item);
          }
        } else {
          // This is a root item
          const itemWithChildren = itemMap.get(item.id);
          if (itemWithChildren) {
            rootItems.push(itemWithChildren);
          }
        }
      });
      
      // Sort children by order_index
      rootItems.forEach(item => {
        if (item.children) {
          item.children.sort((a, b) => a.order_index - b.order_index);
        }
      });
      
      // Sort root items by order_index
      rootItems.sort((a, b) => a.order_index - b.order_index);
      
      console.log('Built hierarchy:', rootItems); // Debug log
      return rootItems;
    } catch (error) {
      console.error('Error in getMenuHierarchy:', error);
      throw error;
    }
  }

  /**
   * Create a new menu item
   */
  static async createMenuItem(userId: string, menuData: CreateUserMenuItem): Promise<UserMenuItem> {
    try {
      const respUnique = await invokeEdgeWithAuth<{ item?: UserMenuItem | null }>("user-menu-items", {
        action: "get_by_path",
        path: menuData.path,
      });
      if (respUnique.item) {
        throw new Error('Path already exists for this user');
      }

      // Get the next order index if not provided
      let orderIndex = menuData.order_index;
      if (orderIndex === undefined) {
        const respMax = await supabase
          .from('user_menu_items')
          .select('order_index')
          .eq('parent_id', menuData.parent_id || null)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const maxOrderItem = (respMax.data ?? null) as { order_index: number | null } | null;
        const maxIdx = maxOrderItem?.order_index ?? 0;
        orderIndex = maxIdx + 1;
      }

      // Auto-assign icon only for supplier/shop/payment-related items
      let icon_name = menuData.icon_name;
      if (!icon_name && 
          (menuData.title.toLowerCase().includes('supplier') || 
           menuData.title.toLowerCase().includes('постачальник') ||
           menuData.title.toLowerCase().includes('shop') || 
           menuData.title.toLowerCase().includes('магазин') ||
           menuData.title.toLowerCase().includes('payment') || 
           menuData.title.toLowerCase().includes('платеж') ||
           menuData.path.toLowerCase().includes('supplier') || 
           menuData.path.toLowerCase().includes('постачальник') ||
           menuData.path.toLowerCase().includes('shop') || 
           menuData.path.toLowerCase().includes('магазин') ||
           menuData.path.toLowerCase().includes('payment') || 
           menuData.path.toLowerCase().includes('платеж'))) {
        icon_name = this.getAutoIconForMenuItem({ title: menuData.title, path: menuData.path });
      }

      // Set default content based on page type with better defaults
      const defaultContent = menuData.content_data || {};
      if (!defaultContent.content) {
        switch (menuData.page_type) {
          case 'content':
            defaultContent.content = `<div class="prose max-w-none">
              <h2>Welcome to ${menuData.title}</h2>
              <p>This is a placeholder content page. You can edit this page to add your own content.</p>
              <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4">
                <h3 class="font-semibold text-emerald-800">Getting Started</h3>
                <p class="text-emerald-700">Click the "Edit" button in the top right corner to customize this page.</p>
              </div>
            </div>`;
            break;
          case 'dashboard':
            defaultContent.widgets = [{
              type: 'stats',
              title: 'Overview',
              data: {}
            }, {
              type: 'chart',
              title: 'Analytics',
              data: {}
            }];
            break;
          case 'form':
            defaultContent.form_config = {
              fields: [],
              submitAction: 'save'
            };
            break;
          case 'list':
            defaultContent.table_config = {
              columns: [],
              dataSource: 'api'
            };
            break;
          default:
            defaultContent.content = `<div class="prose max-w-none">
              <h2>${menuData.title}</h2>
              <p>Configure your custom page content through the menu management interface.</p>
              <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4">
                <h3 class="font-semibold text-emerald-800">Custom Page</h3>
                <p class="text-emerald-700">This is a custom page type. You can add your own components here.</p>
              </div>
            </div>`;
        }
      }

      const resp = await invokeEdgeWithAuth<{ item: UserMenuItem }>("user-menu-items", {
        action: "create",
        data: {
          ...menuData,
          icon_name: icon_name || 'FileText',
          order_index: orderIndex,
          page_type: menuData.page_type || 'content',
          content_data: defaultContent,
        },
      });
      return resp.item as UserMenuItem;
    } catch (error) {
      console.error('Error in createMenuItem:', error);
      throw error;
    }
  }

  /**
   * Update an existing menu item
   */
  static async updateMenuItem(itemId: number, userId: string, menuData: UpdateUserMenuItem): Promise<UserMenuItem> {
    try {
      if (menuData.path) {
        const check = await invokeEdgeWithAuth<{ item?: UserMenuItem | null }>("user-menu-items", {
          action: "get_by_path",
          path: menuData.path,
        });
        const existingItem = check.item && typeof check.item.id === 'number' && check.item.id !== itemId ? check.item : null;
        if (existingItem) {
          throw new Error('Path already exists');
        }
      }

      // Auto-assign icon only for supplier/shop/payment-related items
      let icon_name = menuData.icon_name;
      if (menuData.title && !icon_name && 
          (menuData.title.toLowerCase().includes('supplier') || 
           menuData.title.toLowerCase().includes('постачальник') ||
           menuData.title.toLowerCase().includes('shop') || 
           menuData.title.toLowerCase().includes('магазин') ||
           menuData.title.toLowerCase().includes('payment') || 
           menuData.title.toLowerCase().includes('платеж'))) {
        // We need to get the path to determine the icon
        const respPath = await supabase
          .from('user_menu_items')
          .select('path')
          .eq('id', itemId)
          .maybeSingle();
        const existingPathRow = (respPath.data ?? null) as { path: string | null } | null;
        const pathForIcon = menuData.path || (existingPathRow?.path ?? '');
        if (pathForIcon) {
          icon_name = this.getAutoIconForMenuItem({ title: menuData.title, path: pathForIcon });
        }
      }

      const updateData = {
        ...menuData,
        ...(icon_name !== undefined && { icon_name }) // Only include icon_name if it's defined
      };

      const resp = await invokeEdgeWithAuth<{ item: UserMenuItem }>("user-menu-items", {
        action: "update",
        id: itemId,
        data: updateData,
      });
      return resp.item as UserMenuItem;
    } catch (error) {
      console.error('Error in updateMenuItem:', error);
      throw error;
    }
  }

  /**
   * Delete a menu item
   */
  static async deleteMenuItem(itemId: number, userId: string): Promise<void> {
    try {
      await invokeEdgeWithAuth<{ ok: boolean }>("user-menu-items", { action: "delete", id: itemId });
    } catch (error) {
      console.error('Error in deleteMenuItem:', error);
      throw error;
    }
  }

  /**
   * Soft delete a menu item (set is_active to false)
   */
  static async deactivateMenuItem(itemId: number, userId: string): Promise<UserMenuItem> {
    try {
      return await this.updateMenuItem(itemId, userId, { is_active: false });
    } catch (error) {
      console.error('Error in deactivateMenuItem:', error);
      throw error;
    }
  }

  /**
   * Reorder menu items
   */
  static async reorderMenuItems(userId: string, reorderedItems: MenuReorderItem[]): Promise<void> {
    try {
      await invokeEdgeWithAuth<{ ok: boolean }>("user-menu-items", {
        action: "reorder",
        items: reorderedItems,
      });
    } catch (error) {
      console.error('Error in reorderMenuItems:', error);
      throw error;
    }
  }

  
  /**
   * Get a single menu item by ID
   */
  static async getMenuItem(itemId: number, userId: string): Promise<UserMenuItem | null> {
    try {
      const resp = await invokeEdgeWithAuth<{ item?: UserMenuItem | null }>("user-menu-items", {
        action: "get",
        id: itemId,
      });
      const data = resp.item ?? null;

      // Only apply auto-icon assignment for supplier/shop/payment-related items
      if (data && (!data.icon_name || data.icon_name === 'circle' || data.icon_name === 'Circle') &&
          (data.title.toLowerCase().includes('supplier') || 
           data.title.toLowerCase().includes('постачальник') ||
           data.title.toLowerCase().includes('shop') || 
           data.title.toLowerCase().includes('магазин') ||
           data.title.toLowerCase().includes('payment') || 
           data.title.toLowerCase().includes('платеж') ||
           data.path.toLowerCase().includes('supplier') || 
           data.path.toLowerCase().includes('постачальник') ||
           data.path.toLowerCase().includes('shop') || 
           data.path.toLowerCase().includes('магазин') ||
           data.path.toLowerCase().includes('payment') || 
           data.path.toLowerCase().includes('платеж'))) {
        return {
          ...data,
          icon_name: this.getAutoIconForMenuItem({ title: data.title, path: data.path })
        };
      }

      return data;
    } catch (error) {
      console.error('Error in getMenuItem:', error);
      throw error;
    }
  }

  /**
   * Get a single menu item by path
   */
  static async getMenuItemByPath(path: string, userId: string): Promise<UserMenuItem | null> {
    try {
      const resp = await invokeEdgeWithAuth<{ item?: UserMenuItem | null }>("user-menu-items", {
        action: "get_by_path",
        path,
      });
      const data = resp.item ?? null;
      if (data && (!data.icon_name || data.icon_name === 'circle' || data.icon_name === 'Circle') &&
          (data.title.toLowerCase().includes('supplier') || 
           data.title.toLowerCase().includes('постачальник') ||
           data.title.toLowerCase().includes('shop') || 
           data.title.toLowerCase().includes('магазин') ||
           data.title.toLowerCase().includes('payment') || 
           data.title.toLowerCase().includes('платеж') ||
           data.path.toLowerCase().includes('supplier') || 
           data.path.toLowerCase().includes('постачальник') ||
           data.path.toLowerCase().includes('shop') || 
           data.path.toLowerCase().includes('магазин') ||
           data.path.toLowerCase().includes('payment') || 
           data.path.toLowerCase().includes('платеж'))) {
        return {
          ...data,
          icon_name: this.getAutoIconForMenuItem({ title: data.title, path: data.path })
        } as UserMenuItem;
      }
      return data;
    } catch (error) {
      console.error('Error in getMenuItemByPath:', error);
      throw error;
    }
  }

  /**
   * Get menu items by parent ID
   */
  static async getChildMenuItems(userId: string, parentId?: number): Promise<UserMenuItem[]> {
    try {
      const resp = await invokeEdgeWithAuth<{ items?: UserMenuItem[] }>("user-menu-items", {
        action: "get_children",
        parent_id: parentId ?? null,
      });
      const itemsWithIcons = (resp.items || []).map((item: UserMenuItem) => {
        if ((!item.icon_name || item.icon_name === 'circle' || item.icon_name === 'Circle') &&
            (item.title.toLowerCase().includes('supplier') || 
             item.title.toLowerCase().includes('постачальник') ||
             item.title.toLowerCase().includes('shop') || 
             item.title.toLowerCase().includes('магазин') ||
             item.title.toLowerCase().includes('payment') || 
             item.title.toLowerCase().includes('платеж') ||
             item.path.toLowerCase().includes('supplier') || 
             item.path.toLowerCase().includes('постачальник') ||
             item.path.toLowerCase().includes('shop') || 
             item.path.toLowerCase().includes('магазин') ||
             item.path.toLowerCase().includes('payment') || 
             item.path.toLowerCase().includes('платеж'))) {
          return {
            ...item,
            icon_name: this.getAutoIconForMenuItem({ title: item.title, path: item.path })
          };
        }
        return item;
      });

      return itemsWithIcons;
    } catch (error) {
      console.error('Error in getChildMenuItems:', error);
      throw error;
    }
  }

  /**
   * Duplicate a menu item
   */
  static async duplicateMenuItem(itemId: number, userId: string, newTitle?: string): Promise<UserMenuItem> {
    try {
      const originalItem = await this.getMenuItem(itemId, userId);
      if (!originalItem) {
        throw new Error('Menu item not found');
      }

      // Create new item based on original
      const duplicateData: CreateUserMenuItem = {
        title: newTitle || `${originalItem.title} (Copy)`,
        path: `${originalItem.path}-copy-${Date.now()}`,
        parent_id: originalItem.parent_id,
        page_type: originalItem.page_type,
        content_data: originalItem.content_data,
        template_name: originalItem.template_name,
        meta_data: originalItem.meta_data,
        icon_name: originalItem.icon_name,
        description: originalItem.description
      };

      return await this.createMenuItem(userId, duplicateData);
    } catch (error) {
      console.error('Error in duplicateMenuItem:', error);
      throw error;
    }
  }
}
