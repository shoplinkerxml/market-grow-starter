import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Truck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { SuppliersList } from '@/components/user/suppliers';
import { SupplierForm } from '@/components/user/suppliers';
import { SupplierService, type Supplier } from '@/lib/supplier-service';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSuppliers } from "@/hooks/useSuppliers";

type ViewMode = 'list' | 'create' | 'edit';

export const Suppliers = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const queryClient = useQueryClient();

  const { tariffLimits, user } = useOutletContext<{ tariffLimits: Array<{ limit_name: string; value: number }>; user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const supplierLimit = useMemo(() => {
    return (
      (tariffLimits || []).find((l) => {
        const n = String(l.limit_name || '').toLowerCase();
        return n.includes('постач') || n.includes('supplier');
      })?.value ?? 0
    );
  }, [tariffLimits]);

  const suppliersQueryKey = useMemo(() => ["user", uid, "suppliers", "list"] as const, [uid]);

  const { data: suppliersData } = useSuppliers(uid);

  const suppliersCount = suppliersData?.length ?? 0;
  const canCreate = suppliersCount < supplierLimit;

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewMode('edit');
  };

  const handleCreateNew = () => {
    if (!canCreate) {
      toast.error(t('suppliers_limit_reached') + '. ' + t('upgrade_plan'));
      return;
    }
    setSelectedSupplier(null);
    setViewMode('create');
  };

  const handleBackToList = () => {
    setSelectedSupplier(null);
    setViewMode('list');
  };

  const handleDelete = async (id: number) => {
    const previous = queryClient.getQueryData<Supplier[]>(suppliersQueryKey);
    queryClient.setQueryData<Supplier[]>(suppliersQueryKey, (old) => {
      const list = Array.isArray(old) ? old : [];
      return list.filter((s) => Number(s.id) !== Number(id));
    });
    try {
      await SupplierService.deleteSupplier(id);
      toast.success(t('supplier_deleted'));
    } catch (error: unknown) {
      queryClient.setQueryData(suppliersQueryKey, previous);
      const message = error instanceof Error ? error.message : '';
      toast.error(message || t('failed_delete_supplier'));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={
          viewMode === 'list' 
            ? t('suppliers_title') 
            : viewMode === 'create' 
            ? t('create_supplier') 
            : t('edit_supplier')
        }
        description={
          viewMode === 'list' 
            ? t('suppliers_description') 
            : viewMode === 'create'
            ? t('create_supplier_description')
            : t('edit_supplier_description')
        }
        breadcrumbItems={breadcrumbs}
        actions={
          <div className="flex gap-2 items-center">
            {viewMode === 'list' && (
              <>
                <Badge variant="outline" className="text-sm flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  <span>{suppliersCount} / {supplierLimit}</span>
                </Badge>
                <Button 
                  variant="ghost"
                  size="icon"
                  title={t('refresh') || 'Оновити'}
                  onClick={() => {
                    SupplierService.clearSuppliersCache();
                    void queryClient.invalidateQueries({ queryKey: suppliersQueryKey });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {suppliersCount > 0 && (
                  <Button 
                    onClick={handleCreateNew}
                    disabled={!canCreate}
                    variant="ghost"
                    size="icon"
                    title={t('add_supplier')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {viewMode !== 'list' && (
              <Button
                variant="ghost"
                onClick={handleBackToList}
                className="shrink-0 group inline-flex items-center gap-2 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                title={t('back_to_suppliers')}
              >
                <span className="inline sm:hidden">{t('back_to_suppliers')}</span>
                <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-8 h-8 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </Button>
            )}
          </div>
        }
      />

      {viewMode === 'list' && (
        <SuppliersList
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
        />
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <SupplierForm
          supplier={selectedSupplier}
          onSuccess={handleBackToList}
          onCancel={handleBackToList}
        />
      )}
    </div>
  );
};
