import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Image as ImageIcon, Check, X, Link as LinkIcon, Loader2, ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { useI18n } from "@/i18n";
import { getImageUrl, IMAGE_SIZES, isVideoUrl } from '@/lib/imageUtils'
import { useResolvedImageSrc } from '@/hooks/useProductImages'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProductImage } from './types'

type Props = {
  images: ProductImage[]
  readOnly?: boolean
  isDragOver: boolean
  uploading?: boolean
  uploadProgress?: number | null
  imageUrl: string
  onSetImageUrl: (v: string) => void
  onAddImageFromUrl: () => void
  onRemoveImage: (index: number) => void
  onSetMainImage: (index: number) => void
  onReorderImages?: (images: ProductImage[]) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDropZoneClick: () => void
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  getGalleryAdaptiveImageStyle: (index: number) => React.CSSProperties
  getMainAdaptiveImageStyle: () => React.CSSProperties
  galleryImgRefs: React.MutableRefObject<Array<HTMLImageElement | null>>
  onGalleryImageLoad: (e: React.SyntheticEvent<HTMLImageElement>, index: number) => void
  onGalleryImageError: (e: React.SyntheticEvent<HTMLImageElement>, index: number) => void
  onGalleryVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>, index: number) => void
  activeIndex: number
  onSelectIndex: (index: number) => void
  onMainImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onMainImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onMainVideoLoaded: (e: React.SyntheticEvent<HTMLVideoElement>) => void
  onPrev: () => void
  onNext: () => void
}

