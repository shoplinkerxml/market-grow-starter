/**
 * Shared TypeScript interfaces for user profile components
 * Used across AdminLayout and UserProfileSection for consistency
 */

export interface UserProfile {
  id?: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string;
}

export interface ProfileSectionProps {
  userProfile?: UserProfile;
  position: 'header' | 'sidebar';
  collapsed?: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export interface ProfileTriggerProps {
  userProfile?: UserProfile;
  position: 'header' | 'sidebar';
  collapsed?: boolean;
  onClick: () => void;
}

export interface ProfileSheetContentProps {
  userProfile?: UserProfile;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onClose: () => void;
}