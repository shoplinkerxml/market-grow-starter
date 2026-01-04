import React from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Image as ImageIcon, Settings } from 'lucide-react'

type Props = {
  t: (k: string) => string
  tabsOverflow: boolean
  tabsScrollRef: React.MutableRefObject<HTMLDivElement | null>
}

export default function TabsHeader({ t, tabsOverflow, tabsScrollRef }: Props) {
  return (
    <div className="relative" data-testid="productFormTabs_tabsWrapper">
      {tabsOverflow && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 h-full w-6 md:hidden bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-6 md:hidden bg-gradient-to-l from-background to-transparent" />
        </>
      )}
      <TabsList
        ref={tabsScrollRef as any}
        className="flex w-full gap-2 h-9 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-nowrap scroll-smooth snap-x snap-mandatory md:snap-none no-scrollbar md:px-0 bg-transparent p-0 text-foreground rounded-none border-b border-border md:border-0 justify-start"
        data-testid="productFormTabs_tabsList"
      >
        <TabsTrigger
          value="info"
          className="shrink-0 md:shrink snap-start md:snap-none w-auto truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors"
          data-testid="productFormTabs_infoTab"
        >
          <Package className="h-4 w-4" />
          {t('product_tab_main')}
        </TabsTrigger>
        <TabsTrigger
          value="images"
          className="shrink-0 md:shrink snap-start md:snap-none w-auto truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors"
          data-testid="productFormTabs_imagesTab"
        >
          <ImageIcon className="h-4 w-4" />
          {t('product_tab_images')}
        </TabsTrigger>
        <TabsTrigger
          value="params"
          className="shrink-0 md:shrink snap-start md:snap-none w-auto truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors"
          data-testid="productFormTabs_paramsTab"
        >
          <Settings className="h-4 w-4" />
          {t('product_tab_parameters')}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}

