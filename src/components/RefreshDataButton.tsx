import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageLoadingModal } from '@/components/LoadingSkeletons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RefreshDataButtonProps {
  onRefresh: () => Promise<void>;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const RefreshDataButton = ({ onRefresh, className, variant = "ghost", size = "icon" }: RefreshDataButtonProps) => {
  const { t } = useI18n();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsModalOpen(true);
    try {
      await onRefresh();
      toast.success(t('data_updated') || 'Data updated successfully');
    } catch (e) {
      console.error(e);
      toast.error(t('update_failed') || 'Failed to update data');
    } finally {
      setIsRefreshing(false);
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={cn("h-8 w-8", className)}
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={t('refresh_data') || 'Refresh data'}
              aria-label={t('refresh_data') || 'Refresh data'}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('refresh_data') || 'Refresh data'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isModalOpen && (
        <PageLoadingModal
          title={t('updating_data') || 'Updating Data'}
          subtitle={t('updating_data_desc') || 'Please wait while we synchronize your data with the server...'}
          icon={() => <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />}
        />
      )}
    </>
  );
};
