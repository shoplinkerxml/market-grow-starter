import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/i18n';
import { LimitsList, LimitForm } from '@/components/admin/limits';
import { LimitService, type LimitTemplate } from '@/lib/limit-service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';

type ViewMode = 'list' | 'create' | 'edit';

export const LimitTemplates = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedLimit, setSelectedLimit] = useState<LimitTemplate | undefined>();
  const [saving, setSaving] = useState(false);
  const [limitsCount, setLimitsCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectLimit = (limit: LimitTemplate) => {
    setSelectedLimit(limit);
    setViewMode('edit');
  };

  const handleSaveLimit = async (data: { name: string; code: string; path?: string; description?: string }) => {
    setSaving(true);
    try {
      if (viewMode === 'edit' && selectedLimit) {
        await LimitService.updateLimit(selectedLimit.id, data);
        toast.success(t('limit_updated'));
      } else {
        await LimitService.createLimit(data);
        toast.success(t('limit_created'));
      }
      
      setViewMode('list');
      setSelectedLimit(undefined);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error?.message || t('failed_save_limit'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLimit = async (id: number) => {
    try {
      await LimitService.deleteLimit(id);
      toast.success(t('limit_deleted'));
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Delete error:', error);
      throw error;
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setSelectedLimit(undefined);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={
          viewMode === 'list' 
            ? t('limits_title') 
            : viewMode === 'create' 
              ? t('create_limit') 
              : t('edit_limit_main')
        }
        description={
          viewMode === 'list' 
            ? t('limits_description') 
            : viewMode === 'create'
              ? t('create_limit_description')
              : t('edit_limit_description')
        }
        breadcrumbItems={breadcrumbs}
        actions={
          <div className="flex gap-2">
            {viewMode !== 'list' && (
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="shrink-0 group inline-flex items-center gap-2 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                title={t('back_to_limits')}
              >
                <span className="inline sm:hidden">{t('back_to_limits')}</span>
                <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-8 h-8 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </Button>
            )}
            {viewMode === 'list' && limitsCount > 0 && (
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('create_limit')}
              </Button>
            )}
          </div>
        }
      />

      {viewMode === 'list' && (
        <LimitsList
          onEdit={handleSelectLimit}
          onDelete={handleDeleteLimit}
          onCreateNew={() => setViewMode('create')}
          onLimitsLoaded={setLimitsCount}
          refreshTrigger={refreshTrigger}
        />
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <LimitForm
          limit={selectedLimit}
          onSave={handleSaveLimit}
          onCancel={handleCancel}
          saving={saving}
        />
      )}
    </div>
  );
};
