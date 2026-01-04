import { useState, useEffect, useCallback } from 'react';
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
import { Package, Edit, Trash2, Loader2 } from 'lucide-react';
import { useI18n } from "@/i18n";
import { ProductService, type Product } from '@/lib/product-service';
import { toast } from 'sonner';

interface ProductsListProps {
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onCreateNew?: () => void;
  onProductsLoaded?: (count: number) => void;
  refreshTrigger?: number;
}

export const ProductsList = ({ 
  onEdit, 
  onDelete, 
  onCreateNew, 
  onProductsLoaded,
  refreshTrigger 
}: ProductsListProps) => {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null
  });

  

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ProductService.getProducts();
      setProducts(data);
      onProductsLoaded?.(data.length);
    } catch (error: any) {
      console.error('Load products error:', error);
      toast.error(error?.message || t('failed_load_products'));
    } finally {
      setLoading(false);
    }
  }, [onProductsLoaded, t]);

  useEffect(() => {
    loadProducts();
  }, [refreshTrigger, loadProducts]);

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.product) return;

    try {
      await onDelete?.(deleteDialog.product.id);
      setDeleteDialog({ open: false, product: null });
      loadProducts();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.message || t('failed_delete_product'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center">
        <div
          className="rounded-xl border border-primary/20 bg-card/80 shadow-lg backdrop-blur-sm p-6 md:p-8"
          data-testid="user_products_empty_wrap"
        >
          <Empty className="border-0 max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>{t('no_products')}</EmptyTitle>
            <EmptyDescription>
              {t('no_products_description')}
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onCreateNew} className="mt-4">
            <Package className="h-4 w-4 mr-2" />
            {t('add_product')}
          </Button>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <Package className="h-8 w-8 text-emerald-600" />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:!bg-success-light hover:text-success"
                    onClick={() => onEdit?.(product)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:!bg-success-light"
                    onClick={() => setDeleteDialog({ open: true, product })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="mt-2">{product.name}</CardTitle>
              <CardDescription>
                {new Date(product.created_at).toLocaleDateString('uk-UA')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                {product.price && (
                  <span className="font-semibold text-emerald-600">
                    ₴{product.price.toFixed(2)}
                  </span>
                )}
                {/* SKU removed per schema update */}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={product.available ? "text-green-600" : "text-gray-400"}>
                  {product.available ? 'Активний' : 'Неактивний'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, product: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_product_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Продукт "{deleteDialog.product?.name}" буде повністю видалено з системи.
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
