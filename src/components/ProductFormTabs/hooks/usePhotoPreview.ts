import React from 'react'

export function usePhotoPreview(activeImageIndex: number) {
  const DEFAULT_PHOTO_SIZE_REM = 31.25
  const [photoBlockScale, setPhotoBlockScale] = React.useState(1)
  const [photoBlockInitialRem, setPhotoBlockInitialRem] = React.useState<number | null>(null)
  const [isLargeScreen, setIsLargeScreen] = React.useState<boolean>(false)
  const photoBlockRef = React.useRef<HTMLDivElement | null>(null)
  const photoBlockInitialRemRef = React.useRef<number | null>(null)
  const initialViewportWidthRef = React.useRef<number | null>(null)
  const [viewportWidth, setViewportWidth] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0)
  const isPhotoResizingRef = React.useRef(false)
  const startXRef = React.useRef(0)
  const startScaleRef = React.useRef(1)
  const startWidthPxRef = React.useRef(0)

  const clampScale = React.useCallback((value: number) => {
    const MIN_SCALE = 0.5
    if (value < MIN_SCALE) return MIN_SCALE
    if (value > 1) return 1
    return value
  }, [])

  const resetPhotoBlockToDefaultSize = React.useCallback(() => {
    const initialRem = photoBlockInitialRemRef.current
    if (!initialRem) return
    const desiredScale = DEFAULT_PHOTO_SIZE_REM / initialRem
    setPhotoBlockScale(clampScale(desiredScale))
  }, [clampScale])

  const handlePhotoResizeMove = React.useCallback((e: MouseEvent) => {
    if (!isPhotoResizingRef.current) return
    const dx = e.clientX - startXRef.current
    const denom = Math.max(startWidthPxRef.current, 1)
    const deltaRatio = dx / denom
    const next = clampScale(startScaleRef.current + deltaRatio)
    setPhotoBlockScale(next)
  }, [clampScale])

  const handlePhotoResizeEnd = React.useCallback(() => {
    if (!isPhotoResizingRef.current) return
    isPhotoResizingRef.current = false
    document.removeEventListener('mousemove', handlePhotoResizeMove)
    document.removeEventListener('mouseup', handlePhotoResizeEnd)
  }, [handlePhotoResizeMove])

  const handlePhotoResizeStart = React.useCallback((e: React.MouseEvent) => {
    if (!photoBlockRef.current) return
    e.preventDefault()
    e.stopPropagation()
    isPhotoResizingRef.current = true
    startXRef.current = (e as React.MouseEvent).clientX
    startScaleRef.current = photoBlockScale
    startWidthPxRef.current = photoBlockRef.current.offsetWidth
    document.addEventListener('mousemove', handlePhotoResizeMove)
    document.addEventListener('mouseup', handlePhotoResizeEnd)
  }, [handlePhotoResizeMove, handlePhotoResizeEnd, photoBlockScale])

  React.useEffect(() => {
    const measure = () => {
      if (!photoBlockRef.current) return
      const px = photoBlockRef.current.offsetWidth
      const rem = px / 16
      if (photoBlockInitialRemRef.current == null) {
        photoBlockInitialRemRef.current = rem
        setPhotoBlockInitialRem(rem)
        const desiredScale = DEFAULT_PHOTO_SIZE_REM / rem
        setPhotoBlockScale(clampScale(desiredScale))
      }
      if (initialViewportWidthRef.current == null) {
        initialViewportWidthRef.current = window.innerWidth
        setViewportWidth(window.innerWidth)
      }
    }
    measure()
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      const matches = 'matches' in e ? e.matches : (e as MediaQueryList).matches
      setIsLargeScreen(matches)
    }
    handler(mq)
    mq.addEventListener('change', handler as any)
    const onResize = () => {
      setViewportWidth(window.innerWidth)
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      mq.removeEventListener('change', handler as any)
    }
  }, [clampScale])

  React.useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handlePhotoResizeMove)
      document.removeEventListener('mouseup', handlePhotoResizeEnd)
    }
  }, [handlePhotoResizeMove, handlePhotoResizeEnd])

  const galleryImgRefs = React.useRef<Array<HTMLImageElement | null>>([])
  React.useEffect(() => {
    const el = galleryImgRefs.current[activeImageIndex]
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      } catch {}
    }
  }, [activeImageIndex])

  const BASE_VIEWPORT_PX = 1280
  const getAdaptiveImageStyle = () => {
    const baseRem = photoBlockInitialRem ?? DEFAULT_PHOTO_SIZE_REM
    const minRem = Math.max(baseRem * 0.5, 12)
    // Пропорциональное уменьшение относительно базовой ширины экрана
    const vwScale = Math.min(1, viewportWidth / BASE_VIEWPORT_PX)
    let sizeRem = Math.max(baseRem * photoBlockScale * vwScale, minRem)
    if (typeof window !== 'undefined') {
      const envWidthPx = window.innerWidth
      const padPx = Math.max(8, Math.min(16, envWidthPx * 0.02))
      const vwRem = (envWidthPx - padPx) / 16
      if (vwRem > 0) sizeRem = Math.min(sizeRem, vwRem)
    }
    return { width: `${sizeRem}rem`, height: `${sizeRem}rem` }
  }

  const getThumbSizeRem = (large: boolean) => {
    const base = large ? 5 : 4
    const vwScale = Math.min(1, viewportWidth / BASE_VIEWPORT_PX)
    const size = Math.max(base * vwScale, 3)
    return size
  }

  return {
    photoBlockRef,
    isLargeScreen,
    getAdaptiveImageStyle,
    getThumbSizeRem,
    handlePhotoResizeStart,
    resetPhotoBlockToDefaultSize,
    galleryImgRefs,
  }
}
