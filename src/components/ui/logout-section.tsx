import React from 'react';
import { LogOut, User } from 'lucide-react';
import { Button } from './button';
import { Avatar, AvatarFallback } from './avatar';
import { Separator } from './separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from "@/i18n";

export interface LogoutSectionProps {
  collapsed?: boolean;
  onLogout: () => void;
  userProfile?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
  };
}

export const LogoutSection: React.FC<LogoutSectionProps> = ({
  collapsed = false,
  onLogout,
  userProfile,
}) => {
  const { t } = useI18n();

  const userInfo = userProfile || {
    name: "Admin User",
    email: "admin@marketgrow.com",
    role: "Administrator"
  };

  const renderUserProfile = () => {
    if (collapsed) return null;
    
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group cursor-pointer border border-transparent hover:border-emerald-200/30" data-testid="user-profile-section">
        <Avatar className="h-8 w-8" data-testid="user-avatar">
          <AvatarFallback className="bg-emerald-100 text-emerald-600 text-sm font-medium">
            {userInfo.name?.charAt(0) || "A"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0" data-testid="user-info">
          <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-600 transition-colors" data-testid="user-name">
            {userInfo.name}
          </p>
          <p className="text-xs text-gray-500 truncate group-hover:text-emerald-500 transition-colors" data-testid="user-role">
            {userInfo.role}
          </p>
        </div>
      </div>
    );
  };

  const logoutButton = (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "default"}
      onClick={onLogout}
      className={cn(
        "w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 border border-transparent hover:border-destructive/20",
        collapsed ? "h-10 w-10 p-0" : "px-3 py-2"
      )}
      aria-label={collapsed ? t('auth_logout' as any) : undefined}
      data-testid="logout-button"
    >
      <LogOut className={cn("h-4 w-4", !collapsed && "mr-3")} />
      {!collapsed && t('auth_logout' as any)}
    </Button>
  );

  return (
    <div className="mt-auto border-t pt-4" data-testid="logout-section">
      {renderUserProfile()}
      <div className="space-y-1 mt-3">
        {collapsed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {logoutButton}
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {t('auth_logout' as any)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          logoutButton
        )}
      </div>
    </div>
  );
};

export default LogoutSection;
