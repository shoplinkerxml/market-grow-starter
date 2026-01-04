import React from 'react';
import { Mail, User2 } from 'lucide-react';
import { Button } from './button';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { useI18n } from "@/i18n";
import { ProfileSheetContentProps } from './profile-types';

/**
 * Shared profile sheet content component used by both header and sidebar profile sections
 * Provides consistent user details display, navigation options, and logout functionality
 */
export const ProfileSheetContent: React.FC<ProfileSheetContentProps> = ({
  userProfile,
  onNavigate,
  onLogout,
  onClose,
}) => {
  const { t } = useI18n();

  const userInfo = userProfile || {
    name: "Administrator",
    email: "admin@example.com",
    role: "Business",
    avatarUrl: ""
  };

  const handleProfileClick = () => {
    onClose();
    // Check if this is a user profile or admin profile based on role
    if (userInfo.role === "admin") {
      onNavigate('/admin/personal');
    } else {
      onNavigate('/user/profile');
    }
  };

  const handleLogoutClick = () => {
    onClose();
    onLogout();
  };

  const getAvatarFallback = () => {
    if (userInfo.name) {
      return userInfo.name.charAt(0).toUpperCase();
    }
    return "A";
  };

  return (
    <div className="mt-4 space-y-6">
      {/* User Details Section */}
      <div className="flex items-center gap-3 border-b pb-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={userInfo.avatarUrl || "/placeholder.svg"} alt="Admin" />
          <AvatarFallback className="bg-emerald-100 text-emerald-600 font-medium">
            {getAvatarFallback()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-semibold">{userInfo.name}</div>
          <div className="text-sm text-muted-foreground">{userInfo.role}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {userInfo.email}
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="space-y-1">
        <Button 
          variant="ghost" 
          className="w-full justify-start h-auto py-3 hover:bg-emerald-300/10 hover:text-emerald-600 flex items-start gap-3" 
          onClick={handleProfileClick}
        >
          <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center ring-1 ring-emerald-100">
            <User2 className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-emerald-700 hover:text-emerald-600">
              {t("menu_profile")}
            </div>
            <div className="text-xs text-muted-foreground leading-snug whitespace-normal break-words">
              {t("menu_profile_desc")}
            </div>
          </div>
        </Button>
      </div>
      
      {/* Logout Section */}
      <div className="border-t pt-4">
        <Button 
          variant="default"
          className="w-full"
          onClick={handleLogoutClick}
          data-testid="admin_profileSheet_logout"
        >
          {t("logout")}
        </Button>
      </div>
    </div>
  );
};

export default ProfileSheetContent;
