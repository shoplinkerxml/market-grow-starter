"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TrendingUp, Menu, X, Globe, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const {
    t,
    lang,
    setLang
  } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    setLang(lang === 'uk' ? 'en' : 'uk');
  };
  return (
    <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <header className={`sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 transition-[border-color] duration-300 ${isScrolled ? 'border-b border-border' : 'border-b border-transparent'}`}>
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center justify-center gap-2">
            <div className="bg-gradient-success p-2 rounded-lg shadow-glow ring-1 ring-white/10">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span data-testid="header_brand" className="inline-flex items-center font-sans text-2xl font-semibold leading-none text-foreground">
              <span className="md:hidden">MG</span>
              <span className="hidden md:inline">{t('brand_name')}</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <a href="/docs" aria-label={t("nav_api_docs")}>
                <FileText className="h-5 w-5" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleLanguage} className="relative">
              <Globe className="h-5 w-5" />
              <span className="sr-only">{t("toggle_language")}</span>
            </Button>
            <ThemeToggle />
            <div className="animate-bob will-change-transform [animation-duration:3.6s]">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                onClick={() => navigate('/user-auth')}
              >
                {t('hero_cta_start')}
              </Button>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-0.5 pr-1">
            <Button asChild variant="ghost" size="icon">
              <a href="/docs" aria-label={t("nav_api_docs")}>
                <FileText className="h-5 w-5" />
              </a>
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleLanguage}>
              <Globe className="h-5 w-5" />
            </Button>

            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <SheetContent side="right" className="md:hidden w-[min(22rem,85vw)] p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-10 flex flex-col gap-3">
          <div className="animate-bob will-change-transform [animation-duration:3.6s]">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsMenuOpen(false);
                navigate('/user-auth');
              }}
            >
              {t('hero_cta_start')}
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
