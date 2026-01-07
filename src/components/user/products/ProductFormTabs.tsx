import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
  import { Loader2, Plus, X, Upload, Link, Package, Image, Settings, Save, ArrowLeft, Check, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";
import { ProductService } from "@/lib/product-service";
import { SupplierService } from "@/lib/supplier-service";
import { ShopService } from "@/lib/shop-service";
import { supabase } from "@/integrations/supabase/client";
import { SessionValidator } from "@/lib/session-validation";
import { R2Storage } from "@/lib/r2-storage";
import { ImageHelpers } from "@/utils/imageHelpers";
import { useI18n } from "@/i18n";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUtils";
import { useQueryClient } from "@tanstack/react-query";

interface ProductFormTabsProps {
  product?: any | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ProductParam {
  name: string;
  value: string;
  paramid?: string;
  valueid?: string;
  order_index: number;
}

interface ProductImage {
  url: string;
  order_index: number;
  alt_text?: string;
  is_main?: boolean;
  object_key?: string;
}

export const ProductFormTabs = ({ product, onSuccess, onCancel }: ProductFormTabsProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const isSavedRef = useRef(false);
  const cleanedRef = useRef(false);
  const imagesRef = useRef<ProductImage[]>([]);
  
  const [formData, setFormData] = useState({
    // Основна інформація
    name: '',
    name_ua: '',
    description: '',
    description_ua: '',
    external_id: '',
    
    // Зв'язки
    store_id: '',
    supplier_id: '',
    category_external_id: '',
    currency_code: 'UAH',
    
    // Товарна інформація
    vendor: '',
    article: '',
    
    // Ціни
    price: '',
    price_old: '',
    price_promo: '',
    
    // Склад та статус
    stock_quantity: '',
    available: true,
    state: 'new',
    docket: '',
    docket_ua: ''
  });
  
  const [params, setParams] = useState<ProductParam[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  const selectedSupplierName = useMemo(() => {
    const sid = String(formData.supplier_id || '');
    if (!sid) return '';
    const s = suppliers.find((x) => String(x.id) === sid);
    return s?.supplier_name || '';
  }, [suppliers, formData.supplier_id]);

  

  // При входе на страницу пытаться подчистить любые незакрытые временные загрузки
  useEffect(() => {
    R2Storage.cleanupPendingUploads().catch(() => {});
  }, []);

  // Держим актуальный массив изображений в ref, чтобы обработчики имели свежие данные
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);


  // Функция аварийной очистки незакрепленных изображений из R2 при уходе со страницы
  const cleanupUnsavedImages = () => {
    if (isSavedRef.current) return;
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    try {
      const currentImages = imagesRef.current || [];
      for (const img of currentImages) {
        const objectKey = img?.object_key || (img?.url ? ImageHelpers.extractObjectKeyFromUrl(img.url) : null);
        if (!objectKey) continue;
        // Отправляем keepalive-удаление без await, щоб не блокувати перехід
        R2Storage.deleteFileKeepalive(objectKey)
          .then((delivered) => {
            if (delivered) {
              R2Storage.removePendingUpload(objectKey).catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {}
  };

  // Очистка на размонтаж компонента и при системных событиях скрытия/ухода со страницы
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cleanupUnsavedImages();
      }
    };
    const onPageHide = () => {
      cleanupUnsavedImages();
    };
    const onBeforeUnload = () => {
      // Дополнительная гарантия удаления при перезагрузке/закрытии вкладки
      cleanupUnsavedImages();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      // Очистка временных загрузок, сохраненных через R2Storage (tmp-папка)
      R2Storage.cleanupPendingUploads().catch(() => {});
      // Целенаправленная очистка изображений формы, если товар не был сохранен
      cleanupUnsavedImages();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const loadProductData = useCallback(async () => {
    if (!product) return;
    
    try {
      setFormData({
        name: product.name || product.name_ua || '',
        name_ua: product.name_ua || product.name || '',
        description: product.description || product.description_ua || '',
        description_ua: product.description_ua || product.description || '',
        external_id: product.external_id || '',
        store_id: product.store_id || '',
        supplier_id: product.supplier_id || '',
        category_external_id: product.category_external_id || '',
        currency_code: product.currency_code || 'UAH',
        vendor: product.vendor || '',
        article: product.article || '',
        price: product.price?.toString() || '',
        price_old: product.price_old?.toString() || '',
        price_promo: product.price_promo?.toString() || '',
        stock_quantity: product.stock_quantity?.toString() || '',
        available: product.available !== false,
        state: product.state || 'new',
        docket: product.docket || product.docket_ua || '',
        docket_ua: product.docket_ua || product.docket || ''
      });

      // Загружаем параметры товара
      if (product.id) {
        const { data: productParams } = await supabase
          .from('store_product_params')
          .select('*')
          .eq('product_id', product.id)
          .order('order_index');

        if (productParams) {
          setParams(productParams.map(p => ({
            name: p.name,
            value: p.value,
            paramid: (p as any).paramid || '',
            valueid: (p as any).valueid || '',
            order_index: p.order_index
          })));
        }

        const productImages = await ProductService.getProductImages(String(product.id));
        const resolved = (productImages || []).map((img: any, idx: number) => {
          const originalFull = String(img?.url || "").trim();
          const objectKey = originalFull ? (ImageHelpers.extractObjectKeyFromUrl(originalFull) || undefined) : undefined;
          const objectKeyFixed = objectKey ? String(objectKey).replace(/\.web$/, ".webp") : undefined;
          return {
            url: originalFull,
            order_index: typeof img?.order_index === "number" ? img.order_index : idx,
            is_main: !!img?.is_main || (typeof img?.order_index === "number" ? img.order_index === 0 : idx === 0),
            object_key: objectKeyFixed || undefined,
          } as ProductImage;
        });
        setImages(resolved);
      }
    } catch (error) {
      console.error('Load product data error:', error);
      toast.error('Помилка завантаження даних товару');
    }
  }, [product]);

  const loadInitialData = useCallback(async () => {
    try {
      // Загружаем магазины
      const storesData = await ShopService.getShopsAggregated();
      setStores(storesData || []);
      
      if (storesData && storesData.length > 0 && !formData.store_id) {
        setFormData(prev => ({ ...prev, store_id: storesData[0].id }));
      }

      // Загружаем поставщиков
      const suppliersData = await SupplierService.getSuppliers();
      setSuppliers(suppliersData);

      // Загружаем валюты
      const { data: currenciesData } = await supabase
        .from('currencies')
        .select('*')
        .eq('status', true)
        .order('name');
      setCurrencies(currenciesData || []);
    } catch (error) {
      console.error('Load initial data error:', error);
      toast.error('Помилка завантаження початкових даних');
    }
  }, [formData.store_id]);

  const addParam = () => {
    setParams([...params, { 
      name: '', 
      value: '', 
      paramid: '',
      valueid: '',
      order_index: params.length 
    }]);
  };

  const updateParam = (index: number, field: keyof ProductParam, value: string) => {
    const updatedParams = [...params];
    updatedParams[index] = { ...updatedParams[index], [field]: value };
    setParams(updatedParams);
  };

  // Modal state for adding/editing characteristics
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<ProductParam>({
    name: "",
    value: "",
    paramid: "",
    valueid: "",
    order_index: 0,
  });

  const openAddParamModal = () => {
    setEditingParamIndex(null);
    setParamForm({ name: "", value: "", paramid: "", valueid: "", order_index: params.length });
    setIsParamModalOpen(true);
  };

  const openEditParamModal = (index: number) => {
    setEditingParamIndex(index);
    setParamForm({ ...params[index] });
    setIsParamModalOpen(true);
  };

  const saveParamModal = () => {
    const name = paramForm.name?.trim();
    const value = paramForm.value?.trim();
    if (!name || !value) return;

    if (editingParamIndex === null) {
      const newParams = [...params, { ...paramForm, order_index: params.length }];
      setParams(newParams);
    } else {
      const updatedParams = [...params];
      updatedParams[editingParamIndex] = { ...paramForm, order_index: editingParamIndex };
      setParams(updatedParams);
    }
    setIsParamModalOpen(false);
  };

  const removeParam = (index: number) => {
    const updated = params.filter((_, i) => i !== index).map((p, i) => ({ ...p, order_index: i }));
    setParams(updated);
  };

  const addImageByUrl = async () => {
    if (!newImageUrl.trim()) {
      toast.error('Введіть URL зображення');
      return;
    }

    const pid = product?.id ? String(product.id) : '';
    if (!pid) {
      toast.error('Спочатку збережіть товар, щоб додати фото за URL');
      return;
    }
    try {
      setLoading(true);
      const res = await R2Storage.uploadProductImageFromUrl(pid, newImageUrl.trim());
      const previewKey = res.r2KeyOriginal || '';
      const previewUrlFull = res.originalUrl || '';
      const urlForRender = previewKey || previewUrlFull;
      const newImage: ProductImage = {
        url: urlForRender,
        order_index: images.length,
        is_main: images.length === 0,
        object_key: previewKey || undefined,
      };
      setImages([...images, newImage]);
      setNewImageUrl('');
      try {
        const list = await ProductService.getProductImages(pid);
        const resolved = await Promise.all((list || []).map(async (img, index) => {
          const objectKeyRaw = ImageHelpers.extractObjectKeyFromUrl(img.url);
          const previewUrl = String(img.url || '');
          const absolutePreview = objectKeyRaw ? R2Storage.makePublicUrl(objectKeyRaw) : previewUrl;
          return {
            id: img.id,
            url: absolutePreview,
            alt_text: img.alt_text || '',
            order_index: typeof img.order_index === 'number' ? img.order_index : index,
            is_main: !!img.is_main,
            object_key: objectKeyRaw || undefined,
          } as ProductImage;
        }));
        setImages(resolved);
      } catch {}
      toast.success('Зображення додано');
    } catch (e) {
      console.error(e);
      toast.error('Не вдалося завантажити зображення через воркер');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = async (index: number) => {
    const target = images[index];
    try {
      const objectKey = target?.object_key || (target?.url ? ImageHelpers.extractObjectKeyFromUrl(target.url) : null);
      if (objectKey) {
        await R2Storage.deleteFile(objectKey);
        await R2Storage.removePendingUpload(objectKey);
      }
      const updatedImages = images.filter((_, i) => i !== index);
      const reorderedImages = updatedImages.map((img, i) => ({
        ...img,
        order_index: i,
        is_main: i === 0 && updatedImages.length > 0
      }));
      setImages(reorderedImages);
      const pid = product?.id ? String(product.id) : '';
      if (pid) {
        try {
          await ProductService.updateProduct(pid, { images: reorderedImages });
          try {
            const list = await ProductService.getProductImages(pid);
            const resolved = await Promise.all((list || []).map(async (img, index2) => {
              const objectKeyRaw = ImageHelpers.extractObjectKeyFromUrl(img.url);
              const previewUrl = String(img.url || '');
              const absolutePreview = objectKeyRaw ? R2Storage.makePublicUrl(objectKeyRaw) : previewUrl;
              return {
                id: img.id,
                url: absolutePreview,
                alt_text: img.alt_text || '',
                order_index: typeof img.order_index === 'number' ? img.order_index : index2,
                is_main: !!img.is_main,
                object_key: objectKeyRaw || undefined,
              } as ProductImage;
            }));
            setImages(resolved);
          } catch {}
          toast.success(t('image_deleted_successfully'));
        } catch (e) {
          toast.error(t('operation_failed'));
        }
      } else {
        toast.success(t('image_deleted_successfully'));
      }
    } catch (error) {
      console.error('Failed to delete image from R2:', error);
      toast.error(t('failed_delete_image'));
    }
  };

  const setMainImage = (index: number) => {
    const updatedImages = images.map((img, i) => ({
      ...img,
      is_main: i === index
    }));
    setImages(updatedImages);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация типа и размера
    if (!file.type.startsWith('image/')) {
      toast.error(t('choose_image_file'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('file_too_large_5mb'));
      return;
    }

    try {
      setLoading(true);
      
      const pid = product ? String(product.id) : ''
      const result = await R2Storage.uploadProductImage(pid, file)
      const newImage = {
        url: result.originalUrl,
        order_index: images.length,
        is_main: images.length === 0,
        object_key: result.r2KeyOriginal,
      } as ProductImage
      setImages([...images, newImage]);
      try {
        const list = await ProductService.getProductImages(pid);
        const normalizeImageUrl = (u: string): string => {
          const s = String(u || '');
          if (!s) return s;
          return s.replace(/\.(web|wep)(\?|#|$)/, '.webp$2');
        };
        const resolved = await Promise.all((list || []).map(async (img, index) => {
          const objectKeyRaw = ImageHelpers.extractObjectKeyFromUrl(img.url);
          const objectKeyFixed = objectKeyRaw ? String(objectKeyRaw).replace(/\.web$/, '.webp') : undefined;
          const previewUrl = normalizeImageUrl(img.url || '');
          const base = R2Storage.getR2PublicBaseUrl();
          const absolutePreview = base ? `${base}/${(objectKeyFixed || objectKeyRaw || previewUrl).replace(/^\/+/, '')}` : previewUrl;
          return {
            id: img.id,
            url: absolutePreview,
            alt_text: img.alt_text || '',
            order_index: typeof img.order_index === 'number' ? img.order_index : index,
            is_main: !!img.is_main,
            object_key: objectKeyFixed || undefined,
          } as ProductImage;
        }));
        setImages(resolved);
      } catch {}
      toast.success(t('image_uploaded_successfully'));
    } catch (error) {
      console.error('Error uploading image to R2:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = t('failed_upload_image');
      if (error instanceof Error) {
        if (error.message.includes('unauthorized')) {
          errorMessage = t('upload_unauthorized');
        } else if (error.message.includes('file_too_large')) {
          errorMessage = t('file_too_large_5mb');
        } else if (error.message.includes('invalid_file_type')) {
          errorMessage = t('choose_image_file');
        } else if (error.message.includes('upload_failed')) {
          errorMessage = t('upload_server_error');
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      e.target.value = '';
    }
  };

  // Дополнительная очистка временных загрузок при смене товара/рендере нового товара
  useEffect(() => {
    R2Storage.cleanupPendingUploads().catch(() => {});
  }, [product]);

  useEffect(() => {
    loadInitialData();
    if (product) {
      loadProductData();
    }
  }, [product, loadInitialData, loadProductData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Введіть назву товару');
      setActiveTab("basic");
      return;
    }

    if (!formData.external_id.trim()) {
      toast.error('Введіть External ID');
      setActiveTab("basic");
      return;
    }

    if (!formData.store_id) {
      toast.error('Оберіть магазин');
      setActiveTab("basic");
      return;
    }

    setLoading(true);

    try {
      // Находим валюту по коду для получения currency_id
      const selectedCurrency = currencies.find(c => c.code === formData.currency_code);
      
      // Создаем или обновляем запись в store_currencies
      if (selectedCurrency) {
        const session = await SessionValidator.ensureValidSession();
        const userId = session.user?.id || null;
        const { error: storeCurrencyError } = await supabase
          .from('store_currencies')
          .upsert({
            user_id: userId,
            store_id: formData.store_id,
            currency_id: selectedCurrency.id,
            name: selectedCurrency.name,
            code: selectedCurrency.code,
            symbol: selectedCurrency.symbol,
            is_active: true
          }, {
            onConflict: 'user_id,store_id,currency_id'
          });

        if (storeCurrencyError) {
          console.error('Store currency upsert error:', storeCurrencyError);
        }
      }

      const productData = {
        store_id: formData.store_id,
        external_id: formData.external_id,
        category_external_id: formData.category_external_id || null,
        currency_code: formData.currency_code || null,
        name: formData.name,
        name_ua: formData.name_ua || null,
        vendor: formData.vendor || null,
        article: formData.article || null,
        available: formData.available,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        price: formData.price ? parseFloat(formData.price) : null,
        price_old: formData.price_old ? parseFloat(formData.price_old) : null,
        price_promo: formData.price_promo ? parseFloat(formData.price_promo) : null,
        description: formData.description || null,
        description_ua: formData.description_ua || null,
        docket: formData.docket || null,
        docket_ua: formData.docket_ua || null,
        state: formData.state,
        params: params,
        images: images
      };

      let savedProduct;
      if (product) {
        savedProduct = await ProductService.updateProduct(product.id, productData);
        toast.success('Товар успішно оновлено');
      } else {
        savedProduct = await ProductService.createProduct(productData);
        toast.success('Товар успішно створено');
      }

      try { ProductService.clearAllProductsCaches(); } catch {}
      try { queryClient.invalidateQueries({ queryKey: ["user"], exact: false }); } catch {}
      try { queryClient.invalidateQueries({ queryKey: ["auth", "me"], exact: true }); } catch {}

      if (onSuccess) {
        onSuccess();
      }
      // Фиксируем, что товар сохранен, чтобы не удалять изображения при уходе
      isSavedRef.current = true;
    } catch (error) {
      console.error('Save product error:', error);
      toast.error('Помилка збереження товару');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="productFormTabs_form">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="productFormTabs_tabs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6" data-testid="productFormTabs_header">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 h-auto sm:h-9" data-testid="productFormTabs_tabsList">
            <TabsTrigger 
              value="basic" 
              className="w-full min-w-0 truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start sm:justify-center"
              data-testid="productForm_basicTab"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Основна інформація</span>
              <span className="sm:hidden">Основне</span>
            </TabsTrigger>
            <TabsTrigger 
              value="images" 
              className="w-full min-w-0 truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start sm:justify-center"
              data-testid="productForm_imagesTab"
            >
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Зображення</span>
              <span className="sm:hidden">Фото</span>
            </TabsTrigger>
            <TabsTrigger 
              value="params" 
              className="w-full min-w-0 truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start sm:justify-center"
              data-testid="productForm_paramsTab"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t('product_tab_parameters')}</span>
              <span className="sm:hidden">{t('product_tab_parameters')}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={loading}
              data-testid="productForm_saveButton"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {product ? t('update') : t('create')}
            </Button>
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                data-testid="productForm_cancelButton"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>

        {/* Основна інформація */}
        <TabsContent value="basic" className="space-y-6" data-testid="productFormTabs_basicContent">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="productFormTabs_basicGrid">
            {/* Основні поля */}
            <div className="lg:col-span-2 space-y-6" data-testid="productFormTabs_mainFields">
              <Card data-testid="productFormTabs_basicInfoCard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('product_main_info')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('product_name_ru')} *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('product_name_ru_placeholder')}
                        required
                        data-testid="productForm_name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name_ua">{t('product_name_uk')}</Label>
                      <Input
                        id="name_ua"
                        value={formData.name_ua}
                        onChange={(e) => setFormData({ ...formData, name_ua: e.target.value })}
                        placeholder={t('product_name_uk_placeholder')}
                        data-testid="productForm_nameUa"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('product_description_ru')}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('product_description_ru_placeholder')}
                      rows={4}
                      data-testid="productForm_description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description_ua">{t('product_description_uk')}</Label>
                    <Textarea
                      id="description_ua"
                      value={formData.description_ua}
                      onChange={(e) => setFormData({ ...formData, description_ua: e.target.value })}
                      placeholder={t('product_description_uk_placeholder')}
                      rows={4}
                      data-testid="productForm_descriptionUa"
                    />
                  </div>

                  <div className="space-y-2" data-testid="productFormTabs_supplierNameReadonly">
                    <Label htmlFor="supplier_name_readonly">{t('supplier_name')}</Label>
                    <Input id="supplier_name_readonly" value={selectedSupplierName} readOnly disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency_code">{t('currency')} *</Label>
                    <Select
                      value={formData.currency_code}
                      onValueChange={(value) => setFormData({ ...formData, currency_code: value })}
                    >
                      <SelectTrigger data-testid="productForm_currency">
                        <SelectValue placeholder={t('select_currency')} />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="external_id">{t('external_id')} *</Label>
                      <Input
                        id="external_id"
                        value={formData.external_id}
                        onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                        placeholder={t('external_id_placeholder')}
                        required
                        data-testid="productForm_externalId"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="article">{t('article')}</Label>
                      <Input
                        id="article"
                        value={formData.article}
                        onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                        placeholder={t('article_placeholder')}
                        data-testid="productForm_article"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendor">{t('manufacturer')}</Label>
                      <Input
                        id="vendor"
                        value={formData.vendor}
                        onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                        placeholder={t('manufacturer_placeholder')}
                        data-testid="productForm_vendor"
                      />
                    </div>
                  </div>

                  {/* URL field removed per requirements */}
                </CardContent>
              </Card>
            </div>

            {/* Бічна панель */}
            <div className="space-y-6" data-testid="productFormTabs_sidebar">
              {/* Магазин та постачальник */}
              <Card data-testid="productFormTabs_storeSupplierCard">
                <CardHeader>
                  <CardTitle>{t('store_supplier')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="store">{t('store')} *</Label>
                    <Select
                      value={formData.store_id}
                      onValueChange={(value) => setFormData({ ...formData, store_id: value })}
                    >
                      <SelectTrigger data-testid="productFormTabs_storeSelect">
                        <SelectValue placeholder={t('select_store')} />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.store_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Supplier select removed; supplier chosen inside category editor */}
                </CardContent>
              </Card>

              {/* Ціни */}
              <Card data-testid="productFormTabs_pricesCard">
                <CardHeader>
                  <CardTitle data-testid="productFormTabs_pricesTitle">{t('prices_stock')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency_code">{t('currency')}</Label>
                    <Select
                      value={formData.currency_code}
                      onValueChange={(value) => setFormData({ ...formData, currency_code: value })}
                    >
                      <SelectTrigger data-testid="productFormTabs_currencySelect">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UAH">{t('currency_uah')}</SelectItem>
                        <SelectItem value="USD">{t('currency_usd')}</SelectItem>
                        <SelectItem value="EUR">{t('currency_eur')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">{t('current_price')}</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      data-testid="productForm_price"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price_old">{t('old_price')}</Label>
                    <Input
                      id="price_old"
                      type="number"
                      step="0.01"
                      value={formData.price_old}
                      onChange={(e) => setFormData({ ...formData, price_old: e.target.value })}
                      placeholder="0.00"
                      data-testid="productForm_priceOld"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price_promo">{t('promo_price')}</Label>
                    <Input
                      id="price_promo"
                      type="number"
                      step="0.01"
                      value={formData.price_promo}
                      onChange={(e) => setFormData({ ...formData, price_promo: e.target.value })}
                      placeholder="0.00"
                      data-testid="productForm_pricePromo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stock_quantity">{t('stock_quantity')}</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      placeholder="0"
                      data-testid="productForm_stockQuantity"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="available"
                      checked={formData.available}
                      onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                      className="rounded border-gray-300"
                      data-testid="productForm_available"
                    />
                    <Label htmlFor="available">{t('product_available')}</Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Зображення */}
        <TabsContent value="images" className="space-y-6" data-testid="productFormTabs_imagesContent">
          <Card data-testid="productFormTabs_imagesCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                {t('product_images')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-2 sm:px-3">
              {/* Додавання зображень */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('add_image_by_url')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder={t('enter_image_url')}
                        className="flex-1"
                        data-testid="productForm_imageUrl"
                      />
                      <Button 
                        type="button" 
                        onClick={addImageByUrl} 
                        size="sm" 
                        variant="outline"
                        data-testid="productForm_addImageUrl"
                      >
                        <Link className="h-4 w-4 mr-2" />
                        {t('btn_add')}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('upload_file')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*,.avif,image/avif"
                        onChange={handleFileUpload}
                        className="flex-1"
                        data-testid="productForm_imageFile"
                      />
                      <Button type="button" size="sm" variant="outline" disabled>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('btn_upload')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('file_upload_later')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Карусель зображень */}
              {images.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('no_images_added')}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('add_images_instruction')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-medium">{t('added_images')} ({images.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg border overflow-hidden bg-muted">
                          {(() => {
                            const original = image.url || '';
                            const src = getImageUrl(original);
                            return src ? (
                              <img
                                src={src}
                                alt={`Product ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  if (original) el.src = original;
                                }}
                              />
                            ) : null
                          })()}
                        </div>
                        {image.is_main && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              {t('main_image')}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => setMainImage(index)}
                            size="icon"
                            variant="ghost"
                            aria-label={image.is_main ? t('main_image') : t('set_as_main')}
                            data-testid={`productForm_setMainImage_${index}`}
                            className={`rounded-md ${image.is_main ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-success text-primary-foreground hover:bg-success/90'}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => removeImage(index)}
                            size="icon"
                            variant="destructive"
                            data-testid={`productForm_removeImage_${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Характеристики */}
        <TabsContent value="params" className="space-y-6" data-testid="productFormTabs_paramsContent">
          <Card data-testid="productFormTabs_paramsCard" className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('product_characteristics')}
                </div>
                <Button
                  type="button"
                  onClick={openAddParamModal}
                  size="sm"
                  variant="outline"
                  data-testid="productForm_addCharacteristic"
                  aria-label={t('add_characteristic')}
                  className="max-[550px]:ml-auto"
                >
                  <Plus className="h-4 w-4 mr-2 max-[550px]:mr-0" />
                  <span className="max-[550px]:hidden">{t('add_characteristic')}</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {params.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('no_characteristics_added')}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('add_characteristics_instruction')}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {params.map((param, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 group"
                      data-testid={`productForm_paramRow_${index}`}
                    >
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <span className="text-sm text-muted-foreground">{param.name}</span>
                        <span className="text-sm font-medium">{param.value}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={t('actions')}
                            data-testid={`productForm_paramMenu_${index}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditParamModal(index)}
                            data-testid={`productForm_paramEdit_${index}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />{t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => removeParam(index)}
                            data-testid={`productForm_paramDelete_${index}`}
                          >
                            <Trash className="h-4 w-4 mr-2" />{t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}

              {/* Modal for add/edit characteristic */}
              <Dialog open={isParamModalOpen} onOpenChange={setIsParamModalOpen}>
                <DialogContent data-testid="productForm_paramModal">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {editingParamIndex === null ? t('add_characteristic') : t('edit_characteristic')}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {editingParamIndex === null ? t('add_characteristic') : t('edit_characteristic')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="param-name-modal">{t('characteristic_name')}</Label>
                      <Input
                        id="param-name-modal"
                        value={paramForm.name}
                        onChange={(e) => setParamForm({ ...paramForm, name: e.target.value })}
                        placeholder={t('characteristic_name_placeholder')}
                        data-testid="productForm_modal_paramName"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="param-value-modal">{t('value')}</Label>
                      <Input
                        id="param-value-modal"
                        value={paramForm.value}
                        onChange={(e) => setParamForm({ ...paramForm, value: e.target.value })}
                        placeholder={t('characteristic_value_placeholder')}
                        data-testid="productForm_modal_paramValue"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="param-paramid-modal">{t('param_id_optional')}</Label>
                        <Input
                          id="param-paramid-modal"
                          value={paramForm.paramid || ''}
                          onChange={(e) => setParamForm({ ...paramForm, paramid: e.target.value })}
                          placeholder={t('param_id_placeholder')}
                          data-testid="productForm_modal_paramId"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="param-valueid-modal">{t('value_id_optional')}</Label>
                        <Input
                          id="param-valueid-modal"
                          value={paramForm.valueid || ''}
                          onChange={(e) => setParamForm({ ...paramForm, valueid: e.target.value })}
                          placeholder={t('value_id_placeholder')}
                          data-testid="productForm_modal_valueId"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsParamModalOpen(false)}
                      data-testid="productForm_modal_cancel"
                    >
                      {t('btn_cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={saveParamModal}
                      data-testid="productForm_modal_save"
                    >
                      {editingParamIndex === null ? t('btn_create') : t('btn_update')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
};
