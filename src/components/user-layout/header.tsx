import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SheetNoOverlay, SheetNoOverlayContent, SheetNoOverlayHeader, SheetNoOverlayTitle, SheetNoOverlayTrigger } from "@/components/ui/sheet-no-overlay";
import { AlignJustify, Moon, Sun } from "lucide-react";
import { ProfileSheetContent } from "@/components/ui/profile-sheet-content";
import { ProfileTrigger } from "@/components/ui/profile-trigger";
import type { UserProfile as UIUserProfile } from "@/components/ui/profile-types";

export const UserHeader = memo(
  ({
    setSidebarCollapsed,
    setMobileMenuOpen,
    toggleTheme,
    lang,
    setLang,
    t,
    uiUserProfile,
    profileSheetOpen,
    setProfileSheetOpen,
    onNavigateProfile,
    onLogout,
  }: {
    setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    toggleTheme: () => void;
    lang: string;
    setLang: (lang: string) => void;
    t: (key: string) => string;
    uiUserProfile: UIUserProfile;
    profileSheetOpen: boolean;
    setProfileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onNavigateProfile: (path: string) => void;
    onLogout: () => void;
  }) => {
    const handleToggleMenu = useCallback(() => {
      if (window.innerWidth < 768) {
        setMobileMenuOpen((v) => !v);
      } else {
        setSidebarCollapsed((v) => !v);
      }
    }, [setMobileMenuOpen, setSidebarCollapsed]);

    const toggleLanguage = useCallback(() => {
      setLang(lang === "uk" ? "en" : "uk");
    }, [lang, setLang]);

    const openProfile = useCallback(() => setProfileSheetOpen(true), [setProfileSheetOpen]);
    const closeProfile = useCallback(() => setProfileSheetOpen(false), [setProfileSheetOpen]);

    return (
      <header className="h-16 bg-background flex items-center px-4 md:px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleToggleMenu} className="md:inline-flex">
            <AlignJustify className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hover:bg-transparent cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Sun className="h-5 w-5 hidden dark:block" />
            <Moon className="h-5 w-5 block dark:hidden" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLanguage}
            className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
            title={lang === "uk" ? "Українська" : "English"}
            aria-label={t("toggle_language")}
          >
            <span className="inline-flex items-center justify-center rounded-full bg-transparent text-foreground w-7 h-7 transition-colors group-hover:text-emerald-600 group-active:scale-95">
              <span className="text-lg">{lang === "uk" ? "🇺🇦" : "🇺🇸"}</span>
            </span>
          </Button>

          <SheetNoOverlay open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
            <SheetNoOverlayTrigger asChild>
              <ProfileTrigger userProfile={uiUserProfile} position="header" onClick={openProfile} />
            </SheetNoOverlayTrigger>
            <SheetNoOverlayContent side="right" className="w-96">
              <SheetNoOverlayHeader>
                <SheetNoOverlayTitle>{t("user_profile")}</SheetNoOverlayTitle>
              </SheetNoOverlayHeader>
              <ProfileSheetContent userProfile={uiUserProfile} onNavigate={onNavigateProfile} onLogout={onLogout} onClose={closeProfile} />
            </SheetNoOverlayContent>
          </SheetNoOverlay>
        </div>
      </header>
    );
  },
);
UserHeader.displayName = "UserHeader";