export function ImageSection(props: Props) {
  const { t } = useI18n()
  const activeImage = props.images[props.activeIndex]
  const activeUrl = activeImage?.url || ''
  const activeIsVideo = isVideoUrl(activeUrl)
  const { src: activeSrc, onError: onActiveError } = useResolvedImageSrc({
    url: activeUrl,
    objectKey: activeImage?.object_key,
    width: IMAGE_SIZES.LARGE,
    fallbackUrl: activeUrl,
  })
  const [isLarge, setIsLarge] = React.useState(false)
  const isVirtualThumbs = props.images.length > 50
  const thumbsParentRef = React.useRef<HTMLDivElement>(null)
  const thumbsVirtualizer = useVirtualizer({
    count: props.images.length,
    getScrollElement: () => thumbsParentRef.current,
    estimateSize: () => (isLarge ? 80 : 64) + 8,
    horizontal: true,
    overscan: 6,
  })
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const h = (e: MediaQueryListEvent | MediaQueryList) => {
      const matches = 'matches' in e ? e.matches : mq.matches
      setIsLarge(!!matches)
    }
    h(mq)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  React.useEffect(() => {
    if (isVirtualThumbs) {
      try {
        thumbsVirtualizer.scrollToIndex(props.activeIndex, { align: 'center' })
      } catch {}
      return
    }
    const el = props.galleryImgRefs.current[props.activeIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } catch {}
    }
  }, [isVirtualThumbs, props.activeIndex, props.galleryImgRefs, thumbsVirtualizer]);
  const getThumbFlexBasis = (count: number): string => {
    if (count <= 4) return '25%'
    if (count === 5) return '20%'
    if (count === 6) return '16.6667%'
    if (count === 7) return '14.2857%'
    return '12.5%'
  }

  const sensors = useSensors(useSensor(PointerSensor))

  const [reorderOpen, setReorderOpen] = React.useState(false)
  const [reorderList, setReorderList] = React.useState<ProductImage[]>([])

  function SortableThumb({ image, index }: { image: ProductImage; index: number }) {
    const id = String(image.object_key || image.url || index)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.8 : 1,
      cursor: 'grab',
    }
    const original = image.url
    const isVid = isVideoUrl(original)
    const { src, onError } = useResolvedImageSrc({ url: original, objectKey: image.object_key, width: IMAGE_SIZES.THUMB, fallbackUrl: original })
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <div className={`aspect-square relative overflow-hidden rounded-md bg-white ${index === props.activeIndex ? 'border-2 border-emerald-500' : ''}`}>
          {isVid ? (
            <video
              src={getImageUrl(original)}
              className="w-full h-full object-contain"
              preload="metadata"
              onLoadedMetadata={(e) => props.onGalleryVideoLoaded(e, index)}
            />
          ) : src ? (
            <img
              ref={(el) => {
                if (props.galleryImgRefs.current[index] !== el) {
                  props.galleryImgRefs.current[index] = el
                }
              }}
              src={src}
              loading="lazy"
              decoding="async"
              alt={image.alt_text || `Изображение ${index + 1}`}
              className="w-full h-full object-contain"
              onLoad={(e) => props.onGalleryImageLoad(e, index)}
              onError={(e) => {
                onError()
                props.onGalleryImageError(e, index)
              }}
            />
          ) : null}
        </div>
      </div>
    )
  }

  function Thumb({ image, index }: { image: ProductImage; index: number }) {
    const original = image.url
    const isVid = isVideoUrl(original)
    const { src, onError } = useResolvedImageSrc({ url: original, objectKey: image.object_key, width: IMAGE_SIZES.THUMB, fallbackUrl: original })
    return (
      <div>
        <div className={`aspect-square relative overflow-hidden rounded-md bg-white ${index === props.activeIndex ? 'border-2 border-emerald-500' : ''}`}>
          {isVid ? (
            <video src={getImageUrl(original)} className="w-full h-full object-contain" preload="metadata" onLoadedMetadata={(e) => props.onGalleryVideoLoaded(e, index)} />
          ) : src ? (
            <img
              ref={(el) => (props.galleryImgRefs.current[index] = el)}
              src={src}
              loading="lazy"
              decoding="async"
              alt={image.alt_text || `Изображение ${index + 1}`}
              className="w-full h-full object-contain"
              onLoad={(e) => props.onGalleryImageLoad(e, index)}
              onError={(e) => {
                onError()
                props.onGalleryImageError(e, index)
              }}
            />
          ) : null}
        </div>
      </div>
    )
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = props.images.map((im, idx) => String(im.object_key || im.url || idx))
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const moved = arrayMove(props.images, oldIndex, newIndex).map((img, i) => ({ ...img, order_index: i }))
    props.onReorderImages?.(moved)
  }

  function handleModalDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = reorderList.map((im, idx) => String(im.object_key || im.url || idx))
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setReorderList((prev) => arrayMove(prev, oldIndex, newIndex).map((img, i) => ({ ...img, order_index: i })))
  }

  function ModalSortableThumb({ image, index }: { image: ProductImage; index: number }) {
    const id = (image.object_key || image.url || index).toString()
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition }
    const original = image.url
    const isVid = isVideoUrl(original)
    const { src, onError } = useResolvedImageSrc({ url: original, objectKey: image.object_key, width: IMAGE_SIZES.THUMB, fallbackUrl: original })
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="aspect-square rounded-md overflow-hidden border">
        {isVid ? (
          <video src={getImageUrl(original)} className="w-full h-full object-contain" preload="metadata" />
        ) : src ? (
          <img
            src={src}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
            alt={image.alt_text || ''}
            onError={() => onError()}
          />
        ) : null}
      </div>
    )
  }
  return (
    <div className="relative space-y-3 md:space-y-4">
      <div className="mx-auto w-full space-y-3 md:space-y-4" style={{ maxWidth: `calc(${props.getMainAdaptiveImageStyle().width} + clamp(0.5rem, 2vw, 1rem))` }}>
      {props.images.length > 0 && (
        <div className="relative flex justify-center w-full">
          <Card className="relative group overflow-hidden border-0 shadow-none">
            <CardContent className="p-0">
              <div
                className="relative overflow-hidden rounded-md flex items-center justify-center aspect-square cursor-pointer p-0"
                style={props.getMainAdaptiveImageStyle()}
              >
                {activeIsVideo ? (
                  <video
                    src={getImageUrl(activeUrl)}
                    className="w-full h-full object-contain select-none"
                    controls
                    onLoadedMetadata={props.onMainVideoLoaded}
                  />
                ) : activeSrc ? (
                  <img
                    src={activeSrc}
                    alt={activeImage?.alt_text || `Фото ${props.activeIndex + 1}`}
                    className="w-full h-full object-contain select-none"
                    onLoad={props.onMainImageLoad}
                    onError={(e) => {
                      onActiveError()
                      props.onMainImageError(e)
                    }}
                  />
                ) : null}
              </div>
              {!props.readOnly && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                  {/* Белая (outline) - первая */}
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={t('reorder') || 'Змінити порядок'}
                    onClick={() => { setReorderList(props.images.slice()); setReorderOpen(true) }}
                    className="h-7 w-7 rounded-md"
                  >
                    <ListOrdered className="h-3 w-3" />
                  </Button>
                  {/* Зеленая (set main) - вторая */}
                  {props.images[props.activeIndex]?.is_main ? null : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => props.onSetMainImage(props.activeIndex)}
                      aria-label={t('set_as_main_photo')}
                      className="h-7 w-7 rounded-md bg-success text-primary-foreground hover:bg-success/90"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Красная (delete) - третья */}
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => props.onRemoveImage(props.activeIndex)}
                    className="h-7 w-7 rounded-md"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
            {props.images.length > 1 && (
              <>
                <Button variant="outline" size="icon" className="absolute top-1/2 -translate-y-1/2 rounded-full bg-transparent border border-border text-foreground hover:border-emerald-500 hover:text-emerald-600 active:scale-95 active:shadow-inner transition-colors" style={{ left: 'min(1.75%, 0.5rem)' }} onClick={props.onPrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="absolute top-1/2 -translate-y-1/2 rounded-full bg-transparent border border-border text-foreground hover:border-emerald-500 hover:text-emerald-600 active:scale-95 active:shadow-inner transition-colors" style={{ right: 'min(1.75%, 0.5rem)' }} onClick={props.onNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </Card>
        </div>
      )}
      {props.images.length > 0 && (
          <>
          <div className="relative w-full">
            {props.images.length > 50 ? (
              <div
                ref={thumbsParentRef}
                className="w-full overflow-x-auto overflow-y-hidden"
                style={{ height: isLarge ? 100 : 92 }}
              >
                <div
                  style={{
                    width: thumbsVirtualizer.getTotalSize(),
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  {thumbsVirtualizer.getVirtualItems().map((virtualItem) => {
                    const index = virtualItem.index
                    const image = props.images[index]
                    return (
                      <div
                        key={virtualItem.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          transform: `translateX(${virtualItem.start}px)`,
                          width: virtualItem.size,
                          height: '100%',
                        }}
                      >
                        <div className="h-full flex items-center pl-2">
                          <Card
                            className="relative group cursor-pointer transition-all border-0 shadow-none"
                            onClick={() => props.onSelectIndex(index)}
                            data-testid={`productFormTabs_imageCard_${index}`}
                          >
                            <CardContent className="p-2">
                              <Thumb image={image} index={index} />
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={props.images.map((im, idx) => String(im.object_key || im.url || idx))} strategy={horizontalListSortingStrategy}>
                  <Carousel className="w-full" opts={{ align: 'start', dragFree: true }}>
                    <CarouselContent className="-ml-2 mr-2">
                      {props.images.map((image, index) => (
                        <CarouselItem key={(image.object_key || image.url || index).toString()} className="pl-2" style={{ flex: `0 0 ${isLarge ? 5 : 4}rem` }}>
                          <Card className={`relative group cursor-pointer transition-all border-0 shadow-none`} onClick={() => props.onSelectIndex(index)} data-testid={`productFormTabs_imageCard_${index}`}>
                          <CardContent className="p-2">
                              <SortableThumb image={image} index={index} />
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <Dialog open={reorderOpen} onOpenChange={(o) => setReorderOpen(!!o)}>
            <DialogContent className="max-w-3xl sm:max-w-4xl p-3 sm:p-4 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto" overlayClassName="bg-black/50">
              <DialogHeader>
                <DialogTitle>{t('reorder') || 'Змінити порядок зображень'}</DialogTitle>
                <DialogDescription>{t('drag_to_reorder') || 'Перетягніть зображення, щоб змінити порядок. Максимум 15 фото.'}</DialogDescription>
              </DialogHeader>
              <DndContext sensors={sensors} onDragEnd={handleModalDragEnd}>
                <SortableContext items={reorderList.map((im, idx) => String(im.object_key || im.url || idx))} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                    {reorderList.slice(0, 15).map((image, index) => (
                      <ModalSortableThumb key={(image.object_key || image.url || index).toString()} image={image} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setReorderOpen(false)}>{t('cancel') || 'Скасувати'}</Button>
                <Button
                  onClick={() => {
                    props.onReorderImages?.(reorderList.map((img, i) => ({ ...img, order_index: i })))
                    setReorderOpen(false)
                  }}
                >
                  {t('save') || 'Зберегти'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
      )}
      </div>

      

      {props.readOnly ? null : (
        <Card className="relative group w-full" data-testid="productFormTabs_dropZone">
          <CardContent className="p-1 md:p-2">
            <div
              className={`relative overflow-hidden rounded-md flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${props.isDragOver ? 'bg-emerald-100 border-2 border-dashed border-emerald-300 shadow-sm' : 'bg-emerald-50 hover:bg-emerald-100 border-2 border-dashed border-emerald-200 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100'} hover:scale-[1.01]`}
              style={{ width: '100%', maxWidth: '100%', height: 'auto', minHeight: 'clamp(12rem, 30vh, 24rem)' }}
              onDragEnter={props.onDragEnter}
              onDragOver={props.onDragOver}
              onDragLeave={props.onDragLeave}
              onDrop={props.onDrop}
              onClick={props.onDropZoneClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  props.onDropZoneClick()
                }
              }}
            >
              <ImageIcon className={`h-12 w-12 mb-2 md:mb-3 transition-colors ${props.isDragOver ? 'text-emerald-600' : 'text-emerald-500'}`} />
              <p className={`text-sm text-center px-2 transition-colors ${props.isDragOver ? 'text-emerald-700 font-medium' : 'text-emerald-700'}`}>{props.isDragOver ? t('drop_image_here') : t('click_to_upload') || t('add_images_instruction')}</p>
              <p className="text-xs text-center text-muted-foreground mt-1 md:mt-2 px-3" data-testid="productFormTabs_fileInfo">
                {t('image_types_and_limit')}
              </p>
              {props.uploading ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="w-[min(22rem,90%)]">
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                      <span className="text-sm text-emerald-700">{t('uploading_image')}</span>
                      {typeof props.uploadProgress === 'number' ? (
                        <span className="text-sm text-emerald-700 tabular-nums">{props.uploadProgress}%</span>
                      ) : null}
                    </div>
                    {typeof props.uploadProgress === 'number' ? (
                      <div className="mt-2">
                        <Progress value={props.uploadProgress} className="h-2" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {props.readOnly ? null : (
        <input type="file" accept="image/*,.avif,image/avif" multiple onChange={props.onFileUpload} className="hidden" id="fileUpload" data-testid="productFormTabs_fileInput" />
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="flex-1">
          {props.readOnly ? null : (
            <>
              <Label htmlFor="imageUrl">{t('add_image_by_url')}</Label>
              <div className="flex gap-2 mt-2">
                <Input id="imageUrl" name="imageUrl" autoComplete="url" value={props.imageUrl} onChange={(e) => props.onSetImageUrl(e.target.value)} placeholder={t('image_url_placeholder')} data-testid="productFormTabs_imageUrlInput" />
                <Button onClick={props.onAddImageFromUrl} variant="outline" size="icon" data-testid="productFormTabs_addImageUrlButton">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageSection
