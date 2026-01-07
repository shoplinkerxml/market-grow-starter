import { useCallback, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTheme } from "next-themes";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/lib/user-auth-schemas";
import type { UserProfile as UIUserProfile } from "@/components/ui/profile-types";
import type { UserProtectedOutletContext } from "@/components/user-layout/types";
import { UserMenuProvider } from "@/components/user-layout/menu-context";
import { UserLayoutContent } from "@/components/user-layout/content";

const UserLayout = () => {
  const {
    t,
    lang,
    setLang
  } = useI18n();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const outlet = useOutletContext<UserProtectedOutletContext | null>();
  const hasAccess = outlet?.hasAccess ?? true;
  const ctxUser = outlet?.user ?? null;
  const ctxUiUserProfile = outlet?.uiUserProfile ?? null;
  const subscription = outlet?.subscription ?? null;
  const tariffLimits = outlet?.tariffLimits ?? [];
  const ctxMenuItems = outlet?.menuItems ?? [];
  const refresh = outlet?.refresh ?? (async () => {});
  const bootstrapping = outlet?.bootstrapping === true;
  const contentBlocked = outlet?.contentBlocked === true || outlet?.authLoading === true;
  const contentLoader = outlet?.authLoader ?? { title: "Завантаження…", subtitle: "Готуємо дані" };

  const user: UserProfile = useMemo(() => {
    return (
      ctxUser ?? {
        id: "loading",
        email: "",
        name: "…",
        role: "user",
        status: "active",
        avatar_url: "",
        created_at: "",
        updated_at: "",
      }
    );
  }, [ctxUser]);

  const uiUserProfile: UIUserProfile = useMemo(() => {
    return (
      ctxUiUserProfile ?? {
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url || "",
      }
    );
  }, [ctxUiUserProfile, user.avatar_url, user.email, user.name, user.role]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/user-auth", { replace: true });
  }, [navigate]);
  const handleProfileNavigation = useCallback(
    (path: string) => {
      setProfileSheetOpen(false);
      navigate(path);
    },
    [navigate],
  );
  const handleLogout = useCallback(() => {
    setProfileSheetOpen(false);
    signOut();
  }, [signOut]);
  const { theme, setTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);
  if (!bootstrapping && !contentBlocked && !ctxUser) {
    return <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access your dashboard.</p>
        </div>
      </div>;
  }
  return (
    <UserMenuProvider userId={user.id} hasAccess={hasAccess} menuItems={ctxMenuItems}>
      <UserLayoutContent
        user={user}
        uiUserProfile={uiUserProfile}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        profileSheetOpen={profileSheetOpen}
        setProfileSheetOpen={setProfileSheetOpen}
        toggleTheme={toggleTheme}
        lang={lang}
        setLang={setLang}
        t={t}
        handleProfileNavigation={handleProfileNavigation}
        handleLogout={handleLogout}
        refreshUserData={refresh}
        guardSubscription={subscription}
        guardTariffLimits={tariffLimits}
        contentBlocked={contentBlocked}
        contentLoader={contentLoader}
      />
    </UserMenuProvider>
  );
};
export default UserLayout;
