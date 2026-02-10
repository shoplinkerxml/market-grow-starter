"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleStartClick = useCallback(() => {
    navigate("/user-auth");
  }, [navigate]);

  return (
    <section className="relative flex items-center overflow-hidden bg-transparent min-h-[calc(100vh-4rem)]">

      <div className="container relative z-10">
        <div className={`flex flex-col gap-10 items-center py-10 md:py-14 min-[1320px]:flex-row min-[1320px]:gap-16 ${isVisible ? 'animate-fade-slide-up' : 'opacity-0'}`}>
          
          {/* Left Content */}
          <div className="flex-1 min-w-0 flex flex-col items-center text-center max-w-2xl min-[1320px]:items-start min-[1320px]:text-left min-[1320px]:max-w-[40rem]">
            {/* Top Banner */}
            <div className="inline-flex items-start justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-left text-xs font-medium text-primary backdrop-blur-md mb-4 animate-bob self-center min-[1320px]:self-start sm:px-4 sm:py-2 sm:text-sm sm:mb-6">
              <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              <span className="min-w-0 leading-tight">{t("hero_banner_supplier_prices")}</span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              <span className="md:hidden">
                <span className="block">
                  {t('hero_title_create')}{" "}
                  <span className="relative inline-block">
                    <span className="relative z-10 text-primary">{t('hero_title_visible')}</span>
                    <span className="absolute -bottom-1 left-0 right-0 h-3 bg-primary/20 -skew-x-3"></span>
                  </span>
                </span>
                <span className="block">{t('hero_title_everywhere')}</span>
              </span>
              <span className="hidden md:inline">
                <span className="block">{t('hero_title_create')}</span>
                <span className="block">
                  <span className="relative inline-block">
                    <span className="relative z-10 text-primary">{t('hero_title_visible')}</span>
                    <span className="absolute -bottom-1 left-0 right-0 h-3 bg-primary/20 -skew-x-3"></span>
                  </span>
                </span>
                <span className="block">{t('hero_title_everywhere')}</span>
              </span>
            </h1>

            {/* CTA Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 min-[1320px]:justify-start sm:mt-8">
              <div className="animate-bob will-change-transform [animation-duration:3.6s] [animation-delay:450ms]">
                <Button
                  variant="hero"
                  size="lg"
                  className="text-base px-8 py-5 rounded-lg min-w-[12rem] w-full max-w-[18rem] justify-center group sm:text-lg sm:px-14 sm:py-7 sm:min-w-[18rem] sm:w-auto"
                  onClick={handleStartClick}
                >
                  {t('hero_cta_start')}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:mt-10 sm:flex-row sm:gap-4 min-[1320px]:justify-start">
              <div className="flex -space-x-2 sm:-space-x-3">
                {['МГ', 'ТС', 'ОК', 'ВП', 'ДЗ'].map((initials, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold shadow-md sm:h-10 sm:w-10 sm:text-xs"
                    style={{
                      background: `linear-gradient(135deg, hsl(${160 + i * 20} 60% ${45 + i * 5}%), hsl(${170 + i * 15} 50% ${35 + i * 5}%))`,
                      color: 'white'
                    }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{t("hero_social_proof_with_us")}</p>
            </div>
          </div>

          {/* Right Content */}
          <div className="w-full sm:mr-[calc(50%-50vw-2rem)] min-[1320px]:shrink-0 min-[1320px]:w-[40rem] min-[1320px]:mr-[calc(50%-50vw-2rem)] min-[1320px]:ml-auto">
            <div className="relative flex w-full items-end justify-center pt-10 pb-2 sm:justify-end">
              <img
                src={lang === 'uk' ? "/proposition-phone.svg" : "/proposition-phone-en.svg"}
                alt="Phone"
                width={336}
                height={672}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="relative z-10 w-[12.5rem] drop-shadow-2xl animate-float-slow will-change-transform translate-y-10 mr-0 sm:w-[14.5rem] sm:-mr-[90px] sm:translate-y-12 md:w-[18.5rem] md:-mr-[120px] md:translate-y-16 lg:w-[20rem] xl:w-[21rem]"
                draggable={false}
              />
              <img
                src={lang === 'uk' ? "/proposition-charts.svg" : "/proposition-charts-en.svg"}
                alt="Charts"
                className="hidden pointer-events-none relative w-full max-w-[19.5rem] opacity-90 dark:opacity-80 sm:block sm:max-w-[28rem] md:max-w-[34rem] lg:max-w-[38rem] xl:max-w-[42rem] min-[1320px]:w-[32rem] min-[1320px]:max-w-none min-[1320px]:-translate-y-6"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
