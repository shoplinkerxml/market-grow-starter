import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
export const MenuSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4, 5].map((i) => (
      <Skeleton key={i} className="h-8 w-full" />
    ))}
  </div>
);

const LoaderCard = ({
  title = 'Завантаження…',
  subtitle,
  icon: Icon,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  const GlowIcon = Icon;
  return (
    <div className="relative w-full max-w-md rounded-2xl border bg-white/80 shadow-lg">
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 blur-3xl opacity-30">
        <div className="h-40 w-40 rounded-full bg-emerald-300" />
      </div>
      <div className="relative p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          {GlowIcon ? <GlowIcon className="h-6 w-6" /> : <div className="h-6 w-6 rounded-full bg-emerald-400" />}
        </div>
        <div className="text-lg sm:text-xl font-semibold text-emerald-700">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0s]" />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
};

export const PageLoadingModal = ({
  title = 'Завантаження…',
  subtitle,
  icon: Icon,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <LoaderCard title={title} subtitle={subtitle} icon={Icon} />
      </div>
    </div>
  );
};

export const FullPageLoader = ({
  title = 'Завантаження…',
  subtitle,
  icon: Icon,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
      <LoaderCard title={title} subtitle={subtitle} icon={Icon} />
    </div>
  );
};

export const ProgressiveLoader = ({
  isLoading,
  children,
  fallback,
  delay = 200,
}: {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
}) => {
  const [showFallback, setShowFallback] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowFallback(true), delay);
      return () => clearTimeout(timer);
    }
    setShowFallback(false);
  }, [isLoading, delay]);

  if (isLoading && showFallback) {
    return <>{fallback || <FullPageLoader />}</>;
  }

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
};
