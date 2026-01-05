"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'without' | 'with'>('with');
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

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
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-md mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              {t('hero_live_banner')}
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

            {/* Subtitle */}
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
              {t('hero_subtitle_new')}
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button 
                variant="hero" 
                size="lg" 
                className="text-lg px-8 py-7 rounded-lg group" 
                onClick={() => navigate('/user-register')}
              >
                {t('hero_cta_start')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-7 rounded-lg border-border/60 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                onClick={() => {
                  const element = document.getElementById('features');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('hero_cta_how_it_works')}
              </Button>
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
              <p className="text-sm text-muted-foreground">
                {t('hero_social_proof_prefix')}{" "}
                <span className="font-bold text-foreground">250+</span>{" "}
                {t('hero_social_proof_suffix')}
              </p>
            </div>
          </div>

          {/* Right Content - Comparison Cards */}
          <div className="flex-1 w-full max-w-xl">
            {/* Tabs */}
            <div className="flex justify-center gap-2 mb-4">
              <button
                onClick={() => setActiveTab('without')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'without'
                    ? 'bg-destructive/10 text-destructive border border-destructive/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted/80 border border-transparent'
                }`}
              >
                {t('hero_tab_without')}
              </button>
              <button
                onClick={() => setActiveTab('with')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'with'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted/80 border border-transparent'
                }`}
              >
                {t('hero_tab_with')}
              </button>
            </div>

            {/* Comparison Card */}
            <div className={`relative rounded-2xl border p-6 backdrop-blur-md transition-all duration-500 ${
              activeTab === 'without' 
                ? 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10' 
                : 'border-primary/30 bg-primary/5 dark:bg-primary/10'
            }`}>
              {/* Rating Display */}
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground mb-2">{t('hero_efficiency_rating')}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className={`text-6xl font-bold tabular-nums ${
                    activeTab === 'without' ? 'text-destructive' : 'text-primary'
                  }`}>
                    {activeTab === 'without' ? '12' : '94'}
                  </span>
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                {/* Progress Bar */}
                <div className="mt-4 h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      activeTab === 'without' ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: activeTab === 'without' ? '12%' : '94%' }}
                  />
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                {activeTab === 'without' ? (
                  <>
                    <FeatureItem icon="x" text={t('hero_without_1')} />
                    <FeatureItem icon="x" text={t('hero_without_2')} />
                    <FeatureItem icon="x" text={t('hero_without_3')} />
                  </>
                ) : (
                  <>
                    <FeatureItem icon="check" text={t('hero_with_1')} />
                    <FeatureItem icon="check" text={t('hero_with_2')} />
                    <FeatureItem icon="check" text={t('hero_with_3')} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ icon, text }: { icon: 'check' | 'x'; text: string }) {
  const isCheck = icon === 'check';
  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 mt-0.5 ${isCheck ? 'text-primary' : 'text-destructive'}`}>
        {isCheck ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
      </div>
      <span className={`text-sm leading-relaxed ${isCheck ? 'text-foreground' : 'text-muted-foreground'}`}>
        {text}
      </span>
    </div>
  );
}
