import React, { useState } from 'react';
import { SheetNoOverlay, SheetNoOverlayContent, SheetNoOverlayHeader, SheetNoOverlayTitle, SheetNoOverlayTrigger } from './sheet-no-overlay';
import { ProfileTrigger, CollapsedLogoutButton } from './profile-trigger';
import { ProfileSheetContent } from './profile-sheet-content';
import { UserProfile } from './profile-types';
import { useI18n } from "@/i18n";
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { MoreHorizontal, User, LogOut } from 'lucide-react';
import { Button } from './button';

export interface UserProfileSectionProps {
  collapsed?: boolean;
  onLogout: () => void;
  userProfile?: UserProfile;
}

export const UserProfileSection: React.FC<UserProfileSectionProps> = ({
  collapsed = false,
  onLogout,
  userProfile,
}) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);

  const handleProfileClick = () => {
    setIsProfileSheetOpen(true);
  };

  const handleNavigate = (path: string) => {
    setIsProfileSheetOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setIsProfileSheetOpen(false);
    onLogout();
  };

  return (
    <div className="mt-auto">
      <SheetNoOverlay open={isProfileSheetOpen} onOpenChange={setIsProfileSheetOpen}>
        <SheetNoOverlayTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ProfileTrigger
                userProfile={userProfile}
                position="sidebar"
                collapsed={collapsed}
                onClick={handleProfileClick}
              />
            </div>
            {!collapsed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid="admin_profileMenu_trigger">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48" data-testid="admin_profileMenu_content">
                  <DropdownMenuItem onClick={() => handleNavigate('/admin/personal')} data-testid="admin_profileMenu_profile">
                    <User className="mr-2 h-4 w-4" />
                    {t('profile') || 'Profile'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="focus:text-destructive" data-testid="admin_profileMenu_logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('logout') || 'Log out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </SheetNoOverlayTrigger>
        <SheetNoOverlayContent side="right" className="w-96">
          <SheetNoOverlayHeader>
            <SheetNoOverlayTitle>{t("user_profile")}</SheetNoOverlayTitle>
          </SheetNoOverlayHeader>
          <ProfileSheetContent
            userProfile={userProfile}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onClose={() => setIsProfileSheetOpen(false)}
          />
        </SheetNoOverlayContent>
      </SheetNoOverlay>

      {/* Show logout button separately when collapsed */}
      {collapsed && (
        <div className="mt-3">
          <CollapsedLogoutButton
            onLogout={onLogout}
            label={t('logout') || 'Logout'}
          />
        </div>
      )}
    </div>
  );
};

export default UserProfileSection;
