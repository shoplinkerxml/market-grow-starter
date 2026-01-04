"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeBulletIndex, setActiveBulletIndex] = useState(0);
  const [isBulletsHovered, setIsBulletsHovered] = useState(false);
  const {
    t
  } = useI18n();
  const navigate = useNavigate();
  useEffect(() => {
    setIsVisible(true);
  }, []);
  const bullets = [{
    key: "hero_bullet_1"
  }, {
    key: "hero_bullet_2"
  }, {
    key: "hero_bullet_3"
  }];
  useEffect(() => {
    if (isBulletsHovered) return;
    const id = window.setInterval(() => {
      setActiveBulletIndex(prev => (prev + 1) % bullets.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [isBulletsHovered, bullets.length]);
  return <section className="relative flex items-center overflow-hidden bg-background min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-success/25 via-primary/10 to-transparent blur-3xl animate-blob-slower" />
        <div className="absolute -bottom-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-primary/20 via-success/10 to-transparent blur-3xl animate-blob-slowest" />
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22] bg-[radial-gradient(closest-side_at_50%_50%,hsl(var(--primary)/0.14),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.08] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_70%)]" />
      </div>

      <div className="container relative z-10">
        <div className={`mx-auto flex max-w-5xl flex-col items-center py-10 text-center md:py-14 ${isVisible ? 'animate-fade-slide-up' : 'opacity-0'}`}>
          <div onMouseEnter={() => setIsBulletsHovered(true)} onMouseLeave={() => setIsBulletsHovered(false)} className="relative flex flex-wrap items-center justify-center gap-2">
            <div className="pointer-events-none absolute -inset-x-10 -inset-y-4 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-2xl opacity-60 motion-reduce:hidden" />
            {bullets.map((b, idx) => {
            const isActive = idx === activeBulletIndex;
            return <button key={b.key} type="button" onClick={() => setActiveBulletIndex(idx)} className={`relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm backdrop-blur-md transition-all ${isActive ? 'border-primary/30 bg-primary/10 text-foreground shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]' : 'border-border/60 bg-background/30 text-muted-foreground hover:bg-background/45 hover:text-foreground hover:border-primary/20'}`}>
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
                    {isActive ? <span className="absolute inset-0 rounded-full bg-primary/40 motion-reduce:hidden animate-ping" /> : null}
                  </span>
                  <span>{t(b.key)}</span>
                </button>;
          })}
          </div>

          <h1 className="mt-7 text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
            {t('hero_title_1')}{" "}
            <span className="relative text-primary">
              {t('hero_title_accent')}
              <span className="pointer-events-none absolute -bottom-2 left-0 h-[10px] w-full bg-primary/15 blur-xl" />
            </span>{" "}
            {t('hero_title_2')}
          </h1>

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-3xl md:text-xl">
            {t('hero_subtitle')}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="hero" size="lg" className="text-lg px-8 py-7 rounded-lg group" onClick={() => navigate('/user-register')}>
              {t('hero_cta_primary')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className={`relative mt-10 w-full flex justify-center ${isVisible ? 'animate-fade-slide-up' : 'opacity-0'}`} style={{
          animationDelay: '0.2s'
        }}>
            <div className="relative group max-w-4xl w-full">
              {/* Glow effects - adjusted for laptop shape */}
              <div className="absolute -inset-10 rounded-[2.25rem] bg-gradient-to-r from-primary/30 via-success/10 to-primary/10 blur-3xl opacity-60 group-hover:opacity-80 transition-opacity motion-reduce:hidden" />
              
              {/* CSS Laptop Mockup */}
              <div className="relative mx-auto">
                {/* Laptop Top (Screen) */}
                <div className="relative mx-auto border-gray-950 dark:border-gray-950 bg-gray-950 border-[8px] rounded-t-xl h-[172px] max-w-[301px] md:h-[294px] md:max-w-[512px] shadow-2xl transition-transform duration-700 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.01]">
                    <div className="relative h-full w-full bg-gray-50 dark:bg-gray-900 overflow-hidden select-none flex flex-col">
                        {/* Mock Header */}
                        <div className="h-8 border-b bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center px-4 justify-between shrink-0">
                           <div className="flex items-center gap-3">
                              <div className="h-4 w-4 rounded bg-primary"></div>
                              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
                           </div>
                           <div className="flex gap-2">
                              <div className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                              <div className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                           </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                           {/* Mock Sidebar */}
                           <div className="w-14 md:w-20 border-r bg-white dark:bg-gray-800 dark:border-gray-700 flex flex-col items-center py-3 gap-3 shrink-0">
                              <div className="h-6 w-8 md:w-12 rounded bg-primary/10"></div>
                              <div className="h-6 w-8 md:w-12 rounded bg-gray-100 dark:bg-gray-700/50"></div>
                              <div className="h-6 w-8 md:w-12 rounded bg-gray-100 dark:bg-gray-700/50"></div>
                           </div>
                           {/* Mock Content */}
                           <div className="flex-1 p-3 md:p-5 flex flex-col gap-3 md:gap-4 overflow-hidden bg-gray-50/50 dark:bg-gray-900/50">
                              {/* Product Card / Stats Row */}
                              <div className="grid grid-cols-3 gap-3">
                                  <div className="rounded-lg border bg-white p-2 md:p-3 shadow-sm dark:bg-gray-800 dark:border-gray-700 flex flex-col gap-1.5">
                                     <div className="h-1.5 w-8 rounded bg-gray-200 dark:bg-gray-600"></div>
                                     <div className="h-3 w-12 rounded bg-primary/20"></div>
                                  </div>
                                  <div className="rounded-lg border bg-white p-2 md:p-3 shadow-sm dark:bg-gray-800 dark:border-gray-700 flex flex-col gap-1.5">
                                     <div className="h-1.5 w-8 rounded bg-gray-200 dark:bg-gray-600"></div>
                                     <div className="h-3 w-12 rounded bg-green-500/20"></div>
                                  </div>
                                  <div className="rounded-lg border bg-white p-2 md:p-3 shadow-sm dark:bg-gray-800 dark:border-gray-700 flex flex-col gap-1.5">
                                     <div className="h-1.5 w-8 rounded bg-gray-200 dark:bg-gray-600"></div>
                                     <div className="h-3 w-12 rounded bg-blue-500/20"></div>
                                  </div>
                              </div>
                              {/* Mock Table */}
                              <div className="flex-1 rounded-lg border bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700 overflow-hidden flex flex-col">
                                 <div className="h-7 border-b bg-gray-50/50 px-3 flex items-center gap-4 dark:bg-gray-700/30">
                                    <div className="h-2 w-16 rounded bg-gray-200 dark:bg-gray-600"></div>
                                    <div className="h-2 w-12 rounded bg-gray-200 dark:bg-gray-600"></div>
                                    <div className="h-2 w-12 rounded bg-gray-200 dark:bg-gray-600 ml-auto"></div>
                                 </div>
                                 <div className="p-3 space-y-2.5">
                                    {[1, 2, 3, 4].map((i) => (
                                       <div key={i} className="flex items-center gap-4 opacity-60 md:opacity-100">
                                          <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 shrink-0"></div>
                                          <div className="flex flex-col gap-1 flex-1">
                                             <div className="h-2 w-24 rounded bg-gray-200 dark:bg-gray-600"></div>
                                             <div className="h-1.5 w-16 rounded bg-gray-100 dark:bg-gray-700"></div>
                                          </div>
                                          <div className="h-2 w-10 rounded bg-gray-100 dark:bg-gray-700 ml-auto"></div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                        {/* Screen Glare/Reflection */}
                        <div className="pointer-events-none absolute -left-1/3 top-0 h-full w-2/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer-slow motion-reduce:hidden" />
                    </div>
                </div>
                {/* Laptop Bottom (Base) */}
                <div className="relative mx-auto bg-slate-700 dark:bg-slate-700 rounded-b-xl rounded-t-sm h-[17px] max-w-[351px] md:h-[21px] md:max-w-[597px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]">
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-xl w-[56px] h-[5px] md:w-[96px] md:h-[8px] bg-slate-800"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
}
