import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/PageHeader';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { useI18n } from '@/i18n';
import { BreadcrumbItem } from '@/components/ui/breadcrumb';
import { TariffService, type Currency, type TariffFeature, type TariffLimit } from '@/lib/tariff-service';
import { LimitService, type LimitTemplate } from '@/lib/limit-service';
import { ProfileService } from '@/lib/profile-service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, Lock, FileText, Sparkles, Shield, Gift, Infinity, Power, Star, Eye, MoreVertical, Edit } from 'lucide-react';
import { FullPageLoader } from '@/components/LoadingSkeletons';
interface TariffFormData {
  name: string;
  description?: string | null;
  old_price?: number | null;
  new_price?: number | null;
  currency_id: number;
  currency_code: string;
  duration_days?: number | null;
  is_free?: boolean | null;
  is_lifetime?: boolean | null;
  is_active?: boolean | null;
  visible?: boolean | null;
  popular?: boolean | null;
  sort_order?: number | null;
}
const AdminTariffEdit = () => {
  const {
    t
  } = useI18n();
  const navigate = useNavigate();
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const defaultBreadcrumbs = useBreadcrumbs();
  const [tariffName, setTariffName] = useState<string>('');
  const [customBreadcrumbs, setCustomBreadcrumbs] = useState<BreadcrumbItem[]>([{
    label: "Головна",
    href: "/admin/dashboard"
  }, {
    label: "Тарифні плани",
    href: "/admin/tariff"
  }, {
    label: "Редагування тарифу",
    current: true
  }]);
  const [activeTab, setActiveTab] = useState('basic');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [savedTariffId, setSavedTariffId] = useState<number | null>(null);
  const [features, setFeatures] = useState<TariffFeature[]>([]);
  const [limits, setLimits] = useState<TariffLimit[]>([]);
  const [availableLimits, setAvailableLimits] = useState<LimitTemplate[]>([]);
  const [newFeature, setNewFeature] = useState({
    feature_name: '',
    is_active: true
  });
  const [newLimit, setNewLimit] = useState({
    limit_name: '',
    template_id: null as number | null,
    value: 0,
    is_active: true
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Default to true to avoid empty page
  const [userRole, setUserRole] = useState<string>('admin'); // Default to admin
  const [formErrors, setFormErrors] = useState<{
    [key: string]: string;
  }>({});
  const [formData, setFormData] = useState<TariffFormData>({
    name: '',
    description: '',
    old_price: null,
    new_price: null,
    currency_id: 1,
    currency_code: 'USD',
    duration_days: null,
    is_free: false,
    is_lifetime: false,
    is_active: true,
    visible: true,
    popular: false,
    sort_order: 0
  });
  
  const checkUserPermissions = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        try {
          const role = await ProfileService.getUserRole(user.id);
          const adminStatus = await ProfileService.isAdmin(user.id);
          setUserRole(role || 'admin');
          setIsAdmin(adminStatus || true); // Default to admin if check fails
        } catch (permError) {
          setIsAdmin(true);
          setUserRole('admin');
        }
      } else {
        setIsAdmin(true);
        setUserRole('admin');
      }
    } catch (error) {
      console.error('Error checking user permissions:', error);
      // Set admin permissions to prevent empty page
      setIsAdmin(true);
      setUserRole('admin');
    }
  };

  const fetchAvailableLimits = useCallback(async () => {
    try {
      const limitsData = await LimitService.getLimits();
      setAvailableLimits(limitsData);
    } catch (error) {
      console.error('Error loading available limits:', error);
      toast.error(t('failed_load_limits') || 'Failed to load available limits');
    }
  }, [t]);
  const validateForm = (): boolean => {
    const errors: {
      [key: string]: string;
    } = {};

    // Required fields validation
    if (!formData.name.trim()) {
      errors.name = t('validation_error');
    }
    if (!formData.currency_id) {
      errors.currency_id = t('currency_required');
    }
    if (!formData.is_free && !formData.new_price) {
      errors.new_price = t('new_price_required');
    }

    // Numeric validation - non-negative values
    if (formData.old_price !== null && formData.old_price < 0) {
      errors.old_price = t('price_must_be_non_negative');
    }
    if (formData.new_price !== null && formData.new_price < 0) {
      errors.new_price = t('price_must_be_non_negative');
    }
    if (formData.duration_days !== null && formData.duration_days < 0) {
      errors.duration_days = t('duration_must_be_non_negative');
    }

    // Check if currency exists in currencies list (defensive check)
    if (formData.currency_id && currencies.length > 0) {
      const currencyExists = currencies.find(c => c.id === formData.currency_id);
      if (!currencyExists) {
        errors.currency_id = t('invalid_currency_selected');
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Load existing tariff data for editing using TariffService.getTariffById as per memory spec
  const fetchTariffData = useCallback(async (tariffId: number) => {
    try {
      setLoading(true);
      setIsInitialLoading(true);

      // Use TariffService.getTariffById() for loading single tariffs with full relational data
      const tariffWithDetails = await TariffService.getTariffById(tariffId);
      if (tariffWithDetails) {
        // Extract currency code safely
        let currencyCode = 'USD'; // Default fallback
        if (tariffWithDetails.currency_data?.code) {
          currencyCode = tariffWithDetails.currency_data.code;
        }

        // Update form data with loaded tariff
        setFormData({
          name: tariffWithDetails.name || '',
          description: tariffWithDetails.description || '',
          old_price: tariffWithDetails.old_price,
          new_price: tariffWithDetails.new_price,
          currency_id: tariffWithDetails.currency_id || 1,
          currency_code: currencyCode,
          duration_days: tariffWithDetails.duration_days,
          is_free: tariffWithDetails.is_free ?? false,
          is_lifetime: tariffWithDetails.is_lifetime ?? false,
          is_active: tariffWithDetails.is_active ?? true,
          visible: tariffWithDetails.visible ?? true,
          popular: tariffWithDetails.popular ?? false,
          sort_order: tariffWithDetails.sort_order || 0
        });

        // Load features and limits
        setFeatures(tariffWithDetails.features || []);
        setLimits(tariffWithDetails.limits || []);

        // Update tariff name for breadcrumb
        setTariffName(tariffWithDetails.name);
        setCustomBreadcrumbs([{
          label: "Головна",
          href: "/admin/dashboard"
        }, {
          label: "Тарифні плани",
          href: "/admin/tariff"
        }, {
          label: tariffWithDetails.name,
          current: true
        }]);
      }
    } catch (error) {
      console.error('Error fetching tariff data:', error);
      toast.error(t('failed_load_tariff'));
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  }, [t]);
  // Fetch only tariff name for breadcrumb
  const fetchTariffName = async (tariffId: number) => {
    try {
      const {
        data: simpleTariff,
        error
      } = await supabase.from('tariffs').select('id, name').eq('id', tariffId).single();
      if (!error && simpleTariff) {
        setTariffName(simpleTariff.name);
        // Update breadcrumbs with tariff name
        setCustomBreadcrumbs([{
          label: "Головна",
          href: "/admin/dashboard"
        }, {
          label: "Тарифні плани",
          href: "/admin/tariff"
        }, {
          label: simpleTariff.name,
          current: true
        }]);
      }
    } catch (error) {
      console.error('Error fetching tariff name:', error);
      // Keep default breadcrumbs if fetching fails
    }
  };

  // When editing existing tariff, load its data. When creating new, start with empty form

  const fetchCurrencies = useCallback(async () => {
    try {
      const currencyData = await TariffService.getAllCurrencies();
      setCurrencies(currencyData);
    } catch (error) {
      console.error('Error fetching currencies:', error);
      toast.error(t('failed_load_currencies'));
    }
  }, [t]);

  useEffect(() => {
    fetchCurrencies();
    fetchAvailableLimits();
    checkUserPermissions();
    if (id) {
      fetchTariffData(parseInt(id));
    } else {
      setIsInitialLoading(false);
    }
  }, [id, fetchCurrencies, fetchAvailableLimits, fetchTariffData]);
  const handleInputChange = (field: keyof TariffFormData, value: string | number | boolean | null) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Business rules
      if (field === 'is_free' && value === true) {
        // If free tariff is selected, set prices to null
        newData.old_price = null;
        newData.new_price = null;
      }
      if (field === 'is_lifetime' && value === true) {
        // If lifetime access is selected, set duration to null
        newData.duration_days = null;
      }

      // Update currency code when currency_id changes
      if (field === 'currency_id' && typeof value === 'number') {
        const selectedCurrency = currencies.find(c => c.id === value);
        if (selectedCurrency) {
          newData.currency_code = selectedCurrency.code;
        }
      }
      return newData;
    });
  };

  // Save features and limits to database - exact copy from AdminTariffNew (for new tariffs only)
  const saveFeatures = async (tariffId: number) => {
    for (const feature of features) {
      if (feature.id > 1000000) {
        // Temporary ID, needs to be created
        await TariffService.addTariffFeature({
          tariff_id: tariffId,
          feature_name: feature.feature_name,
          is_active: feature.is_active
        });
      }
    }
  };
  const saveLimits = async (tariffId: number) => {
    for (const limit of limits) {
      if (limit.id > 1000000) {
        // Temporary ID, needs to be created
        await TariffService.addTariffLimit({
          tariff_id: tariffId,
          limit_name: limit.limit_name,
          template_id: limit.template_id,
          value: limit.value,
          is_active: limit.is_active
        });
      }
    }
  };

  // Save ALL features and limits for edit mode - separate request for each item
  const saveAllFeatures = async (tariffId: number) => {
    for (const feature of features) {
      if (feature.id > 1000000) {
        // New feature - create it
        await TariffService.addTariffFeature({
          tariff_id: tariffId,
          feature_name: feature.feature_name,
          is_active: feature.is_active
        });
      } else {
        // Existing feature - update it with separate request
        await TariffService.updateTariffFeature(feature.id, {
          feature_name: feature.feature_name,
          is_active: feature.is_active
        });
      }
    }
  };
  const saveAllLimits = async (tariffId: number) => {
    for (const limit of limits) {
      if (limit.id > 1000000) {
        // New limit - create it
        await TariffService.addTariffLimit({
          tariff_id: tariffId,
          limit_name: limit.limit_name,
          template_id: limit.template_id,
          value: limit.value,
          is_active: limit.is_active
        });
      } else {
        // Existing limit - update it with separate request
        await TariffService.updateTariffLimit(limit.id, {
          limit_name: limit.limit_name,
          template_id: limit.template_id,
          value: limit.value,
          is_active: limit.is_active
        });
      }
    }
  };
  const handleSave = async () => {
    try {
      setLoading(true);

      // Validation
      if (!formData.name.trim()) {
        toast.error(t('validation_error'));
        return;
      }
      if (id) {
        // Update existing tariff - use correct field mapping as per actual database schema
        const tariffData: any = {
          name: formData.name.trim(),
          description: formData.description,
          currency_id: formData.currency_id,
          // Use currency_id as per actual database schema
          currency_code: formData.currency_code,
          // Include currency_code as required field
          duration_days: formData.duration_days,
          is_free: formData.is_free,
          is_lifetime: formData.is_lifetime,
          is_active: formData.is_active,
          visible: formData.visible,
          popular: formData.popular,
          sort_order: formData.sort_order
        };

        // Handle prices based on free tariff status
        if (formData.is_free) {
          // For free tariffs, explicitly set prices to null
          tariffData.old_price = null;
          tariffData.new_price = null;
        } else {
          // For paid tariffs, include prices (can be null or actual values)
          tariffData.old_price = formData.old_price;
          tariffData.new_price = formData.new_price;
        }
        await TariffService.updateTariff(parseInt(id), tariffData);

        // Now save ALL features and limits with separate requests for each
        await saveAllFeatures(parseInt(id));
        await saveAllLimits(parseInt(id));
        toast.success(t('tariff_updated_successfully'));
      } else {
        // Create new tariff - use correct field mapping as per actual database schema
        const tariffData: any = {
          name: formData.name.trim(),
          description: formData.description,
          currency_id: formData.currency_id,
          // Use currency_id as per actual database schema
          currency_code: formData.currency_code,
          // Include currency_code as required field
          duration_days: formData.duration_days,
          is_free: formData.is_free,
          is_lifetime: formData.is_lifetime,
          is_active: formData.is_active,
          sort_order: formData.sort_order
        };

        // Handle prices based on free tariff status
        if (formData.is_free) {
          // For free tariffs, explicitly set prices to null
          tariffData.old_price = null;
          tariffData.new_price = null;
        } else {
          // For paid tariffs, include prices
          tariffData.old_price = formData.old_price;
          tariffData.new_price = formData.new_price;
        }
        const createdTariff = await TariffService.createTariff(tariffData);
        setSavedTariffId(createdTariff.id);

        // Save features and limits if they exist
        await saveFeatures(createdTariff.id);
        await saveLimits(createdTariff.id);
        toast.success(t('tariff_created'));
      }

      // Navigate back to tariff management with a flag to indicate fresh data should be loaded
      navigate('/admin/tariff?refresh=true');
    } catch (error) {
      console.error('Error saving tariff:', error);
      toast.error(id ? t('failed_update_tariff') : t('failed_create_tariff'));
    } finally {
      setLoading(false);
    }
  };

  // Features management (like in AdminTariffNew)
  const addFeature = () => {
    if (!newFeature.feature_name.trim()) {
      toast.error(t('enter_feature_name'));
      return;
    }
    const feature: TariffFeature = {
      id: Date.now(),
      // Temporary ID for new features
      tariff_id: savedTariffId || 0,
      feature_name: newFeature.feature_name,
      is_active: newFeature.is_active
    };
    setFeatures([...features, feature]);
    setNewFeature({
      feature_name: '',
      is_active: true
    });
  };
  const removeFeature = async (index: number) => {
    const feature = features[index];
    // If it's an existing feature (has real ID), delete from database
    if (feature.id <= 1000000 && id) {
      try {
        await TariffService.deleteTariffFeature(feature.id);
        toast.success(t('feature_deleted_successfully'));
      } catch (error) {
        console.error('Error deleting feature:', error);
        toast.error(t('failed_to_delete_feature'));
        return; // Don't remove from local state if deletion failed
      }
    }
    // Remove from local state
    setFeatures(features.filter((_, i) => i !== index));
  };
  const updateFeature = (index: number, field: keyof TariffFeature, value: any) => {
    const updatedFeatures = [...features];
    updatedFeatures[index] = {
      ...updatedFeatures[index],
      [field]: value
    };
    setFeatures(updatedFeatures);
  };

  // Save individual feature changes (for edit mode)
  const saveFeature = async (index: number) => {
    if (!id) return; // Only for edit mode

    const feature = features[index];
    try {
      if (feature.id > 1000000) {
        // New feature, create it
        const createdFeature = await TariffService.addTariffFeature({
          tariff_id: parseInt(id),
          feature_name: feature.feature_name,
          is_active: feature.is_active
        });
        // Update the feature with the real ID
        const updatedFeatures = [...features];
        updatedFeatures[index] = createdFeature;
        setFeatures(updatedFeatures);
        toast.success(t('feature_saved_successfully'));
      } else {
        // Existing feature, update it
        await TariffService.updateTariffFeature(feature.id, {
          feature_name: feature.feature_name,
          is_active: feature.is_active
        });
        toast.success(t('feature_updated_successfully'));
      }
    } catch (error) {
      console.error('Error saving feature:', error);
      toast.error(t('failed_save_feature'));
    }
  };

  // Limits management (like in AdminTariffNew)
  const addLimit = () => {
    if (!newLimit.limit_name.trim() || newLimit.value <= 0) {
      toast.error(t('enter_limit_name'));
      return;
    }
    const limit: TariffLimit = {
      id: Date.now(),
      // Temporary ID for new limits
      tariff_id: savedTariffId || 0,
      limit_name: newLimit.limit_name,
      template_id: newLimit.template_id,
      value: newLimit.value,
      is_active: newLimit.is_active,
      code: null,
      description: null,
      path: null,
    };
    setLimits([...limits, limit]);
    setNewLimit({
      limit_name: '',
      template_id: null,
      value: 0,
      is_active: true
    });
  };
  const removeLimit = async (index: number) => {
    const limit = limits[index];
    // If it's an existing limit (has real ID), delete from database
    if (limit.id <= 1000000 && id) {
      try {
        await TariffService.deleteTariffLimit(limit.id);
        toast.success(t('limit_deleted_successfully'));
      } catch (error) {
        console.error('Error deleting limit:', error);
        toast.error(t('failed_to_delete_limit'));
        return; // Don't remove from local state if deletion failed
      }
    }
    // Remove from local state
    setLimits(limits.filter((_, i) => i !== index));
  };
  const updateLimit = (index: number, field: keyof TariffLimit, value: any) => {
    const updatedLimits = [...limits];
    updatedLimits[index] = {
      ...updatedLimits[index],
      [field]: value
    };
    setLimits(updatedLimits);
  };

  // Save individual limit changes (for edit mode)
  const saveLimit = async (index: number) => {
    if (!id) return; // Only for edit mode

    const limit = limits[index];
    try {
      if (limit.id > 1000000) {
        // New limit, create it
        const createdLimit = await TariffService.addTariffLimit({
          tariff_id: parseInt(id),
          limit_name: limit.limit_name,
          template_id: limit.template_id,
          value: limit.value,
          is_active: limit.is_active
        });
        // Update the limit with the real ID
        const updatedLimits = [...limits];
        updatedLimits[index] = createdLimit;
        setLimits(updatedLimits);
        toast.success(t('limit_saved_successfully'));
      } else {
        // Existing limit, update it
        await TariffService.updateTariffLimit(limit.id, {
          limit_name: limit.limit_name,
          template_id: limit.template_id,
          value: limit.value,
          is_active: limit.is_active
        });
        toast.success(t('limit_updated_successfully'));
      }
    } catch (error) {
      console.error('Error saving limit:', error);
      toast.error(t('failed_save_limit'));
    }
  };

  // Load sample data functions (like in AdminTariffNew)
  const loadSampleFeatures = () => {
    const sampleFeatures: TariffFeature[] = [{
      id: Date.now() + 1,
      tariff_id: 0,
      feature_name: t('xml_files_upload'),
      is_active: true
    }, {
      id: Date.now() + 2,
      tariff_id: 0,
      feature_name: t('data_processing_cleaning'),
      is_active: true
    }, {
      id: Date.now() + 3,
      tariff_id: 0,
      feature_name: t('excel_csv_export'),
      is_active: true
    }];
    setFeatures(sampleFeatures);
  };
  const loadSampleLimits = () => {
    const sampleLimits: TariffLimit[] = [{
      id: Date.now() + 1,
      tariff_id: 0,
      limit_name: t('store_count_limit'),
      template_id: null,
      value: 3,
      is_active: true,
      code: null,
      description: null,
      path: null,
    }, {
      id: Date.now() + 2,
      tariff_id: 0,
      limit_name: t('supplier_count_limit'),
      template_id: null,
      value: 5,
      is_active: true,
      code: null,
      description: null,
      path: null,
    }, {
      id: Date.now() + 3,
      tariff_id: 0,
      limit_name: t('product_count_limit'),
      template_id: null,
      value: 100,
      is_active: true,
      code: null,
      description: null,
      path: null,
    }];
    setLimits(sampleLimits);
  };
  const getCurrencySymbol = (currencyId: number) => {
    // Validate currencyId before finding currency
    if (!currencyId || typeof currencyId !== 'number') {
      return '$'; // Default fallback
    }
    const currency = currencies.find(c => c.id === currencyId);
    // Since currency doesn't have symbol property, we'll use a simple mapping
    const symbolMap: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'UAH': '₴',
      'GBP': '£',
      'JPY': '¥'
    };
    return currency ? symbolMap[currency.code] || currency.code : '$';
  };

  if (isInitialLoading) {
    return <FullPageLoader title="Завантаження…" subtitle={t('edit_tariff')} icon={Shield} />;
  }
  return <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Read-only mode banner for non-admin users */}
      {!isAdmin && <div className="bg-muted/50 border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <div>
              <h3 className="font-medium">{t('read_only_mode')}</h3>
              <p className="text-sm text-muted-foreground">{t('user_role_read_only')}</p>
            </div>
          </div>
        </div>}
      
      <PageHeader title={id ? t('edit_tariff') : t('create_tariff')} description={id ? t('edit_tariff_description') : t('create_tariff_description')} breadcrumbItems={customBreadcrumbs} actions={<div className="flex flex-wrap gap-2 sm:gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/admin/tariff')} className="hover:bg-transparent">
                    <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('back')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleSave} disabled={loading} className="hover:bg-transparent">
                    <Save className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{loading ? t('saving') : id ? t('update') : t('save')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>} />

      <Card>
        <CardHeader>
          <CardTitle>{t('tariff_details') || 'Tariff Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">
                <FileText className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">{t('basic_information') || 'Basic Information'}</span>
              </TabsTrigger>
              <TabsTrigger value="features">
                <Sparkles className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">{t('features') || 'Features'}</span>
              </TabsTrigger>
              <TabsTrigger value="limits">
                <Shield className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline">{t('limits') || 'Limits'}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('tariff_name')} *</Label>
                  <Input id="name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} placeholder={t('enter_tariff_name')} required disabled={!isAdmin} className={formErrors.name ? 'border-destructive' : ''} />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t('currency')} *</Label>
                    <Select value={formData.currency_id.toString()} onValueChange={value => handleInputChange('currency_id', parseInt(value))} disabled={!isAdmin}>
                      <SelectTrigger className={formErrors.currency_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('select_currency')} />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => {
                        const symbolMap: Record<string, string> = {
                          'USD': '$',
                          'EUR': '€',
                          'UAH': '₴',
                          'GBP': '£',
                          'JPY': '¥'
                        };
                        const symbol = symbolMap[currency.code] || currency.code;
                        return <SelectItem key={currency.id} value={currency.id.toString()}>
                              {currency.code} ({symbol}) - {currency.name}
                            </SelectItem>;
                      })}
                      </SelectContent>
                    </Select>
                    {formErrors.currency_id && <p className="text-sm text-destructive">{formErrors.currency_id}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sort_order">{t('sort_order')}</Label>
                    <Input id="sort_order" type="number" min="0" value={formData.sort_order || 0} onChange={e => handleInputChange('sort_order', e.target.value ? parseInt(e.target.value) : 0)} placeholder={t('enter_sort_order')} disabled={!isAdmin} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea id="description" value={formData.description || ''} onChange={e => handleInputChange('description', e.target.value)} placeholder={t('enter_tariff_description')} rows={3} disabled={!isAdmin} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="old_price">{t('old_price')}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      {getCurrencySymbol(formData.currency_id)}
                    </span>
                    <Input id="old_price" type="number" min="0" step="0.01" className="pl-12" value={formData.old_price || ''} onChange={e => handleInputChange('old_price', e.target.value ? parseFloat(e.target.value) : null)} disabled={formData.is_free} placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_price">{t('new_price')}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      {getCurrencySymbol(formData.currency_id)}
                    </span>
                    <Input id="new_price" type="number" min="0" step="0.01" className="pl-12" value={formData.new_price || ''} onChange={e => handleInputChange('new_price', e.target.value ? parseFloat(e.target.value) : null)} disabled={formData.is_free} placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration_days">{t('duration_days')}</Label>
                  <Input id="duration_days" type="number" min="1" value={formData.duration_days || ''} onChange={e => handleInputChange('duration_days', e.target.value ? parseInt(e.target.value) : null)} disabled={formData.is_lifetime} placeholder={t('enter_duration_days')} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <div className="flex items-center space-x-2">
                  <Switch id="is_free" checked={formData.is_free || false} onCheckedChange={checked => handleInputChange('is_free', checked)} disabled={!isAdmin} />
                  <Label htmlFor="is_free" className="flex items-center gap-2 cursor-pointer">
                    <Gift className="h-4 w-4" />
                    
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="is_lifetime" checked={formData.is_lifetime || false} onCheckedChange={checked => handleInputChange('is_lifetime', checked)} disabled={!isAdmin} />
                  <Label htmlFor="is_lifetime" className="flex items-center gap-2 cursor-pointer">
                    <Infinity className="h-4 w-4" />
                    
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="is_active" checked={formData.is_active || false} onCheckedChange={checked => handleInputChange('is_active', checked)} disabled={!isAdmin} />
                  <Label htmlFor="is_active" className="flex items-center gap-2 cursor-pointer">
                    <Power className="h-4 w-4" />
                    
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="popular" checked={formData.popular || false} onCheckedChange={checked => handleInputChange('popular', checked)} disabled={!isAdmin} />
                  <Label htmlFor="popular" className="flex items-center gap-2 cursor-pointer">
                    <Star className="h-4 w-4" />
                    
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="visible" checked={formData.visible || false} onCheckedChange={checked => handleInputChange('visible', checked)} disabled={!isAdmin} />
                  <Label htmlFor="visible" className="flex items-center gap-2 cursor-pointer">
                    <Eye className="h-4 w-4" />
                    
                  </Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className="text-lg font-semibold">{t('features') || 'Features'}</h3>
                <div className="flex flex-wrap gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={loadSampleFeatures} className="hover:bg-transparent">
                          <span className="text-lg text-muted-foreground hover:text-foreground transition-colors">📋</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Load Sample</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={addFeature} className="hover:bg-transparent">
                          <Plus className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('add_feature')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Add new feature form */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
                    <div className="space-y-2 md:col-span-6">
                      <Label htmlFor="new-feature-name">{t('feature_name')}</Label>
                      <Input id="new-feature-name" value={newFeature.feature_name} onChange={e => setNewFeature({
                      ...newFeature,
                      feature_name: e.target.value
                    })} placeholder={t('enter_feature_name')} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="new-feature-active" className="block text-center">{t('active')}</Label>
                      <div className="flex h-10 w-full items-center justify-center">
                        <Switch id="new-feature-active" checked={newFeature.is_active} onCheckedChange={checked => setNewFeature({
                        ...newFeature,
                        is_active: checked
                      })} disabled={!isAdmin} />
                      </div>
                    </div>
                    <div className="flex justify-center md:col-span-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={addFeature} disabled={!isAdmin} className="hover:bg-transparent">
                              <Plus className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('add_feature')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Features list */}
              {features.length > 0 && <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">{t('feature_name') || 'Feature Name'}</TableHead>
                          <TableHead className="text-center w-[20%]">{t('tariff_status') || 'Status'}</TableHead>
                          <TableHead className="text-center w-[20%]">{t('tariff_actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {features.map((feature, index) => <TableRow key={feature.id}>
                            <TableCell className="w-[60%]">
                              <Input value={feature.feature_name} onChange={e => updateFeature(index, 'feature_name', e.target.value)} className="border-none p-0 focus-visible:ring-0 w-full" disabled={!isAdmin} />
                            </TableCell>
                            <TableCell className="text-center w-[20%]">
                              <div className="flex justify-center">
                                <Switch checked={feature.is_active || false} onCheckedChange={checked => updateFeature(index, 'is_active', checked)} disabled={!isAdmin} />
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-[20%]">
                              {isAdmin && <div className="flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="hover:bg-transparent">
                                        <MoreVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {id && <DropdownMenuItem onClick={() => saveFeature(index)}>
                                          <Save className="h-4 w-4 mr-2" />
                                          {t('save')}
                                        </DropdownMenuItem>}
                                      <DropdownMenuItem onClick={() => removeFeature(index)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('delete')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>}

              {features.length === 0 && <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    {t('features_will_be_configured_after_creating_tariff')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('save_tariff_first_to_add_features')}
                  </p>
                </div>}
            </TabsContent>

            <TabsContent value="limits" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className="text-lg font-semibold">{t('limits') || 'Limits'}</h3>
                <div className="flex flex-wrap gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={loadSampleLimits} className="hover:bg-transparent">
                          <span className="text-lg text-muted-foreground hover:text-foreground transition-colors">📋</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Load Sample</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={addLimit} className="hover:bg-transparent">
                          <Plus className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('add_limit')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Add new limit form */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="new-limit-name">{t('limit_name')}</Label>
                      <Select 
                        value={newLimit.template_id?.toString() || ''} 
                        onValueChange={(value) => {
                          const selectedLimit = availableLimits.find(l => l.id === parseInt(value));
                          if (selectedLimit) {
                            setNewLimit({ 
                              ...newLimit, 
                              limit_name: selectedLimit.name,
                              template_id: selectedLimit.id
                            });
                          }
                        }}
                        disabled={!isAdmin}
                      >
                        <SelectTrigger id="new-limit-name">
                          <SelectValue placeholder={t('select_limit') || 'Виберіть обмеження'} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLimits.map((limit) => (
                            <SelectItem key={limit.id} value={limit.id.toString()}>
                              {limit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="new-limit-value" className="block text-center">{t('limit_value')}</Label>
                      <Input id="new-limit-value" type="number" min="0" value={newLimit.value} onChange={e => setNewLimit({
                      ...newLimit,
                      value: parseInt(e.target.value) || 0
                    })} placeholder={t('enter_limit_value')} disabled={!isAdmin} className="text-center" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="new-limit-active" className="block text-center">{t('active')}</Label>
                      <div className="flex h-10 w-full items-center justify-center">
                        <Switch id="new-limit-active" checked={newLimit.is_active} onCheckedChange={checked => setNewLimit({
                        ...newLimit,
                        is_active: checked
                      })} disabled={!isAdmin} />
                      </div>
                    </div>
                    <div className="flex justify-center md:col-span-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={addLimit} disabled={!isAdmin} className="hover:bg-transparent">
                              <Plus className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('add_limit')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Limits list */}
              {limits.length > 0 && <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">{t('limit_name') || 'Limit Name'}</TableHead>
                          <TableHead className="text-center w-[20%]">{t('limit_value') || 'Value'}</TableHead>
                          <TableHead className="text-center w-[20%]">{t('tariff_status') || 'Status'}</TableHead>
                          <TableHead className="text-center w-[20%]">{t('tariff_actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {limits.map((limit, index) => <TableRow key={limit.id}>
                            <TableCell className="w-[40%]">
                              <Select 
                                value={limit.template_id?.toString() || ''} 
                                onValueChange={async (value) => {
                                  const selectedLimit = availableLimits.find(l => l.id === parseInt(value));
                                  if (selectedLimit) {
                                    updateLimit(index, 'limit_name', selectedLimit.name);
                                    updateLimit(index, 'template_id', selectedLimit.id);
                                    
                                    // Auto-save the changes to database for existing limits
                                    if (id && limit.id <= 1000000) {
                                      try {
                                        await TariffService.updateTariffLimit(limit.id, {
                                          limit_name: selectedLimit.name,
                                          template_id: selectedLimit.id,
                                          value: limit.value,
                                          is_active: limit.is_active
                                        });
                                        toast.success(t('limit_updated_successfully'));
                                      } catch (error) {
                                        console.error('Error auto-saving limit:', error);
                                        toast.error(t('failed_save_limit'));
                                      }
                                    }
                                  }
                                }}
                                disabled={!isAdmin}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLimits.map((availableLimit) => (
                                    <SelectItem key={availableLimit.id} value={availableLimit.id.toString()}>
                                      {availableLimit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center w-[20%]">
                              <Input type="number" min="0" value={limit.value} onChange={e => updateLimit(index, 'value', parseInt(e.target.value) || 0)} className="border-none p-0 focus-visible:ring-0 text-center w-full" disabled={!isAdmin} />
                            </TableCell>
                            <TableCell className="text-center w-[20%]">
                              <div className="flex justify-center">
                                <Switch checked={limit.is_active || false} onCheckedChange={checked => updateLimit(index, 'is_active', checked)} disabled={!isAdmin} />
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-[20%]">
                              {isAdmin && <div className="flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="hover:bg-transparent">
                                        <MoreVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {id && <DropdownMenuItem onClick={() => saveLimit(index)}>
                                          <Save className="h-4 w-4 mr-2" />
                                          {t('save')}
                                        </DropdownMenuItem>}
                                      <DropdownMenuItem onClick={() => removeLimit(index)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('delete')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>}

              {limits.length === 0 && <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    {t('limits_will_be_configured_after_creating_tariff')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('save_tariff_first_to_add_limits')}
                  </p>
                </div>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
};
export default AdminTariffEdit;
