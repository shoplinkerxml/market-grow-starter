import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ChevronDown } from 'lucide-react'
import type { CategoryOption, BasicData, StockData, FormData } from './types'

type Props = {
  t: (k: string) => string
  basicData: BasicData
  setBasicData: React.Dispatch<React.SetStateAction<BasicData>>
  stockData: StockData
  setStockData: React.Dispatch<React.SetStateAction<StockData>>
  readOnly?: boolean
  editableKeys?: Array<'price' | 'price_old' | 'price_promo' | 'stock_quantity' | 'available'>
  categories: CategoryOption[]
  selectedCategoryName: string
  onChange?: (partial: Partial<FormData>) => void
}

const BasicSection = React.memo(function BasicSection({ t, basicData, setBasicData, stockData, setStockData, readOnly, editableKeys, categories, selectedCategoryName, onChange }: Props) {
  return (
    <div className="space-y-4 px-2 sm:px-3" data-testid="productFormTabs_basicSection">
      <Collapsible defaultOpen>
        <div className="flex items-center gap-2 h-9">
          <h3 className="text-sm font-semibold leading-none">{t('product_main_data')}</h3>
          <Separator className="flex-1" />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('toggle_section')}
              aria-controls="basicSectionContent"
              data-testid="productFormTabs_basicToggle"
              className="h-7 w-7 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent id="basicSectionContent">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="external_id">{t('external_id')}</Label>
              <Input id="external_id" name="external_id" autoComplete="off" value={basicData.external_id} onChange={e => setBasicData(prev => ({ ...prev, external_id: e.target.value }))} placeholder={t('external_id_placeholder')} data-testid="productFormTabs_externalIdInput" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="article">{t('article')}</Label>
              <Input id="article" name="article" autoComplete="off" value={basicData.article} onChange={e => setBasicData(prev => ({ ...prev, article: e.target.value }))} placeholder={t('article_placeholder')} data-testid="productFormTabs_articleInput" />
            </div>

            <div className="space-y-2">
              <span id="category_label" className="text-sm font-medium leading-none peer-disabled:opacity-70" data-testid="productFormTabs_categoryText">{t('category')} *</span>
              <Select value={basicData.category_id} onValueChange={value => {
                const cat = categories.find(c => String(c.id) === String(value));
                setBasicData(prev => ({
                  ...prev,
                  category_id: value,
                  category_external_id: cat?.external_id || '',
                  category_name: cat?.name || ''
                }));
                onChange?.({
                  category_id: value,
                  category_external_id: cat?.external_id || '',
                  category_name: cat?.name || ''
                });
              }}>
                <SelectTrigger aria-labelledby="category_label" data-testid="productFormTabs_categorySelect">
                  <SelectValue placeholder={selectedCategoryName || t('select_category')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">{t('manufacturer')}</Label>
              <Input id="vendor" name="vendor" autoComplete="organization" value={basicData.vendor} onChange={e => setBasicData(prev => ({ ...prev, vendor: e.target.value }))} placeholder={t('manufacturer_placeholder')} data-testid="productFormTabs_vendorInput" disabled={!!readOnly} />
            </div>

            <div className="space-y-2">
              <span id="state_label" className="text-sm font-medium leading-none peer-disabled:opacity-70" data-testid="productFormTabs_stateText">{t('product_status')}</span>
              <Select value={basicData.state} onValueChange={value => setBasicData(prev => ({ ...prev, state: value }))}>
                <SelectTrigger aria-labelledby="state_label" data-testid="productFormTabs_stateSelect" disabled={!!readOnly}>
                  <SelectValue placeholder={t('select_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t('status_new')}</SelectItem>
                  <SelectItem value="stock">{t('status_stock')}</SelectItem>
                  <SelectItem value="used">{t('status_used')}</SelectItem>
                  <SelectItem value="refurbished">{t('status_refurbished')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_quantity">{t('stock_quantity')}</Label>
              <Input id="stock_quantity" name="stock_quantity" autoComplete="off" type="number" value={stockData.stock_quantity} onChange={e => {
                const v = parseInt(e.target.value) || 0;
                setStockData(prev => ({ ...prev, stock_quantity: v }));
                onChange?.({ stock_quantity: v });
              }} placeholder={t('stock_quantity_placeholder')} data-testid="productFormTabs_stockInput" disabled={!!readOnly && !(editableKeys || []).includes('stock_quantity')} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="available"
                checked={!!stockData.available}
                onChange={(e) => {
                  const val = !!e.target.checked;
                  setStockData(prev => ({ ...prev, available: val }));
                  onChange?.({ available: val });
                }}
                className="rounded border-gray-300 accent-emerald-600"
                data-testid="productFormTabs_available"
                disabled={!!readOnly && !(editableKeys || []).includes('available')}
              />
              <Label htmlFor="available">{t('product_available')}</Label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
})

export default BasicSection
