import React, { useState, useCallback, useMemo, Suspense, lazy, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import TabsHeader from './ProductFormTabs/TabsHeader';
import FormActions from './ProductFormTabs/FormActions';
import { usePhotoPreview } from './ProductFormTabs/hooks/usePhotoPreview';
import { useTabsScroll } from '@/hooks/useTabsScroll';
import { useImageGallery } from '@/hooks/useImageGallery';
import { useImageDimensions } from '@/hooks/useImageDimensions';
import { useImageLoadHandlers } from '@/hooks/useImageLoadHandlers';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { type Product } from '@/lib/product-service';
import { useI18n } from "@/i18n";
import { useImageUpload } from '@/hooks/useImageUpload';
import { useProductImages } from '@/hooks/useProductImages';
import { useProductForm } from '@/hooks/useProductForm';
import { useProductParams } from '@/hooks/useProductParams';
import { useProductLookups } from '@/hooks/useProductLookups';
import { useImageCleanup } from '@/hooks/useImageCleanup';
import { useImageDrop } from '@/hooks/useImageDrop';
import { useImageActions } from '@/hooks/useImageActions';
import { mapImageErrorToToast } from '@/utils/imageErrorHelpers';
import type { SupplierOption, CategoryOption, CurrencyOption, ProductImage, ProductParam, FormData } from './ProductFormTabs/types';
import { ProductImageDeleteProgressDialog, ProductSaveProgressDialog } from '@/components/user/products/ProductsTable/Dialogs';
import { getTemplateAttributes, listTemplatesByCategory } from '@/lib/category-template';

const InfoTab = lazy(async () => {
  const mod = await import('./ProductFormTabs/tabs/InfoTab');
  return { default: mod.InfoTab };
});
const ImagesTab = lazy(async () => {
  const mod = await import('./ProductFormTabs/tabs/ImagesTab');
  return { default: mod.ImagesTab };
});
const ParamsTab = lazy(async () => {
  const mod = await import('./ProductFormTabs/tabs/ParamsTab');
  return { default: mod.ParamsTab };
});

const tabFallback = (
  <div className="flex items-center justify-center py-10">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);
interface ProductFormTabsProps {
  product?: Product | null;
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  editableKeys?: Array<'price' | 'price_old' | 'price_promo' | 'stock_quantity' | 'available'>;
  overrides?: Partial<FormData>;
  onChange?: (partial: Partial<FormData>) => void;
  onImagesLoadingChange?: (loading: boolean) => void;
  onParamsChange?: (params: ProductParam[]) => void;
  forceParamsEditable?: boolean;
  preloadedSuppliers?: SupplierOption[];
  preloadedCurrencies?: CurrencyOption[];
  preloadedCategories?: CategoryOption[];
  preloadedImages?: ProductImage[];
  preloadedParams?: ProductParam[];
  preloadedSupplierCategoriesMap?: Record<string, CategoryOption[]>;
}
export function ProductFormTabs({
  product,
  onSubmit,
  onCancel,
  readOnly,
  editableKeys,
  overrides,
  onChange,
  onImagesLoadingChange,
  onParamsChange,
  forceParamsEditable,
  preloadedSuppliers,
  preloadedCurrencies,
  preloadedCategories,
  preloadedImages,
  preloadedParams,
  preloadedSupplierCategoriesMap
}: ProductFormTabsProps) {
  
  const { tabsScrollRef, hasOverflow: tabsOverflow } = useTabsScroll();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ open: boolean; title: string; productName: string | null }>({
    open: false,
    title: "",
    productName: null,
  });
  const saveProgressTimerRef = useRef<number | null>(null);
  const [imageDeleteProgress, setImageDeleteProgress] = useState<{ open: boolean; productName: string | null }>({
    open: false,
    productName: null,
  });
  const imageDeleteProgressTimerRef = useRef<number | null>(null);

  const {
    basicData,
    priceData,
    stockData,
    formData,
    setBasicData,
    setPriceData,
    setStockData,
    updateBasicData,
  } = useProductForm(product, overrides);

  // Images state
  const pid = product?.id ? String(product.id) : '';
  const { images, activeIndex, goPrevious, goNext, goToIndex, addImages: addImagesHook, removeImage: removeImageHook, setMainImage: setMainImageHook, reorderImages, reload } = useProductImages(pid, preloadedImages);
  const [imageUrl, setImageUrl] = useState('');
  const uploadState = useImageUpload(pid);
  const { photoBlockRef, isLargeScreen, getAdaptiveImageStyle, getThumbSizeRem, handlePhotoResizeStart, resetPhotoBlockToDefaultSize, galleryImgRefs } = usePhotoPreview(activeIndex);
  const drop = useImageDrop({
    productId: pid,
    addImages: addImagesHook,
    uploadFile: uploadState.uploadFile,
    uploadFromUrl: uploadState.uploadFromUrl,
    reload,
  });
  const imageActions = useImageActions(pid, images, addImagesHook, reload, uploadState.uploadFromUrl, uploadState.uploadFile, uploadState.uploadFiles, removeImageHook, setMainImageHook, reorderImages);
  const { updateDimensions, getGalleryAdaptiveImageStyle } = useImageDimensions();
  // removed unused maxContainerSize state
  // Refs for cleanup lifecycle
  const isNewProduct = !product?.id;


  // Drag and drop state
  const { incrementLoadCount } = useImageGallery(images.length, activeTab, onImagesLoadingChange);

  

  const { handleImageLoad, handleMainVideoLoaded, handleGalleryImageLoad, handleGalleryImageError, handleGalleryVideoLoaded } =
    useImageLoadHandlers({ activeIndex, updateDimensions, incrementLoadCount });

  const handleSelectIndex = useCallback((i: number) => {
    goToIndex(i);
  }, [goToIndex]);

  

  // Calculate maximum container size from all images
  

  const {
    parameters,
    isParamModalOpen,
    setIsParamModalOpen,
    editingParamIndex,
    setSelectedParamRows,
    paramForm,
    setParamForm,
    openAddParamModal,
    openEditParamModal,
    saveParamModal,
    deleteParam,
    deleteSelectedParams,
    setParameters,
  } = useProductParams(preloadedParams, onParamsChange);

  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const categoryId = useMemo(() => {
    const raw = basicData.category_id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [basicData.category_id]);

  useEffect(() => {
    let active = true;
    if (!categoryId) {
      setTemplates([]);
      setSelectedTemplateId('');
      return;
    }
    setTemplatesLoading(true);
    listTemplatesByCategory(categoryId)
      .then((items) => {
        if (!active) return;
        const list = Array.isArray(items) ? items : [];
        setTemplates(list.map((i) => ({ id: i.id, name: i.name })));
        setSelectedTemplateId((prev) => {
          const exists = list.some((i) => String(i.id) === String(prev));
          return exists ? prev : list[0] ? String(list[0].id) : '';
        });
      })
      .catch(() => {
        if (!active) return;
        setTemplates([]);
      })
      .finally(() => {
        if (!active) return;
        setTemplatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId]);

  const handleTemplateChange = useCallback((id: string) => {
    setSelectedTemplateId(id);
  }, []);

  const mapOptionLabel = useCallback(
    (opt: { value: string; display_value?: string | null; value_lang?: Record<string, string> | null }) => {
      const localized = opt.value_lang?.[lang || ''] || opt.display_value;
      return localized || opt.value;
    },
    [lang],
  );

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplateId) return;
    setApplyingTemplate(true);
    try {
      const attrs = await getTemplateAttributes(Number(selectedTemplateId));
      const next = [...parameters];
      for (const attr of attrs) {
        const options = (attr.values || []).map((v) => ({
          ...v,
          display_value: mapOptionLabel(v),
        }));
        const defaultOption = attr.default_value
          ? options.find((o) => o.value === attr.default_value)
          : options[0];
        const resolvedValue = defaultOption?.value || attr.default_value || '';
        const resolvedValueId = defaultOption?.valueid ?? null;
        const index = next.findIndex((p) => {
          if (attr.paramid && p.paramid) return String(p.paramid) === String(attr.paramid);
          return p.name === attr.name;
        });
        if (index === -1) {
          next.push({
            name: attr.name,
            value: resolvedValue,
            paramid: attr.paramid || '',
            valueid: resolvedValueId || '',
            order_index: next.length,
            template_attribute_id: attr.id,
            attribute_type: attr.attribute_type,
            unit: attr.unit || null,
            is_required: !!attr.is_required,
            value_options: options,
          });
        } else {
          const prev = next[index];
          const current = prev.value ? prev.value : resolvedValue;
          const hasCurrent = options.some((o) => o.value === current);
          const finalValue = hasCurrent ? current : resolvedValue;
          const finalValueId = options.find((o) => o.value === finalValue)?.valueid ?? resolvedValueId ?? prev.valueid ?? '';
          next[index] = {
            ...prev,
            name: attr.name,
            paramid: attr.paramid || prev.paramid || '',
            value: finalValue,
            valueid: finalValueId || '',
            template_attribute_id: attr.id,
            attribute_type: attr.attribute_type,
            unit: attr.unit || prev.unit || null,
            is_required: !!attr.is_required,
            value_options: options,
          };
        }
      }
      const normalized = next.map((p, i) => ({ ...p, order_index: i }));
      setParameters(normalized);
      onParamsChange?.(normalized);
    } finally {
      setApplyingTemplate(false);
    }
  }, [mapOptionLabel, onParamsChange, parameters, selectedTemplateId, setParameters]);

  const handleValueChange = useCallback(
    (rowIndex: number, value: string, valueid?: string | null) => {
      const next = parameters.map((p, i) =>
        i === rowIndex ? { ...p, value, valueid: valueid ?? p.valueid ?? '' } : p,
      );
      const normalized = next.map((p, i) => ({ ...p, order_index: i }));
      setParameters(normalized);
      onParamsChange?.(normalized);
    },
    [onParamsChange, parameters, setParameters],
  );

  const handleNameChange = useCallback(
    (rowIndex: number, value: string) => {
      const next = parameters.map((p, i) => (i === rowIndex ? { ...p, name: value } : p));
      const normalized = next.map((p, i) => ({ ...p, order_index: i }));
      setParameters(normalized);
      onParamsChange?.(normalized);
    },
    [onParamsChange, parameters, setParameters],
  );

  const lookups = useProductLookups(
    product?.store_id || '',
    basicData,
    setBasicData,
    preloadedSuppliers,
    preloadedCurrencies,
    preloadedCategories,
    preloadedSupplierCategoriesMap
  );
  const {
    suppliers,
    categories,
    currencies,
    selectedCategoryName,
    selectedSupplierName,
    setCategories,
  } = lookups;
  // Removed redundant selectedSupplierId; formData.supplier_id is the single source of truth

  
  const { markSaved } = useImageCleanup(isNewProduct, images);
  const handleSubmit = useCallback(async () => {
    if (!basicData.name_ua.trim() && !basicData.name.trim()) {
      toast.error(t('product_name_required'));
      return;
    }
    if (saveProgressTimerRef.current) {
      window.clearTimeout(saveProgressTimerRef.current);
      saveProgressTimerRef.current = null;
    }
    setSaveProgress({
      open: false,
      title: product ? t("product_btn_update") : t("product_btn_create"),
      productName: product?.name_ua || product?.name || basicData.name_ua || basicData.name || null,
    });
    saveProgressTimerRef.current = window.setTimeout(() => {
      setSaveProgress((prev) => ({ ...prev, open: true }));
    }, 250);
    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit({
          formData,
          images,
          parameters
        });
      }
      markSaved();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(t('failed_save_product'));
    } finally {
      if (saveProgressTimerRef.current) {
        window.clearTimeout(saveProgressTimerRef.current);
        saveProgressTimerRef.current = null;
      }
      setSaveProgress({ open: false, title: "", productName: null });
      setLoading(false);
    }
  }, [basicData.name, basicData.name_ua, formData, images, markSaved, onSubmit, parameters, product, t]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/user/products');
    }
  }, [navigate, onCancel]);

  // Image handling functions
  const addImageFromUrlAction = imageActions.addImageFromUrl;
  const handleFileUploadAction = imageActions.handleFileUpload;

  const addImageFromUrl = useCallback(async () => {
    if (!imageUrl.trim()) return;
    const res = await addImageFromUrlAction(imageUrl.trim());
    if (res.ok) {
      setImageUrl('');
      toast.success(t('image_uploaded_successfully'));
    } else {
      toast.error(mapImageErrorToToast(t, res.errorCode));
    }
  }, [addImageFromUrlAction, imageUrl, t]);

  const handleRemoveImage = useCallback(async (index: number) => {
    if (imageDeleteProgressTimerRef.current) {
      window.clearTimeout(imageDeleteProgressTimerRef.current);
      imageDeleteProgressTimerRef.current = null;
    }

    setImageDeleteProgress({
      open: false,
      productName: product?.name_ua || product?.name || basicData.name_ua || basicData.name || null,
    });

    imageDeleteProgressTimerRef.current = window.setTimeout(() => {
      setImageDeleteProgress((prev) => ({ ...prev, open: true }));
    }, 250);

    try {
      return await imageActions.removeImageWithR2(index);
    } finally {
      if (imageDeleteProgressTimerRef.current) {
        window.clearTimeout(imageDeleteProgressTimerRef.current);
        imageDeleteProgressTimerRef.current = null;
      }
      setImageDeleteProgress({ open: false, productName: null });
    }
  }, [basicData.name, basicData.name_ua, imageActions, product?.name, product?.name_ua]);

  const handleSetImageUrl = useCallback((v: string) => {
    setImageUrl(v);
  }, []);

  // Drag and drop handlers
  const handleDragOver = drop.onDragOver;
  const handleDragEnter = drop.onDragEnter;
  const handleDragLeave = drop.onDragLeave;
  const handleDropAction = drop.onDrop;
  // Drop handler
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    await handleDropAction(e, images.length);
  }, [handleDropAction, images.length]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const res = await handleFileUploadAction(event);
    if (res.uploadedCount && res.uploadedCount > 0) {
      toast.success(t('image_uploaded_successfully'));
    }
    if (!res.ok) {
      toast.error(mapImageErrorToToast(t, res.errorCode));
    }
  }, [handleFileUploadAction, t]);

  const handleDropZoneClick = useCallback(() => {
    document.getElementById('fileUpload')?.click();
  }, []);

  const handleMainImageError = useCallback((_event: React.SyntheticEvent<HTMLImageElement>) => {
    void 0;
  }, []);

  const infoFormState = useMemo(() => ({ basicData, priceData, stockData }), [basicData, priceData, stockData]);
  const infoFormActions = useMemo(() => ({ updateBasicData, setPriceData, setStockData, setBasicData }), [setBasicData, setPriceData, setStockData, updateBasicData]);
  const infoLookups = useMemo(
    () => ({
      currencies,
      categories,
      selectedCategoryName,
      selectedSupplierName,
      suppliers,
      setCategories,
      preloadedSupplierCategoriesMap,
    }),
    [categories, currencies, preloadedSupplierCategoriesMap, selectedCategoryName, selectedSupplierName, setCategories, suppliers],
  );
  const infoImageState = useMemo(() => ({ images, activeIndex, galleryImgRefs }), [activeIndex, galleryImgRefs, images]);
  const infoImageHandlers = useMemo(
    () => ({
      onSelectIndex: handleSelectIndex,
      getMainAdaptiveImageStyle: getAdaptiveImageStyle,
      getThumbSizeRem,
      onGalleryImageLoad: handleGalleryImageLoad,
      onGalleryImageError: handleGalleryImageError,
      onGalleryVideoLoaded: handleGalleryVideoLoaded,
      onPrev: goPrevious,
      onNext: goNext,
      onMainImageLoad: handleImageLoad,
      onMainImageError: handleMainImageError,
      onMainVideoLoaded: handleMainVideoLoaded,
      onResizeStart: handlePhotoResizeStart,
      onResetSize: resetPhotoBlockToDefaultSize,
      photoBlockRef,
    }),
    [
      getAdaptiveImageStyle,
      getThumbSizeRem,
      goNext,
      goPrevious,
      handleGalleryImageError,
      handleGalleryImageLoad,
      handleGalleryVideoLoaded,
      handleImageLoad,
      handleMainImageError,
      handleMainVideoLoaded,
      handlePhotoResizeStart,
      handleSelectIndex,
      photoBlockRef,
      resetPhotoBlockToDefaultSize,
    ],
  );
  const infoConfig = useMemo(
    () => ({ t, readOnly, editableKeys, isLargeScreen, isEditing: !!product }),
    [editableKeys, isLargeScreen, product, readOnly, t],
  );

  const handleEditRow = useCallback((index: number) => openEditParamModal(index), [openEditParamModal]);
  const handleDeleteRow = useCallback((index: number) => deleteParam(index), [deleteParam]);
  const handleReplaceParams = useCallback((rows: ProductParam[]) => {
    const withOrder = (rows || []).map((p, index) => ({
      ...p,
      order_index: typeof p.order_index === "number" ? p.order_index : index,
    }));
    const normalized = withOrder
      .map((p, index) => ({ ...p, order_index: p.order_index, __index: index }))
      .sort((a, b) => {
        const diff = Number(a.order_index) - Number(b.order_index);
        return diff !== 0 ? diff : a.__index - b.__index;
      })
      .map((p, index) => {
        const { __index, ...rest } = p;
        return { ...rest, order_index: index };
      });
    setParameters(normalized);
    onParamsChange?.(normalized);
  }, [onParamsChange, setParameters]);

  return <div className="container mx-auto px-2 sm:px-6 py-3 sm:py-6 max-w-7xl" data-testid="productFormTabs_container">
      <ProductSaveProgressDialog open={saveProgress.open} title={saveProgress.title} productName={saveProgress.productName} />
      <ProductImageDeleteProgressDialog open={imageDeleteProgress.open} productName={imageDeleteProgress.productName} />
      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product ? t('edit_product') : t('create_new_product')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsHeader t={t} tabsOverflow={tabsOverflow} tabsScrollRef={tabsScrollRef} />

            <TabsContent value="info" className="space-y-6" data-testid="productFormTabs_infoContent">
              <Suspense fallback={tabFallback}>
                <InfoTab
                  formState={infoFormState}
                  formActions={infoFormActions}
                  onExternalChange={onChange as any}
                  lookups={infoLookups as any}
                  imageState={infoImageState}
                  imageHandlers={infoImageHandlers as any}
                  config={infoConfig}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="images" className="space-y-5 md:space-y-6" data-testid="productFormTabs_imagesContent">
              <Suspense fallback={tabFallback}>
                <ImagesTab
                  images={images}
                  readOnly={readOnly}
                  isDragOver={drop.isDragOver}
                  uploading={uploadState.uploading}
                  uploadProgress={uploadState.uploadProgress}
                  imageUrl={imageUrl}
                  onSetImageUrl={handleSetImageUrl}
                  onAddImageFromUrl={addImageFromUrl}
                  onRemoveImage={handleRemoveImage}
                  onSetMainImage={imageActions.setMain}
                  onReorderImages={imageActions.reorder}
                  onFileUpload={handleFileUpload}
                  onDropZoneClick={handleDropZoneClick}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  getGalleryAdaptiveImageStyle={getGalleryAdaptiveImageStyle}
                  galleryImgRefs={galleryImgRefs}
                  onGalleryImageLoad={handleGalleryImageLoad}
                  onGalleryImageError={handleGalleryImageError}
                  onGalleryVideoLoaded={handleGalleryVideoLoaded}
                  activeIndex={activeIndex}
                  onSelectIndex={handleSelectIndex}
                  getMainAdaptiveImageStyle={getAdaptiveImageStyle}
                  onMainImageLoad={handleImageLoad}
                  onMainImageError={handleMainImageError}
                  onMainVideoLoaded={handleMainVideoLoaded}
                  onPrev={goPrevious}
                  onNext={goNext}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="params" className="space-y-6" data-testid="productFormTabs_paramsContent">
              <Suspense fallback={tabFallback}>
                <ParamsTab
                  t={t}
                  readOnly={readOnly}
                  forceParamsEditable={forceParamsEditable}
                  parameters={parameters}
                  templates={templates}
                  templatesLoading={templatesLoading}
                  selectedTemplateId={selectedTemplateId}
                  onTemplateChange={handleTemplateChange}
                  onApplyTemplate={handleApplyTemplate}
                  applyingTemplate={applyingTemplate}
                  onEditRow={handleEditRow}
                  onDeleteRow={handleDeleteRow}
                  onDeleteSelected={deleteSelectedParams}
                  onSelectionChange={setSelectedParamRows}
                  onAddParam={openAddParamModal}
                  onReplaceData={handleReplaceParams}
                  onValueChange={handleValueChange}
                  onNameChange={handleNameChange}
                  isParamModalOpen={isParamModalOpen}
                  setIsParamModalOpen={setIsParamModalOpen as any}
                  paramForm={paramForm}
                  setParamForm={setParamForm as any}
                  saveParamModal={saveParamModal}
                  editingParamIndex={editingParamIndex}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
          
          <FormActions t={t} readOnly={readOnly} loading={loading} product={product} onCancel={handleCancel} onSubmit={handleSubmit} disabledSubmit={loading || (!basicData.name_ua.trim() && !basicData.name.trim())} />
        </CardContent>
      </Card>
    </div>;
}
