import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ChevronDown } from 'lucide-react'
import type { CurrencyOption, PriceData, FormData } from './types'

type Props = {
  t: (k: string) => string
  readOnly?: boolean
  editableKeys?: Array<'price' | 'price_old' | 'price_promo' | 'stock_quantity' | 'available'>
  currencies: CurrencyOption[]
  priceData: PriceData
  setPriceData: React.Dispatch<React.SetStateAction<PriceData>>
  onChange?: (partial: Partial<FormData>) => void
}

const PricesSection = React.memo(function PricesSection({ t, readOnly, editableKeys, currencies, priceData, setPriceData, onChange }: Props) {
  return (
    <div className="space-y-4 px-2 sm:px-3">
      <Collapsible defaultOpen>
        <div className="flex items-center gap-2 h-9">
          <h3 className="text-sm font-semibold leading-none">{t('category_prices')}</h3>
          <Separator className="flex-1" />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('toggle_section')}
              aria-controls="pricesSectionContent"
              data-testid="productFormTabs_pricesToggle"
              className="h-7 w-7 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent id="pricesSectionContent">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span id="currency_label" className="text-sm font-medium leading-none peer-disabled:opacity-70" data-testid="productFormTabs_currencyText">{t('currency')} *</span>
              <Select value={priceData.currency_code} onValueChange={value => setPriceData(prev => ({ ...prev, currency_code: value }))}>
                <SelectTrigger aria-labelledby="currency_label" data-testid="productFormTabs_currencySelect" disabled={!!readOnly}>
                  <SelectValue placeholder={t('select_currency')} />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name} ({currency.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">{t('price')} *</Label>
              <Input id="price" name="price" autoComplete="off" type="number" step="0.01" value={priceData.price} onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setPriceData(prev => ({ ...prev, price: v }));
                onChange?.({ price: v });
              }} placeholder={t('price_placeholder')} data-testid="productFormTabs_priceInput" disabled={!!readOnly && !(editableKeys || []).includes('price')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_old">{t('old_price')}</Label>
              <Input id="price_old" name="price_old" autoComplete="off" type="number" step="0.01" value={priceData.price_old} onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setPriceData(prev => ({ ...prev, price_old: v }));
                onChange?.({ price_old: v });
              }} placeholder={t('price_placeholder')} data-testid="productFormTabs_priceOldInput" disabled={!!readOnly && !(editableKeys || []).includes('price_old')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_promo">{t('promo_price')}</Label>
              <Input id="price_promo" name="price_promo" autoComplete="off" type="number" step="0.01" value={priceData.price_promo} onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setPriceData(prev => ({ ...prev, price_promo: v }));
                onChange?.({ price_promo: v });
              }} placeholder={t('price_placeholder')} data-testid="productFormTabs_pricePromoInput" disabled={!!readOnly && !(editableKeys || []).includes('price_promo')} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
})

export default PricesSection
