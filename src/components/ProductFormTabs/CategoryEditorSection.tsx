import React from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ChevronDown } from 'lucide-react'
import { CategoryTreeEditor } from '@/components/CategoryTreeEditor'
import type { SupplierOption, CategoryOption, BasicData } from './types'

type Props = {
  t: (k: string) => string
  suppliers: SupplierOption[]
  categories: CategoryOption[]
  setCategories: React.Dispatch<React.SetStateAction<CategoryOption[]>>
  preloadedSupplierCategoriesMap?: Record<string, CategoryOption[]>
  basicData: BasicData
  setBasicData: React.Dispatch<React.SetStateAction<BasicData>>
  defaultOpen?: boolean
}

export default function CategoryEditorSection({ t, suppliers, categories, setCategories, preloadedSupplierCategoriesMap, basicData, setBasicData, defaultOpen = true }: Props) {
  return (
    <div className="space-y-4 mt-2 w-full px-2 sm:px-3" data-testid="productFormTabs_categoryTreeEditorFullWidth">
      <Collapsible defaultOpen={defaultOpen}>
        <div className="flex items-center gap-2 h-9">
          <h3 className="text-sm font-semibold leading-none">{t('category_editor_title')}</h3>
          <Separator className="flex-1" />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('toggle_section')}
              aria-controls="categoryEditorContent"
              data-testid="productFormTabs_categoryEditorToggle"
              className="h-7 w-7 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent id="categoryEditorContent">
          <CategoryTreeEditor
            suppliers={suppliers}
            stores={[]}
            categories={categories}
            supplierCategoriesMap={preloadedSupplierCategoriesMap as any}
            defaultSupplierId={basicData.supplier_id}
            showStoreSelect={false}
            onSupplierChange={id => setBasicData(prev => ({ ...prev, supplier_id: id }))}
            onCategoryCreated={async cat => {
              setCategories(prev => {
                const exists = prev?.some(c => String(c.external_id) === String(cat.external_id));
                if (exists) return prev;
                const next = [...(prev || []), {
                  id: String(cat.external_id || `${Date.now()}`),
                  name: cat.name || '',
                  external_id: String(cat.external_id || ''),
                  supplier_id: String(basicData.supplier_id || ''),
                  parent_external_id: cat.parent_external_id == null ? null : String(cat.parent_external_id)
                }];
                return next;
              });
            }}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
