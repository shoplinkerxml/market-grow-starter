import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, AlertTriangle, Sparkles, SlidersHorizontal } from 'lucide-react';
import { TariffService, type Tariff, type TariffFeature, type TariffLimit, type TariffFeatureInsert, type TariffLimitInsert } from '@/lib/tariff-service';
import { useI18n } from '@/i18n';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs, usePageInfo } from '@/hooks/useBreadcrumbs';
import { FullPageLoader } from "@/components/LoadingSkeletons";

const AdminTariffFeatures = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [features, setFeatures] = useState<TariffFeature[]>([]);
  const [limits, setLimits] = useState<TariffLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [deleteFeatureDialogOpen, setDeleteFeatureDialogOpen] = useState(false);
  const [deleteLimitDialogOpen, setDeleteLimitDialogOpen] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState<TariffFeature | null>(null);
  const [limitToDelete, setLimitToDelete] = useState<TariffLimit | null>(null);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [editingFeature, setEditingFeature] = useState<TariffFeature | null>(null);
  const [editingLimit, setEditingLimit] = useState<TariffLimit | null>(null);
  const [featureFormData, setFeatureFormData] = useState<Partial<TariffFeatureInsert>>({
    tariff_id: 0,
    feature_name: '',
    is_active: true
  });
  const [limitFormData, setLimitFormData] = useState<Partial<TariffLimitInsert>>({
    tariff_id: 0,
    limit_name: '',
    value: 0,
    is_active: true
  });

  useEffect(() => {
    fetchTariffs();
  }, []);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      const tariffData = await TariffService.getAllTariffs(true, true);
      setTariffs(tariffData);
    } catch (error) {
      console.error('Error fetching tariffs:', error);
      toast.error('Failed to load tariffs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturesAndLimits = async (tariffId: number) => {
    try {
      const [featureData, limitData] = await Promise.all([
        TariffService.getTariffFeatures(tariffId),
        TariffService.getTariffLimits(tariffId)
      ]);
      setFeatures(featureData);
      setLimits(limitData);
    } catch (error) {
      console.error('Error fetching features/limits:', error);
      toast.error('Failed to load features/limits');
    }
  };

  const handleSelectTariff = async (tariff: Tariff) => {
    setSelectedTariff(tariff);
    await fetchFeaturesAndLimits(tariff.id);
  };

  const handleCreateFeature = async () => {
    if (!selectedTariff) return;
    
    try {
      await TariffService.addTariffFeature({
        ...featureFormData,
        tariff_id: selectedTariff.id
      } as TariffFeatureInsert);
      toast.success('Feature added successfully');
      setIsFeatureDialogOpen(false);
      resetFeatureForm();
      await fetchFeaturesAndLimits(selectedTariff.id);
    } catch (error) {
      console.error('Error creating feature:', error);
      toast.error('Failed to create feature');
    }
  };

  const handleUpdateFeature = async () => {
    if (!editingFeature) return;
    
    try {
      await TariffService.updateTariffFeature(editingFeature.id, featureFormData);
      toast.success('Feature updated successfully');
      setIsFeatureDialogOpen(false);
      resetFeatureForm();
      if (selectedTariff) {
        await fetchFeaturesAndLimits(selectedTariff.id);
      }
    } catch (error) {
      console.error('Error updating feature:', error);
      toast.error('Failed to update feature');
    }
  };

  const handleDeleteFeature = async (feature: TariffFeature) => {
    setFeatureToDelete(feature);
    setDeleteFeatureDialogOpen(true);
  };

  const confirmDeleteFeature = async () => {
    if (!featureToDelete) return;
    
    try {
      await TariffService.deleteTariffFeature(featureToDelete.id);
      toast.success(t('feature_deleted_successfully'));
      if (selectedTariff) {
        await fetchFeaturesAndLimits(selectedTariff.id);
      }
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error(t('failed_to_delete_feature'));
    } finally {
      setDeleteFeatureDialogOpen(false);
      setFeatureToDelete(null);
    }
  };

  const handleCreateLimit = async () => {
    if (!selectedTariff) return;
    
    try {
      await TariffService.addTariffLimit({
        ...limitFormData,
        tariff_id: selectedTariff.id
      } as TariffLimitInsert);
      toast.success('Limit added successfully');
      setIsLimitDialogOpen(false);
      resetLimitForm();
      await fetchFeaturesAndLimits(selectedTariff.id);
    } catch (error) {
      console.error('Error creating limit:', error);
      toast.error('Failed to create limit');
    }
  };

  const handleUpdateLimit = async () => {
    if (!editingLimit) return;
    
    try {
      await TariffService.updateTariffLimit(editingLimit.id, limitFormData);
      toast.success('Limit updated successfully');
      setIsLimitDialogOpen(false);
      resetLimitForm();
      if (selectedTariff) {
        await fetchFeaturesAndLimits(selectedTariff.id);
      }
    } catch (error) {
      console.error('Error updating limit:', error);
      toast.error('Failed to update limit');
    }
  };

  const handleDeleteLimit = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this limit?')) return;
    
    try {
      await TariffService.deleteTariffLimit(id);
      toast.success('Limit deleted successfully');
      if (selectedTariff) {
        await fetchFeaturesAndLimits(selectedTariff.id);
      }
    } catch (error) {
      console.error('Error deleting limit:', error);
      toast.error('Failed to delete limit');
    }
  };

  const resetFeatureForm = () => {
    setFeatureFormData({
      tariff_id: selectedTariff?.id || 0,
      feature_name: '',
      is_active: true
    });
    setEditingFeature(null);
  };

  const resetLimitForm = () => {
    setLimitFormData({
      tariff_id: selectedTariff?.id || 0,
      limit_name: '',
      value: 0,
      is_active: true
    });
    setEditingLimit(null);
  };

  const openCreateFeatureDialog = () => {
    resetFeatureForm();
    setIsFeatureDialogOpen(true);
  };

  const openEditFeatureDialog = (feature: TariffFeature) => {
    setEditingFeature(feature);
    setFeatureFormData({
      tariff_id: feature.tariff_id,
      feature_name: feature.feature_name,
      is_active: feature.is_active
    });
    setIsFeatureDialogOpen(true);
  };

  const openCreateLimitDialog = () => {
    resetLimitForm();
    setIsLimitDialogOpen(true);
  };

  const openEditLimitDialog = (limit: TariffLimit) => {
    setEditingLimit(limit);
    setLimitFormData({
      tariff_id: limit.tariff_id,
      limit_name: limit.limit_name,
      value: limit.value,
      is_active: limit.is_active
    });
    setIsLimitDialogOpen(true);
  };

  const handleFeatureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFeature) {
      handleUpdateFeature();
    } else {
      handleCreateFeature();
    }
  };

  const handleLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLimit) {
      handleUpdateLimit();
    } else {
      handleCreateLimit();
    }
  };

  const handleFeatureChange = (field: keyof TariffFeatureInsert, value: string | number | boolean | null) => {
    setFeatureFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLimitChange = (field: keyof TariffLimitInsert, value: string | number | boolean | null) => {
    setLimitFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <FullPageLoader
        title={t("tariff_features_and_limits")}
        subtitle={t("manage_features_and_limits_for_tariff_plans")}
        icon={AlertTriangle}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('tariff_features_and_limits')}
        description={t('manage_features_and_limits_for_tariff_plans')}
        breadcrumbItems={breadcrumbs}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-0">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('tariff_plans')}</h3>
            </div>
            <div className="space-y-2 px-6 pb-6">
              {tariffs.map((tariff) => (
                <Button
                  key={tariff.id}
                  variant={selectedTariff?.id === tariff.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => handleSelectTariff(tariff)}
                >
                  {tariff.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedTariff ? (
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{selectedTariff.name} - {t('tariff_features')}</h3>
                    <Dialog open={isFeatureDialogOpen} onOpenChange={(open) => {
                      setIsFeatureDialogOpen(open);
                      if (!open) resetFeatureForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={openCreateFeatureDialog}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('add_feature')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            {editingFeature ? t('edit_feature') : t('add_new_feature')}
                          </DialogTitle>
                          <DialogDescription className="sr-only">
                            {editingFeature ? t('edit_feature') : t('add_new_feature')}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleFeatureSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="feature_name">{t('feature_name')} *</Label>
                            <Input
                              id="feature_name"
                              value={featureFormData.feature_name || ''}
                              onChange={(e) => handleFeatureChange('feature_name', e.target.value)}
                              required
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="feature_active"
                              checked={featureFormData.is_active || false}
                              onCheckedChange={(checked) => handleFeatureChange('is_active', checked)}
                            />
                            <Label htmlFor="feature_active">{t('active')}</Label>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsFeatureDialogOpen(false)}
                            >
                              {t('cancel_tariff')}
                            </Button>
                            <Button type="submit">
                              {editingFeature ? t('update_feature') : t('add_feature')}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tariff_features')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell className="font-medium">{feature.feature_name}</TableCell>
                        <TableCell>
                          <Switch
                            checked={feature.is_active || false}
                            onCheckedChange={async (checked) => {
                              try {
                                await TariffService.updateTariffFeature(feature.id, { is_active: checked });
                                await fetchFeaturesAndLimits(selectedTariff.id);
                                toast.success(t('feature_status_updated'));
                              } catch (error) {
                                console.error(t('error_updating_feature_status'), error);
                                toast.error(t('failed_update_feature_status'));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditFeatureDialog(feature)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteFeature(feature)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{selectedTariff.name} - {t('tariff_limits')}</h3>
                    <Dialog open={isLimitDialogOpen} onOpenChange={(open) => {
                      setIsLimitDialogOpen(open);
                      if (!open) resetLimitForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={openCreateLimitDialog}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('add_limit')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                            {editingLimit ? t('edit_limit') : t('add_new_limit')}
                          </DialogTitle>
                          <DialogDescription className="sr-only">
                            {editingLimit ? t('edit_limit') : t('add_new_limit')}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleLimitSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="limit_name">{t('limit_name')} *</Label>
                            <Input
                              id="limit_name"
                              value={limitFormData.limit_name || ''}
                              onChange={(e) => handleLimitChange('limit_name', e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="value">{t('value')} *</Label>
                            <Input
                              id="value"
                              type="number"
                              min="0"
                              value={limitFormData.value || 0}
                              onChange={(e) => handleLimitChange('value', parseInt(e.target.value) || 0)}
                              required
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="limit_active"
                              checked={limitFormData.is_active || false}
                              onCheckedChange={(checked) => handleLimitChange('is_active', checked)}
                            />
                            <Label htmlFor="limit_active">{t('active')}</Label>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsLimitDialogOpen(false)}
                            >
                              {t('cancel_tariff')}
                            </Button>
                            <Button type="submit">
                              {editingLimit ? t('update_limit') : t('add_limit')}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tariff_limits')}</TableHead>
                      <TableHead>{t('value')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {limits.map((limit) => (
                      <TableRow key={limit.id}>
                        <TableCell className="font-medium">{limit.limit_name}</TableCell>
                        <TableCell>{limit.value}</TableCell>
                        <TableCell>
                          <Switch
                            checked={limit.is_active || false}
                            onCheckedChange={async (checked) => {
                              try {
                                await TariffService.updateTariffLimit(limit.id, { is_active: checked });
                                await fetchFeaturesAndLimits(selectedTariff.id);
                                toast.success(t('limit_status_updated'));
                              } catch (error) {
                                console.error(t('error_updating_limit_status'), error);
                                toast.error(t('failed_update_limit_status'));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditLimitDialog(limit)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteLimit(limit.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">
                {t('select_tariff_plan_to_manage_features_limits')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Feature Confirmation Dialog */}
      <AlertDialog open={deleteFeatureDialogOpen} onOpenChange={setDeleteFeatureDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('confirm_delete_feature')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('are_you_sure_you_want_to_delete_this_feature')} "{featureToDelete?.feature_name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFeatureDialogOpen(false)}>
              {t('cancel_tariff')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFeature}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete_feature')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTariffFeatures;
