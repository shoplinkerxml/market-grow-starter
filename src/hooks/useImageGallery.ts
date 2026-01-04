import { useEffect, useMemo, useState, useCallback, useRef } from 'react';

export function useImageGallery(
  imagesLength: number, 
  activeTab: string, 
  onImagesLoadingChange?: (flag: boolean) => void
) {
  const [loadedCount, setLoadedCount] = useState(0);
  const imagesLengthRef = useRef(imagesLength);
  
  // Мemoized вычисление состояний
  const isLoading = useMemo(
    () => imagesLength > 0 && loadedCount < imagesLength,
    [imagesLength, loadedCount]
  );
  
  const isLoaded = useMemo(
    () => imagesLength === 0 || loadedCount >= imagesLength,
    [imagesLength, loadedCount]
  );

  // Сброс при изменении количества изображений
  useEffect(() => {
    imagesLengthRef.current = imagesLength;
    setLoadedCount(0);
  }, [imagesLength]);

  // Стабильная ссылка на коллбек
  const onLoadingChangeRef = useRef(onImagesLoadingChange);
  useEffect(() => {
    onLoadingChangeRef.current = onImagesLoadingChange;
  }, [onImagesLoadingChange]);

  // Уведомление о загрузке (с защитой от лишних вызовов)
  const prevLoadingStateRef = useRef<boolean>();
  useEffect(() => {
    if (!onLoadingChangeRef.current) return;

    const shouldShowLoading = activeTab === 'images' && isLoading;
    
    if (prevLoadingStateRef.current !== shouldShowLoading) {
      prevLoadingStateRef.current = shouldShowLoading;
      onLoadingChangeRef.current?.(shouldShowLoading);
    }
  }, [activeTab, isLoading]);

  // Инкремент с защитой от race conditions
  const incrementLoadCount = useCallback(() => {
    setLoadedCount(prev => {
      const currentLength = imagesLengthRef.current;
      // Не увеличиваем счётчик, если уже достигли лимита
      return prev < currentLength ? prev + 1 : prev;
    });
  }, []);

  const resetLoadCount = useCallback(() => {
    setLoadedCount(0);
  }, []);

  return { 
    galleryLoaded: isLoaded,
    isLoading,
    loadedCount,
    incrementLoadCount, 
    resetLoadCount 
  };
}
