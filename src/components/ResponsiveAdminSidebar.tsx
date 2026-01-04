import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

import { UserProfile } from '@/components/ui/profile-types';

interface ResponsiveAdminSidebarProps {
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  userProfile?: UserProfile;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export const ResponsiveAdminSidebar: React.FC<ResponsiveAdminSidebarProps> = ({
  collapsed = false,
  onCollapseChange,
  userProfile,
  mobileOpen: controlledMobileOpen,
  onMobileOpenChange,
}) => {
  const isMobile = useIsMobile();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  
  const mobileOpen = controlledMobileOpen !== undefined ? controlledMobileOpen : internalMobileOpen;
  const setMobileOpen = onMobileOpenChange || setInternalMobileOpen;

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
          </SheetHeader>
          <div className="h-full flex flex-col">
            <AdminSidebar 
              collapsed={false} 
              onCollapseChange={() => setMobileOpen(false)} 
              userProfile={userProfile} 
              isMobileSheet={true}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return <AdminSidebar collapsed={collapsed} onCollapseChange={onCollapseChange} userProfile={userProfile} />;
};

export default ResponsiveAdminSidebar;
