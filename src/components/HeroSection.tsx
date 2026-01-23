"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleStartClick = useCallback(() => {
    navigate("/user-auth");
  }, [navigate]);

  return (
    <section className="relative flex items-center overflow-hidden bg-background min-h-[calc(100vh-4rem)]">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-success/25 via-primary/10 to-transparent blur-3xl animate-blob-slower" />
        <div className="absolute -bottom-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-primary/20 via-success/10 to-transparent blur-3xl animate-blob-slowest" />
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22] bg-[radial-gradient(closest-side_at_50%_50%,hsl(var(--primary)/0.14),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.08] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_70%)]" />
      </div>

      <div className="container relative z-10">
        <div className={`flex flex-col lg:flex-row gap-10 lg:gap-16 items-center py-10 md:py-14 ${isVisible ? 'animate-fade-slide-up' : 'opacity-0'}`}>
          
          {/* Left Content */}
          <div className="flex-1 flex flex-col items-start text-left max-w-2xl">
            {/* Top Banner */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-md mb-6 animate-bob">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              {t("hero_banner_supplier_prices")}
            </div>

            {/* Main Title */}
            <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              {t('hero_title_create')}{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">{t('hero_title_visible')}</span>
                <span className="absolute -bottom-1 left-0 right-0 h-3 bg-primary/20 -skew-x-3"></span>
              </span>{" "}
              {t('hero_title_everywhere')}
            </h1>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="animate-bob will-change-transform [animation-duration:3.6s] [animation-delay:450ms]">
                <Button
                  variant="hero"
                  size="lg"
                  className="text-lg px-14 py-7 rounded-lg min-w-[16rem] sm:min-w-[18rem] justify-center group"
                  onClick={handleStartClick}
                >
                  {t('hero_cta_start')}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {['МГ', 'ТС', 'ОК', 'ВП', 'ДЗ'].map((initials, i) => (
                  <div
                    key={i}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background text-xs font-semibold shadow-md"
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
          <div className="flex-1 w-full lg:max-w-none lg:mr-[calc(50%-50vw-2rem)]">
            <div className="relative flex items-center justify-center pt-6 pb-2 lg:justify-end">
              <img
                src="/proposition-phone.svg"
                alt="Phone"
                className="relative z-10 w-[15rem] sm:w-[17rem] md:w-[19rem] lg:w-[17.5rem] xl:w-[18rem] drop-shadow-2xl animate-float-slow will-change-transform lg:-mr-[100px] lg:translate-x-[140px] lg:translate-y-16"
                draggable={false}
              />
              <img
                src="/proposition-charts.svg"
                alt="Charts"
                className="pointer-events-none relative w-full max-w-[44rem] opacity-90 dark:opacity-80 lg:w-[28rem] lg:max-w-none xl:w-[32rem] lg:-translate-y-6"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
