import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Globe, ChevronDown } from 'lucide-react'
import type { BasicData } from './types'

type Props = {
  t: (k: string) => string
  data: BasicData
  onChange: (partial: Partial<BasicData>) => void
  readOnly?: boolean
}

const NamesDescriptionSection = React.memo(function NamesDescriptionSection({ t, data, onChange, readOnly }: Props) {
  return (
    <div className="space-y-[0.5rem] overflow-y-auto" data-testid="productFormTabs_namesDescriptionRight">
      <Collapsible defaultOpen>
        <div className="flex items-center gap-2 h-9">
          <h3 className="text-sm font-semibold leading-none">{t('product_names_description')}</h3>
          <Separator className="flex-1" />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('toggle_section')}
              aria-controls="namesDescContent"
              data-testid="productFormTabs_namesDescToggle"
              className="h-7 w-7 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent id="namesDescContent">
          <Tabs defaultValue="ukrainian" className="w-full">
            <TabsList className="items-center flex w-full gap-2 h-9 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-nowrap scroll-smooth snap-x snap-mandatory md:snap-none no-scrollbar md:px-0 bg-transparent p-0 text-foreground rounded-none border-b border-border md:border-0 justify-start" data-testid="productFormTabs_langTabsList">
              <TabsTrigger value="ukrainian" className="shrink-0 md:shrink snap-start md:snap-none w-auto truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors" data-testid="productFormTabs_ukrainianTab" aria-label={t('product_name_ukrainian_tab')}>
                <span className="truncate">{t('product_name')}</span>
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-success/10 text-success text-[0.7rem] font-semibold">UA</span>
                <span className="sr-only">UA</span>
              </TabsTrigger>
              <TabsTrigger value="russian" className="shrink-0 md:shrink snap-start md:snap-none w-auto truncate leading-tight text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-2 justify-start md:justify-start rounded-none border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary transition-colors" data-testid="productFormTabs_russianTab" aria-label={t('product_name_russian_tab')}>
                <span className="truncate">{t('product_name')}</span>
                <Globe aria-hidden="true" className="inline-block h-[0.9rem] w-[0.9rem] text-success" />
                <span className="sr-only">RU</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ukrainian" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name_ua">{t('product_name')} *</Label>
                <Textarea id="name_ua" name="name_ua" autoComplete="off" value={data.name_ua || data.name} onChange={e => onChange({ name_ua: e.target.value })} placeholder={t('product_name_placeholder')} rows={3} data-testid="productFormTabs_nameUaInput" disabled={!!readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docket_ua">{t('short_name')}</Label>
                <Textarea id="docket_ua" name="docket_ua" autoComplete="off" value={data.docket_ua || data.docket} onChange={e => onChange({ docket_ua: e.target.value })} placeholder={t('short_name_placeholder')} rows={2} data-testid="productFormTabs_docketUaInput" disabled={!!readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description_ua">{t('product_description')}</Label>
                <Textarea id="description_ua" name="description_ua" autoComplete="off" value={data.description_ua || data.description} onChange={e => onChange({ description_ua: e.target.value })} placeholder={t('product_description_placeholder')} rows={3} data-testid="productFormTabs_descriptionUaInput" disabled={!!readOnly} />
              </div>
            </TabsContent>
            <TabsContent value="russian" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('product_name')}</Label>
                <Textarea id="name" name="name" autoComplete="off" value={data.name || data.name_ua} onChange={e => onChange({ name: e.target.value })} placeholder={t('product_name_placeholder')} rows={3} data-testid="productFormTabs_nameInput" disabled={!!readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docket">{t('short_name')}</Label>
                <Textarea id="docket" name="docket" autoComplete="off" value={data.docket || data.docket_ua} onChange={e => onChange({ docket: e.target.value })} placeholder={t('short_name_placeholder')} rows={2} data-testid="productFormTabs_docketInput" disabled={!!readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('product_description')}</Label>
                <Textarea id="description" name="description" autoComplete="off" value={data.description || data.description_ua} onChange={e => onChange({ description: e.target.value })} placeholder={t('product_description_placeholder')} rows={3} data-testid="productFormTabs_descriptionInput" disabled={!!readOnly} />
              </div>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
})

export default NamesDescriptionSection
