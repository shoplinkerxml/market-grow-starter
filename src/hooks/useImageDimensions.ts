import { useMemo, useState } from 'react';

export function useImageDimensions() {
  const [imageDimensionsMap, setImageDimensionsMap] = useState<Map<number, { width: number; height: number }>>(new Map());

  const updateDimensions = useMemo(() => {
    let timer: number | null = null;
    return (index: number, dims: { width: number; height: number }) => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        setImageDimensionsMap(prev => {
          const next = new Map(prev);
          next.set(index, dims);
          return next;
        });
      }, 100);
    };
  }, []);

  const getGalleryAdaptiveImageStyle = (index: number): React.CSSProperties => {
    const dimensions = imageDimensionsMap.get(index);
    if (!dimensions) {
      return {
        width: '100%',
        maxWidth: 'clamp(8rem, 25vw, 18.75rem)',
        maxHeight: 'clamp(8rem, 25vw, 18.75rem)',
        aspectRatio: '1 / 1'
      };
    }
    const { width, height } = dimensions;
    return {
      width: '100%',
      maxWidth: 'clamp(8rem, 25vw, 18.75rem)',
      maxHeight: 'clamp(8rem, 25vw, 18.75rem)',
      aspectRatio: `${width} / ${height}`
    };
  };

  const clearDimensions = () => setImageDimensionsMap(new Map());

  return { updateDimensions, getGalleryAdaptiveImageStyle, clearDimensions };
}

