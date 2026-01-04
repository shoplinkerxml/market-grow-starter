import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageCardHeader } from "@/components/page-header";

const AddMissingMenuItems = () => {
  const [loading, setLoading] = useState(false);

  const addMissingMenuItems = async () => {
    setLoading(true);
    try {
      // Get all users with role 'user'
      const { data: users, error: usersError } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('role', 'user');
      
      if (usersError) {
        throw new Error(`Error fetching users: ${usersError.message}`);
      }
      
      // Define the menu items to add
      const menuItemsToAdd = [
        {
          title: 'Tariff',
          path: 'tariff',
          order_index: 3,
          page_type: 'content',
          icon_name: 'CreditCard',
          description: 'Manage your tariff and billing information'
        },
        {
          title: 'Reports',
          path: 'reports',
          order_index: 4,
          page_type: 'content',
          icon_name: 'BarChart3',
          description: 'View your usage reports and analytics'
        },
        {
          title: 'Settings',
          path: 'settings',
          order_index: 5,
          page_type: 'content',
          icon_name: 'Settings',
          description: 'Configure your account settings'
        }
      ];
      
      // For each user, check if they have the menu items and add them if missing
      for (const user of users) {
        const userId = user.id;
        
        for (const menuItem of menuItemsToAdd) {
          // Check if the menu item already exists
          const { data: existingItem, error: checkError } = await (supabase as any)
            .from('user_menu_items')
            .select('id')
            .eq('user_id', userId)
            .eq('path', menuItem.path)
            .maybeSingle();
          
          if (checkError) {
            console.error(`Error checking menu item for user ${userId}:`, checkError);
            continue;
          }
          
          // If the menu item doesn't exist, add it
          if (!existingItem) {
            const { error: insertError } = await (supabase as any)
              .from('user_menu_items')
              .insert({
                user_id: userId,
                title: menuItem.title,
                path: menuItem.path,
                order_index: menuItem.order_index,
                page_type: menuItem.page_type,
                icon_name: menuItem.icon_name,
                description: menuItem.description
              });
            
            if (insertError) {
              console.error(`Error adding ${menuItem.title} for user ${userId}:`, insertError);
            } else {
              console.log(`Added ${menuItem.title} for user ${userId}`);
            }
          }
        }
      }
      
      toast.success("Missing menu items added successfully!");
    } catch (error) {
      console.error("Error adding missing menu items:", error);
      toast.error("Failed to add missing menu items");
    } finally {
      setLoading(false);
    }
  };

  return null; // Removed the Card component as requested
};

export default AddMissingMenuItems;