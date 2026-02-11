import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AdminProvider } from '@/providers/admin-provider';
import { useI18n } from "@/i18n";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SheetNoOverlay, SheetNoOverlayContent, SheetNoOverlayHeader, SheetNoOverlayTitle, SheetNoOverlayTrigger } from '@/components/ui/sheet-no-overlay';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sun, Moon, AlignJustify, Search } from 'lucide-react';
import { ProfileTrigger } from '@/components/ui/profile-trigger';
import { ProfileSheetContent } from '@/components/ui/profile-sheet-content';
import { UserProfile } from '@/components/ui/profile-types';
import { ProfileService } from '@/lib/profile-service';
import AdminSidebar from '@/components/ResponsiveAdminSidebar';
import ContentWorkspace from '@/components/ContentWorkspace';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { FullPageLoader, ProgressiveLoader } from "@/components/LoadingSkeletons";

interface AdminLayoutInnerProps {
  children?: React.ReactNode;
  userProfile?: UserProfile | null;
  contentBlocked: boolean;
  contentLoader: { title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }> };
}

const AdminLayoutInner: React.FC<AdminLayoutInnerProps> = ({ userProfile, contentBlocked, contentLoader }) => {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      navigate("/admin-auth", { replace: true });
    }
  };

  const handleProfileNavigation = (path: string) => {
    setProfileSheetOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setProfileSheetOpen(false);
    signOut();
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="h-screen flex overflow-hidden bg-admin-page">
      {/* Responsive Sidebar */}
      <AdminSidebar 
        collapsed={sidebarCollapsed} 
        onCollapseChange={setSidebarCollapsed} 
        userProfile={userProfile}
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 bg-admin-header dark:bg-neutral-900 shadow-sm rounded-lg mx-4 mt-4 flex items-center px-4 md:px-6 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="md:inline-flex"
            >
              <AlignJustify className="h-5 w-5" />
            </Button>
            <div className="hidden md:flex ml-0">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 h-8 py-1" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-transparent cursor-pointer">
              <Sun className="h-5 w-5 hidden dark:block" />
              <Moon className="h-5 w-5 block dark:hidden" />
            </Button>
            
            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-transparent cursor-pointer" title={lang === "uk" ? "Українська" : "English"}>
                  <span className="text-lg">{lang === "uk" ? "🇺🇦" : "🇺🇸"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLang("uk")}>🇺🇦 Українська</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang("en")}>🇺🇸 English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Profile */}
            <SheetNoOverlay open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
              <SheetNoOverlayTrigger asChild>
                <ProfileTrigger
                  userProfile={userProfile}
                  position="header"
                  onClick={() => setProfileSheetOpen(true)}
                />
              </SheetNoOverlayTrigger>
              <SheetNoOverlayContent side="right" className="w-96">
                <SheetNoOverlayHeader>
                  <SheetNoOverlayTitle>{t("user_profile")}</SheetNoOverlayTitle>
                </SheetNoOverlayHeader>
                <ProfileSheetContent
                  userProfile={userProfile}
                  onNavigate={handleProfileNavigation}
                  onLogout={handleLogout}
                  onClose={() => setProfileSheetOpen(false)}
                />
              </SheetNoOverlayContent>
            </SheetNoOverlay>
          </div>
        </header>

        {/* Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-admin-page">
          <div className="p-4 md:p-6 min-h-full">
            <div className="bg-admin-content dark:bg-neutral-800 rounded-lg shadow-md min-h-[calc(100vh-8rem)]">
              {contentBlocked ? (
                <ProgressiveLoader
                  isLoading={true}
                  delay={250}
                  fallback={<FullPageLoader title={contentLoader.title} subtitle={contentLoader.subtitle} icon={contentLoader.icon} />}
                >
                  {null}
                </ProgressiveLoader>
              ) : (
                <ContentWorkspace />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

interface AdminLayoutProps {
  children?: React.ReactNode;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const outlet = useOutletContext<{
    adminAuthLoading?: boolean;
    adminAuthLoader?: { title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }> };
  } | null>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { t } = useI18n();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setProfileLoading(true);
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();
        
        if (sessionError || !user) {
          console.error('No user session:', sessionError);
          setProfileLoading(false);
          return;
        }

        // Try to get existing profile first
        const profile = await ProfileService.getProfile(user.id);
        
        if (profile) {
          // Use existing profile data
          const finalAvatarUrl = profile.avatar_url && profile.avatar_url.trim() !== '' 
            ? profile.avatar_url 
            : '/placeholder.svg';
          
          setUserProfile({
            id: user.id,
            email: user.email || '',
            name: profile.name || 'Administrator',
            role: profile.role || 'admin',
            avatarUrl: finalAvatarUrl,
          });
        } else {
          // If no profile exists, create a default admin profile
          console.warn('No profile found, creating default admin profile');
          try {
            const defaultProfile = await ProfileService.createProfileWithAuth({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'Administrator',
              role: 'admin',
              status: 'active'
            });
            
            if (defaultProfile) {
              setUserProfile({
                id: defaultProfile.id,
                email: defaultProfile.email,
                name: defaultProfile.name || 'Administrator',
                role: defaultProfile.role || 'admin',
                avatarUrl: defaultProfile.avatar_url || '/placeholder.svg',
              });
            }
          } catch (createError) {
            console.error('Failed to create default profile:', createError);
            // Still set a minimal profile so the UI can load
            setUserProfile({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'Administrator',
              role: 'admin',
              avatarUrl: '/placeholder.svg',
            });
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        // Set a default profile to prevent UI blocking
        setUserProfile({
          id: '',
          email: '',
          name: 'Administrator',
          role: 'admin',
          avatarUrl: '/placeholder.svg',
        });
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const contentBlocked = (outlet?.adminAuthLoading === true) || profileLoading;
  const contentLoader = useMemo(() => {
    if (outlet?.adminAuthLoading === true && outlet.adminAuthLoader) return outlet.adminAuthLoader;
    return { title: t("loading_admin_dashboard"), subtitle: undefined };
  }, [outlet?.adminAuthLoading, outlet?.adminAuthLoader, t]);

  return (
    <AdminProvider>
      <AdminLayoutInner userProfile={userProfile} contentBlocked={contentBlocked} contentLoader={contentLoader}>
        {children}
      </AdminLayoutInner>
    </AdminProvider>
  );
};
