import React from 'react';
import NamesDescriptionSection from '../NamesDescriptionSection';
import BasicSection from '../BasicSection';
import PricesSection from '../PricesSection';
import ImagePreviewSection from '../ImagePreviewSection';
import CategoryEditorSection from '../CategoryEditorSection';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type {
  BasicData,
  PriceData,
  StockData,
  CategoryOption,
  CurrencyOption,
  ProductImage,
  SupplierOption,
} from '../types';

type Props = {
  formState: { basicData: BasicData; priceData: PriceData; stockData: StockData };
  formActions: {
    updateBasicData: (partial: Partial<BasicData>) => void;
    setPriceData: React.Dispatch<React.SetStateAction<PriceData>>;
    setStockData: React.Dispatch<React.SetStateAction<StockData>>;
    setBasicData: React.Dispatch<React.SetStateAction<BasicData>>;
  };
  onExternalChange?: (partial: Partial<BasicData & PriceData & StockData>) => void;
  lookups: {
    currencies: CurrencyOption[];
    categories: CategoryOption[];
    selectedCategoryName: string;
    selectedSupplierName: string;
    suppliers: SupplierOption[];
    setCategories: React.Dispatch<React.SetStateAction<CategoryOption[]>>;
    preloadedSupplierCategoriesMap?: Record<string, CategoryOption[]>;
  };
  imageState: { images: ProductImage[]; activeIndex: number; galleryImgRefs: React.MutableRefObject<Array<HTMLImageElement | null>> };
  imageHandlers: {
    onSelectIndex: (i: number) => void;
    getMainAdaptiveImageStyle: (dims?: { width: number; height: number }) => React.CSSProperties;
    getThumbSizeRem: any;
    onGalleryImageLoad: (e: React.SyntheticEvent<HTMLImageElement>, i: number) => void;
    onGalleryImageError: (e: React.SyntheticEvent<HTMLImageElement>, i: number) => void;
    onGalleryVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>, i: number) => void;
    onPrev: () => void;
    onNext: () => void;
    onMainImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    onMainImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    onMainVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    onResizeStart: (e: React.MouseEvent) => void;
    onResetSize: () => void;
    photoBlockRef: React.RefObject<HTMLDivElement>;
  };
  config: { t: (k: string) => string; readOnly?: boolean; editableKeys?: Array<'price' | 'price_old' | 'price_promo' | 'stock_quantity' | 'available'>; isLargeScreen: boolean; isEditing?: boolean };
};

export const InfoTab = React.memo(function InfoTab(props: Props) {
  const {
    formState,
    formActions,
    lookups,
    imageState,
    imageHandlers,
    config,
  } = props;
  const { t, readOnly, editableKeys, isLargeScreen, isEditing } = config;
  const { basicData, priceData, stockData } = formState;
  const { updateBasicData, setPriceData, setStockData, setBasicData } = formActions;
  const {
    currencies,
    categories,
    selectedCategoryName,
    selectedSupplierName,
    suppliers,
    setCategories,
    preloadedSupplierCategoriesMap,
  } = lookups;
  const { images, activeIndex, galleryImgRefs } = imageState;
  const {
    onSelectIndex,
    getMainAdaptiveImageStyle,
    getThumbSizeRem,
    onGalleryImageLoad,
    onGalleryImageError,
    onGalleryVideoLoaded,
    onPrev,
    onNext,
    onMainImageLoad,
    onMainImageError,
    onMainVideoLoaded,
    onResizeStart,
    onResetSize,
    photoBlockRef
  } = imageHandlers;
  const handleBasicChange = (partial: Partial<BasicData>) => {
    updateBasicData(partial);
    props.onExternalChange?.(partial);
  };

  return (
    <div className="space-y-6" data-testid="productFormTabs_infoContent">
      <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-8 lg:items-start" data-testid="productFormTabs_mainRow">
        <div className="shrink-0 space-y-4 relative px-4 sm:px-6" data-testid="productFormTabs_photoContainer" ref={photoBlockRef} onDoubleClick={onResetSize}>
          <ImagePreviewSection
            images={images}
            activeIndex={activeIndex}
            onSelectIndex={onSelectIndex}
            getMainAdaptiveImageStyle={getMainAdaptiveImageStyle}
            isLargeScreen={isLargeScreen}
            galleryImgRefs={galleryImgRefs}
            getThumbSizeRem={getThumbSizeRem}
            onGalleryImageLoad={onGalleryImageLoad}
            onGalleryImageError={onGalleryImageError}
            onGalleryVideoLoaded={onGalleryVideoLoaded}
            onPrev={onPrev}
            onNext={onNext}
            onMainImageLoad={onMainImageLoad}
            onMainImageError={onMainImageError}
            onMainVideoLoaded={onMainVideoLoaded}
            onResizeStart={onResizeStart}
            onResetSize={onResetSize}
          />
        </div>
        <div className="flex-1 min-w-0 sm:min-w-[20rem] space-y-6 px-2 sm:px-3" data-testid="productFormTabs_formContainer">
          <NamesDescriptionSection t={t} data={basicData} onChange={handleBasicChange} readOnly={readOnly} />
          {readOnly && (
            <div className="space-y-2" data-testid="productFormTabs_supplierNameReadonly">
              <Label htmlFor="supplier_name_readonly">{t('supplier_name')}</Label>
              <Input id="supplier_name_readonly" value={selectedSupplierName} readOnly disabled />
            </div>
          )}
        </div>
      </div>
      <BasicSection
        t={t}
        basicData={basicData}
        setBasicData={setBasicData as any}
        stockData={stockData}
        setStockData={setStockData}
        readOnly={readOnly}
        editableKeys={editableKeys}
        categories={categories}
        selectedCategoryName={selectedCategoryName}
        onChange={props.onExternalChange as any}
      />
      {!readOnly && (
        <CategoryEditorSection
          t={t}
          suppliers={suppliers}
          categories={categories}
          setCategories={setCategories}
          preloadedSupplierCategoriesMap={preloadedSupplierCategoriesMap}
          basicData={basicData}
          setBasicData={setBasicData}
          defaultOpen={!isEditing}
        />
      )}
      <PricesSection t={t} readOnly={readOnly} editableKeys={editableKeys} currencies={currencies} priceData={priceData} setPriceData={setPriceData} onChange={props.onExternalChange as any} />
    </div>
  );
})
