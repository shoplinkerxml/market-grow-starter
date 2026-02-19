import React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from './button';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { ProfileTriggerProps } from './profile-types';

/**
 * Unified profile trigger component that adapts to header and sidebar positions
 * Supports responsive states and consistent styling across both contexts
 */
export const ProfileTrigger = React.forwardRef<HTMLElement, ProfileTriggerProps>((
  {
    userProfile,
    position,
    collapsed = false,
    onClick,
  },
  ref
) => {
  const defaultAdminAvatarUrl = "https://ehznqzaumsnjkrntaiox.supabase.co/storage/v1/object/public/admin/admin.webp";
  const userInfo = userProfile || {
    name: "Administrator",
    email: "admin@example.com", 
    role: "Business",
    avatarUrl: defaultAdminAvatarUrl,
    status: "active",
  };

  const getAvatarFallback = () => {
    if (userInfo.name) {
      return userInfo.name.charAt(0).toUpperCase();
    }
    return "A";
  };

  // Ensure avatar URL is valid or use placeholder
  const getAvatarUrl = () => {
    const url = userInfo.avatarUrl?.trim();
    return url && url !== '' ? url : defaultAdminAvatarUrl;
  };
  const statusRingClass = userInfo.status === "active" ? "ring-emerald-500" : "ring-red-500";

  // Header position logic
  if (position === 'header') {
    return (
      <div 
        ref={ref as React.RefObject<HTMLDivElement>}
        role="button" 
        className="pl-2 pr-3 py-1 h-auto rounded-lg select-none cursor-pointer hover:bg-emerald-50 transition-colors dark:hover:bg-transparent dark:hover:border-emerald-500/50 dark:border dark:border-transparent"
        onClick={onClick}
        data-testid="admin_profileTrigger_header"
      >
        <div className="flex items-center">
          <Avatar className={`h-8 w-8 ring-2 ring-offset-2 ring-offset-background ${statusRingClass}`}>
            <AvatarImage src={getAvatarUrl()} alt="Admin" />
            <AvatarFallback className="bg-emerald-100 text-emerald-600 font-medium dark:bg-emerald-900/40 dark:text-emerald-200">
              {getAvatarFallback()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    );
  }

  // Sidebar position logic
  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClick}
              className="w-10 h-10 p-0 hover:bg-emerald-50 hover:border-emerald-200/30 border border-transparent transition-all duration-200 dark:hover:bg-transparent dark:hover:border-emerald-500/60"
              aria-label="User Profile"
            >
              <Avatar className={`h-6 w-6 ring-2 ring-offset-2 ring-offset-background ${statusRingClass}`}>
                <AvatarImage src={getAvatarUrl()} alt="Admin" />
                <AvatarFallback className="bg-emerald-100 text-emerald-600 text-xs font-medium dark:bg-emerald-900/40 dark:text-emerald-200">
                  {getAvatarFallback()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {userInfo.name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Sidebar expanded state
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      className="w-full flex items-center pl-2 pr-3 py-1 h-auto rounded-lg transition-colors group cursor-pointer select-none hover:bg-emerald-50 dark:hover:bg-transparent dark:hover:border-emerald-500/50 border border-transparent"
      aria-label={userInfo.name}
    >
      <Avatar className={`h-8 w-8 ring-2 ring-offset-2 ring-offset-background ${statusRingClass}`}>
        <AvatarImage src={getAvatarUrl()} alt={userInfo.name} />
        <AvatarFallback className="bg-emerald-100 text-emerald-600 font-medium dark:bg-emerald-900/40 dark:text-emerald-200">
          {getAvatarFallback()}
        </AvatarFallback>
      </Avatar>
    </button>
  );
});

ProfileTrigger.displayName = 'ProfileTrigger';

/**
 * Separate logout button component for collapsed sidebar state
 */
interface CollapsedLogoutButtonProps {
  onLogout: () => void;
  label: string;
}

export const CollapsedLogoutButton: React.FC<CollapsedLogoutButtonProps> = ({
  onLogout,
  label,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="w-10 h-10 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 border border-transparent hover:border-destructive/20"
            aria-label={label}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProfileTrigger;
