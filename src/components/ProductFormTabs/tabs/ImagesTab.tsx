import React, { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import type { ProductImage } from '../types';

const ImageSection = lazy(() => import('../ImageSection'));

type Props = {
  images: ProductImage[];
  readOnly?: boolean;
  isDragOver: boolean;
  uploading: boolean;
  uploadProgress?: number | null;
  imageUrl: string;
  onSetImageUrl: (v: string) => void;
  onAddImageFromUrl: () => void;
  onRemoveImage: (index: number) => void;
  onSetMainImage: (index: number) => void;
  onReorderImages: (list: ProductImage[]) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDropZoneClick: () => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  getGalleryAdaptiveImageStyle: (index: number) => React.CSSProperties;
  galleryImgRefs: React.MutableRefObject<Array<HTMLImageElement | null>>;
  onGalleryImageLoad: (e: React.SyntheticEvent<HTMLImageElement>, i: number) => void;
  onGalleryImageError: (e: React.SyntheticEvent<HTMLImageElement>, i: number) => void;
  onGalleryVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>, i: number) => void;
  activeIndex: number;
  onSelectIndex: (i: number) => void;
  getMainAdaptiveImageStyle: (dims?: { width: number; height: number }) => React.CSSProperties;
  onMainImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onMainImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onMainVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPrev: () => void;
  onNext: () => void;
  getThumbSizeRem?: any;
};

export const ImagesTab = React.memo(function ImagesTab(props: Props) {
  return (
    <div className="space-y-5 md:space-y-6" data-testid="productFormTabs_imagesContent">
      <Suspense fallback={<Spinner className="mx-auto" />}>
        <ImageSection
          images={props.images}
          readOnly={props.readOnly}
          isDragOver={props.isDragOver}
          uploading={props.uploading}
          uploadProgress={props.uploadProgress}
          imageUrl={props.imageUrl}
          onSetImageUrl={props.onSetImageUrl}
          onAddImageFromUrl={props.onAddImageFromUrl}
          onRemoveImage={props.onRemoveImage}
          onSetMainImage={props.onSetMainImage}
          onReorderImages={props.onReorderImages}
          onFileUpload={props.onFileUpload}
          onDropZoneClick={props.onDropZoneClick}
          onDragEnter={props.onDragEnter}
          onDragOver={props.onDragOver}
          onDragLeave={props.onDragLeave}
          onDrop={props.onDrop}
          getGalleryAdaptiveImageStyle={props.getGalleryAdaptiveImageStyle}
          galleryImgRefs={props.galleryImgRefs}
          onGalleryImageLoad={props.onGalleryImageLoad}
          onGalleryImageError={props.onGalleryImageError}
          onGalleryVideoLoaded={props.onGalleryVideoLoaded}
          activeIndex={props.activeIndex}
          onSelectIndex={props.onSelectIndex}
          getMainAdaptiveImageStyle={props.getMainAdaptiveImageStyle}
          onMainImageLoad={props.onMainImageLoad}
          onMainImageError={props.onMainImageError}
          onMainVideoLoaded={props.onMainVideoLoaded}
          onPrev={props.onPrev}
          onNext={props.onNext}
        />
      </Suspense>
    </div>
  );
})
