import type React from 'react';

export function useImageLoadHandlers(options: {
  activeIndex: number;
  updateDimensions: (index: number, dims: { width: number; height: number }) => void;
  incrementLoadCount: () => void;
}) {
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
    options.updateDimensions(options.activeIndex, dimensions);
  };

  const handleMainVideoLoaded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    const dimensions = { width: vid.videoWidth, height: vid.videoHeight };
    options.updateDimensions(options.activeIndex, dimensions);
  };

  const handleGalleryImageLoad = (event: React.SyntheticEvent<HTMLImageElement>, index: number) => {
    const img = event.currentTarget;
    options.updateDimensions(index, { width: img.naturalWidth, height: img.naturalHeight });
    options.incrementLoadCount();
  };

  const handleGalleryImageError = (_event: React.SyntheticEvent<HTMLImageElement>, _index: number) => {
    options.incrementLoadCount();
  };

  const handleGalleryVideoLoaded = (event: React.SyntheticEvent<HTMLVideoElement>, index: number) => {
    const vid = event.currentTarget;
    options.updateDimensions(index, { width: vid.videoWidth, height: vid.videoHeight });
    options.incrementLoadCount();
  };

  return {
    handleImageLoad,
    handleMainVideoLoaded,
    handleGalleryImageLoad,
    handleGalleryImageError,
    handleGalleryVideoLoaded,
  };
}

