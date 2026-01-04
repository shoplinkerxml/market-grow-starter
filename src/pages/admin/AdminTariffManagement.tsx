import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Copy, MoreHorizontal, CreditCard, Star, Crown, Package, AlertTriangle, DollarSign, PoundSterling, JapaneseYen, Rocket, Banknote, TrendingUp, Zap } from 'lucide-react';
import { TariffService, type Tariff, type TariffInsert, type Currency } from '@/lib/tariff-service';
import TariffCache from '@/lib/tariff-cache';
import { useI18n } from '@/i18n';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs, usePageInfo } from '@/hooks/useBreadcrumbs';
import { FullPageLoader } from '@/components/LoadingSkeletons';

const AdminTariffManagement = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tariffToDelete, setTariffToDelete] = useState<Tariff | null>(null);

  

  // Handle initial loading flag once data arrives
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  const refreshTariffsInBackground = useCallback(async () => {
    try {
      const tariffData = await TariffService.getAllTariffs(true, true);
      setTariffs(tariffData);
      // Update cache
      TariffCache.set(tariffData);
    } catch (error) {
      console.error('Error refreshing tariffs in background:', error);
    }
  }, []);

  const fetchTariffs = useCallback(async (useCache = true) => {
    try {
      // Check if we have valid cached data
      if (useCache) {
        const cachedTariffs = TariffCache.get<Tariff[]>();
        if (cachedTariffs) {
          setTariffs(cachedTariffs);
          setLoading(false);
          // Refresh data in background
          refreshTariffsInBackground();
          return;
        }
      }
      
      setLoading(true);
      const tariffData = await TariffService.getAllTariffs(true, true);
      setTariffs(tariffData);
      // Cache the data
      TariffCache.set(tariffData);
    } catch (error) {
      console.error('Error fetching tariffs:', error);
      toast.error('Failed to load tariffs');
    } finally {
      setLoading(false);
    }
  }, [refreshTariffsInBackground]);

  

  const fetchCurrencies = useCallback(async () => {
    try {
      const currencyData = await TariffService.getAllCurrencies();
      setCurrencies(currencyData);
    } catch (error) {
      console.error('Error fetching currencies:', error);
      toast.error('Failed to load currencies');
    }
  }, []);

  useEffect(() => {
    const shouldRefresh = new URLSearchParams(location.search).get('refresh') === 'true';
    
    if (shouldRefresh) {
      TariffCache.clear();
      fetchTariffs(false);
      navigate(location.pathname, { replace: true });
    } else {
      fetchTariffs(true);
    }
    
    fetchCurrencies();
    
    const interval = setInterval(() => {
      if (!loading && document.visibilityState === 'visible') {
        refreshTariffsInBackground();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [location.search, fetchTariffs, loading, navigate, fetchCurrencies, location.pathname, refreshTariffsInBackground]);

  const handleDelete = async (tariff: Tariff) => {
    setTariffToDelete(tariff);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!tariffToDelete) return;
    
    try {
      await TariffService.deleteTariff(tariffToDelete.id);
      toast.success(t('tariff_deleted_successfully'));
      // Clear cache and fetch fresh data
      TariffCache.clear();
      fetchTariffs(false);
    } catch (error) {
      console.error('Error deleting tariff:', error);
      toast.error(t('failed_to_delete_tariff'));
    } finally {
      setDeleteDialogOpen(false);
      setTariffToDelete(null);
    }
  };

  const handleDuplicate = async (tariff: Tariff) => {
    try {
      await TariffService.duplicateTariff(tariff.id);
      toast.success(t('tariff_duplicated_successfully'));
      // Clear cache and fetch fresh data
      TariffCache.clear();
      fetchTariffs(false);
    } catch (error) {
      console.error('Error duplicating tariff:', error);
      toast.error(t('failed_to_duplicate_tariff'));
    }
  };

  const handleCreateSampleData = async () => {
    try {
      setLoading(true);
      await TariffService.createSampleData();
      // Clear cache and fetch fresh data
      TariffCache.clear();
      await fetchTariffs(false);
      toast.success('Sample tariff data created successfully!');
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast.error('Failed to create sample data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      TariffCache.clear();
      await fetchTariffs(false);
      toast.success('Tariffs refreshed successfully');
    } catch (error) {
      console.error('Error refreshing tariffs:', error);
      toast.error('Failed to refresh tariffs');
    } finally {
      setLoading(false);
    }
  };

  // Function to get currency symbol based on currency code
  // Uses actual currency symbols for better visual consistency
  const getCurrencySymbol = (currencyCode: string | undefined) => {
    if (!currencyCode) return <span className="text-base font-semibold">$</span>;
    
    switch (currencyCode.toUpperCase()) {
      case 'USD':
        return <span className="text-base font-semibold">$</span>;
      case 'EUR':
        return <span className="text-base font-semibold">€</span>;
      case 'GBP':
        return <span className="text-base font-semibold">£</span>;
      case 'JPY':
        return <span className="text-base font-semibold">¥</span>;
      case 'UAH':
        return <span className="text-base font-semibold">₴</span>;
      default:
        return <span className="text-base font-semibold">$</span>; // Default to dollar sign
    }
  };

  const formatPrice = (price: number | null, currencyCode: string | undefined) => {
    if (price === null || price === undefined) return 'N/A';
    const code = currencyCode || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(price).replace(/^[^\d]*/, '');
  };

  // Function to get tariff icon based on tariff properties
  // Updated to use price-tier-based approach similar to user tariff page
  const getTariffIcon = (tariff: Tariff) => {
    if (tariff.is_free) {
      return <Zap className="h-5 w-5" />;
    }
    
    if (tariff.is_lifetime) {
      return <Crown className="h-5 w-5" />;
    }
    
    const paidTariffs = tariffs.filter(t => !t.is_free && t.new_price !== null);
    
    if (paidTariffs.length <= 1) {
      return <CreditCard className="h-5 w-5" />;
    }
    
    const sortedTariffs = [...paidTariffs].sort((a, b) => {
      const priceA = a.new_price || 0;
      const priceB = b.new_price || 0;
      return priceA - priceB;
    });
    
    const currentIndex = sortedTariffs.findIndex(t => t.id === tariff.id);
    
    if (currentIndex === -1) {
      return <CreditCard className="h-5 w-5" />;
    }
    
    const tier = currentIndex / sortedTariffs.length;
    
    if (tier < 0.33) {
      return <Rocket className="h-5 w-5" />;
    } else if (tier < 0.66) {
      return <Banknote className="h-5 w-5" />;
    } else {
      return <TrendingUp className="h-5 w-5" />;
    }
  };

  // Show initial green spinner during the very first load
  if (loading && isInitialLoad) {
    return <FullPageLoader title="Завантаження…" subtitle={t('menu_pricing')} icon={CreditCard} />;
  }

  // Skeletons for subsequent refetches (filters, sorting, pagination)
  if (loading) {
    return <FullPageLoader title="Завантаження…" subtitle={t('menu_pricing')} icon={CreditCard} />;
  }

  return (
    <div className="p-4 xs:p-5 sm:p-6 space-y-6">
      {/* Page Header with Breadcrumbs */}
      <PageHeader
        title={t('menu_pricing')}
        description={t('manage_tariffs_and_pricing_options')}
        breadcrumbItems={breadcrumbs}
        actions={
          <div className="flex flex-wrap gap-2">
            {tariffs.length === 0 && (
              <Button variant="outline" className="text-sm xs:text-base" onClick={handleCreateSampleData}>
                {t('create_sample_data')}
              </Button>
            )}
            <Button variant="outline" className="text-sm xs:text-base" onClick={handleRefresh}>
              {t('refresh')}
            </Button>
            <Button className="text-sm xs:text-base" onClick={() => navigate('/admin/tariff/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('add_new_tariff')}
            </Button>
          </div>
        }
      />

      {/* Tariff Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[500px] xs:min-w-[600px] sm:min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm md:text-base w-10 xs:w-12"></TableHead>
                <TableHead className="text-xs sm:text-sm md:text-base min-w-[80px] xs:min-w-[100px] sm:min-w-[120px]">{t('tariff_name')}</TableHead>
                <TableHead className="text-xs sm:text-sm md:text-base min-w-[100px] xs:min-w-[120px] sm:min-w-[140px]">{t('tariff_price')}</TableHead>
                <TableHead className="text-xs sm:text-sm md:text-base min-w-[70px] xs:min-w-[80px] sm:min-w-[100px]">{t('tariff_term')}</TableHead>
                <TableHead className="text-xs sm:text-sm md:text-base min-w-[70px] xs:min-w-[80px] sm:min-w-[100px]">{t('tariff_status')}</TableHead>
                <TableHead className="text-center text-xs sm:text-sm md:text-base w-16 xs:w-20 sm:w-24">{t('tariff_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 xs:py-8 sm:py-10 md:py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-10 w-10 xs:h-12 xs:w-12 sm:h-16 sm:w-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 xs:h-6 xs:w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-base sm:text-lg md:text-xl text-gray-900">{t('no_tariffs_found')}</h3>
                        <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-1">
                          {t('manage_tariffs_and_pricing_options')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button variant="outline" className="text-xs sm:text-sm" onClick={handleCreateSampleData}>
                          {t('create_sample_data')}
                        </Button>
                        <Button className="text-xs sm:text-sm" onClick={() => navigate('/admin/tariff/new')}>
                          <Plus className="mr-1 h-3 w-3 xs:mr-2 xs:h-4 xs:w-4" />
                          {t('add_new_tariff')}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tariffs.map((tariff) => (
                  <TableRow key={tariff.id}>
                    <TableCell>
                      <div className="h-4 w-4 sm:h-5 sm:w-5">
                        {getTariffIcon(tariff)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs sm:text-sm md:text-base max-w-[100px] xs:max-w-[120px] sm:max-w-[150px] md:max-w-xs truncate">{tariff.name}</TableCell>
                    <TableCell>
                      {tariff.is_free ? (
                        <Badge variant="secondary" className="text-xs sm:text-sm">{t('free_tariff')}</Badge>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="text-xs sm:text-sm md:text-base flex-shrink-0">
                            {getCurrencySymbol(currencies.find(c => c.id === tariff.currency_id)?.code)}
                          </div>
                          <span className="text-xs sm:text-sm md:text-base min-w-0">
                            {tariff.new_price !== null ? (
                              <span className="truncate">
                                {formatPrice(tariff.new_price, currencies.find(c => c.id === tariff.currency_id)?.code)}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm md:text-base min-w-0">
                      {tariff.is_lifetime ? t('lifetime_tariff') : 
                       tariff.duration_days ? `${tariff.duration_days} ${t('days_tariff')}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tariff.is_active ? 'default' : 'secondary'} className={`text-xs sm:text-xs ${tariff.is_active ? 'badge-active' : ''}`}>
                        {tariff.is_active ? t('status_active') : t('status_inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-6 w-6 sm:h-8 sm:w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs sm:text-sm">
                          <DropdownMenuItem 
                            onClick={() => navigate(`/admin/tariff/edit/${tariff.id}`)}
                            className="dropdown-item-hover"
                          >
                            <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{t('edit_tariff')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(tariff)}
                            className="dropdown-item-hover focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{t('delete_tariff')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDuplicate(tariff)}
                            className="dropdown-item-hover"
                          >
                            <Copy className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{t('duplicate_tariff')}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold">
                  {t('confirm_delete_tariff')}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-gray-600 mt-1">
                  {t('delete_tariff_warning')}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          
          {tariffToDelete && (
            <div className="my-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                {getTariffIcon(tariffToDelete)}
                <div>
                  <h4 className="font-medium text-gray-900">{tariffToDelete.name}</h4>
                  <p className="text-sm text-gray-600">
                    {tariffToDelete.description || t('no_description')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {tariffToDelete.is_free ? (
                      <Badge variant="secondary" className="text-xs">{t('free_tariff')}</Badge>
                    ) : (
                      <div className="flex items-center gap-1">
                        {getCurrencySymbol(currencies.find(c => c.id === tariffToDelete.currency_id)?.code)}
                        <span className="text-xs text-gray-500">
                          {tariffToDelete.new_price !== null ? (
                            formatPrice(tariffToDelete.new_price, currencies.find(c => c.id === tariffToDelete.currency_id)?.code)
                          ) : 'N/A'}
                        </span>
                      </div>
                    )}
                    <Badge variant={tariffToDelete.is_active ? 'default' : 'secondary'} className="text-xs">
                      {tariffToDelete.is_active ? t('status_active') : t('status_inactive')}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50">
              {t('cancel_tariff')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete_tariff')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTariffManagement;
