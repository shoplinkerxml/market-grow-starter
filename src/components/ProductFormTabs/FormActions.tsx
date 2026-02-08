import React from 'react'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

type Props = {
  t: (k: string) => string
  readOnly?: boolean
  loading?: boolean
  product?: unknown | null
  onCancel?: () => void
  onSubmit: () => void
  disabledSubmit: boolean
}

export default function FormActions({ t, readOnly, loading, product, onCancel, onSubmit, disabledSubmit }: Props) {
  if (readOnly) return null
  return (
    <div className="mt-4 sm:mt-6 pt-1 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel} data-testid="productFormTabs_cancelButton">
          <X className="h-4 w-4" />
          {t('btn_cancel')}
        </Button>
      ) : null}
      <Button onClick={onSubmit} disabled={disabledSubmit} data-testid="productFormTabs_submitButton">
        <Save className="h-4 w-4" />
        {loading
          ? (product ? t('loading_updating') : t('loading_creating'))
          : (product ? t('product_btn_update') : t('product_btn_create'))}
      </Button>
    </div>
  )
}
