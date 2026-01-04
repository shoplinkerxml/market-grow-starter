import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { Building2, Edit, Trash2, Globe, Link, Phone, Truck } from 'lucide-react';
import { useI18n } from "@/i18n";
import { SupplierService, type Supplier } from '@/lib/supplier-service';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { FullPageLoader } from '@/components/LoadingSkeletons';

interface SuppliersListProps {
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (id: number) => void;
  onCreateNew?: () => void;
}

export const SuppliersList = ({ 
  onEdit, 
  onDelete, 
  onCreateNew
}: SuppliersListProps) => {
  const { t } = useI18n();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const { data: suppliersData, isLoading: loading } = useQuery<Supplier[]>({
    queryKey: ['user', uid, 'suppliers', 'list'],
    queryFn: async () => {
      return await SupplierService.getSuppliers();
    },
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as Supplier[] | undefined,
  });
  const suppliers: Supplier[] = suppliersData ?? [];
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null
  });

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.supplier) return;

    try {
      await onDelete?.(deleteDialog.supplier.id);
      setDeleteDialog({ open: false, supplier: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message || t('failed_delete_supplier'));
    }
  };

  if (loading) {
    return (
      <FullPageLoader
        title={t('suppliers_title')}
        subtitle={t('suppliers_description')}
        icon={Truck}
      />
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex justify-center">
        <Empty className="border max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>{t('no_suppliers')}</EmptyTitle>
            <EmptyDescription>
              {t('no_suppliers_description')}
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onCreateNew} className="mt-4">
            <Building2 className="h-4 w-4 mr-2" />
            {t('add_supplier')}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier) => (
          <Card
            key={supplier.id}
            className="card-elevated card-elevated-hover cursor-pointer"
            onClick={() => onEdit?.(supplier)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <Building2 className="h-8 w-8 text-emerald-600" />
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => onEdit?.(supplier)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog({ open: true, supplier })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="mt-2">{supplier.supplier_name}</CardTitle>
              <CardDescription>
                {new Date(supplier.created_at).toLocaleDateString('uk-UA')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                {supplier.website_url ? (
                  <a 
                    href={supplier.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-emerald-600 truncate"
                  >
                    {supplier.website_url}
                  </a>
                ) : (
                  <span className="truncate opacity-70">{t('supplier_website_empty')}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link className="h-4 w-4" />
                {supplier.xml_feed_url ? (
                  <span className="truncate">
                    {supplier.xml_feed_url}
                  </span>
                ) : (
                  <span className="truncate opacity-70">
                    {t('supplier_xml_feed_empty')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {supplier.phone ? (
                  <span className="truncate">
                    {supplier.phone}
                  </span>
                ) : (
                  <span className="truncate opacity-70">
                    {t('supplier_phone_empty')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, supplier: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_supplier_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Постачальник "{deleteDialog.supplier?.supplier_name}" буде повністю видалено з системи.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
