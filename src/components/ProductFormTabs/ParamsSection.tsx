import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ParametersDataTable from '@/components/products/ParametersDataTable'
import { Settings } from 'lucide-react'
import type { ProductParam } from './types'

type ParamForm = {
  name: string
  value: string
  paramid?: string
  valueid?: string
  template_attribute_id?: number
  attribute_type?: string
  value_options?: ProductParam["value_options"]
}

type Props = {
  t: (k: string) => string
  readOnly?: boolean
  forceParamsEditable?: boolean
  parameters: ProductParam[]
  templates: Array<{ id: number; name: string }>
  templatesLoading: boolean
  selectedTemplateId: string
  onTemplateChange: (id: string) => void
  onApplyTemplate: () => void
  applyingTemplate: boolean
  onEditRow: (index: number) => void
  onDeleteRow: (index: number) => void
  onDeleteSelected: (indexes: number[]) => void
  onSelectionChange: (rows: number[]) => void
  onAddParam: () => void
  onReplaceData: (rows: ProductParam[]) => void
  onValueChange: (rowIndex: number, value: string, valueid?: string | null) => void
  isParamModalOpen: boolean
  setIsParamModalOpen: (open: boolean) => void
  paramForm: ParamForm
  setParamForm: React.Dispatch<React.SetStateAction<ParamForm>>
  saveParamModal: () => void
  editingParamIndex: number | null
}

export default function ParamsSection(props: Props) {
  const valueOptions = props.paramForm.value_options || []
  const hasValueOptions = valueOptions.length > 0
  const currentValue = hasValueOptions
    ? (valueOptions.find((o) => o.value === props.paramForm.value)?.value || valueOptions[0]?.value || '')
    : props.paramForm.value
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{props.t('product_characteristics')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.readOnly && !props.forceParamsEditable ? null : (
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 min-w-0 space-y-2">
                <Label>{props.t('template_select_label')}</Label>
                <Select
                  value={props.selectedTemplateId}
                  onValueChange={props.onTemplateChange}
                  disabled={props.templatesLoading || props.templates.length === 0}
                >
                  <SelectTrigger data-testid="productForm_params_templateSelect">
                    <SelectValue placeholder={props.t('template_select_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {props.templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={String(tpl.id)}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={props.onApplyTemplate}
                disabled={!props.selectedTemplateId || props.templatesLoading || props.templates.length === 0 || props.applyingTemplate}
                aria-disabled={!props.selectedTemplateId || props.templatesLoading || props.templates.length === 0 || props.applyingTemplate}
                data-testid="productForm_params_applyTemplate"
              >
                {props.applyingTemplate ? props.t('applying_template') : props.t('apply_template')}
              </Button>
            </div>
            {props.templates.length === 0 && !props.templatesLoading ? (
              <div className="text-xs text-muted-foreground">{props.t('template_empty_for_category')}</div>
            ) : null}
          </div>
        )}
        {props.readOnly && !props.forceParamsEditable ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {props.parameters.map((p) => (
              <div key={`${p.name}_${p.order_index}`} className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">{p.name}</div>
                <div className="text-sm break-words">{p.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <ParametersDataTable
            data={props.parameters}
            onEditRow={props.onEditRow}
            onDeleteRow={props.onDeleteRow}
            onDeleteSelected={props.onDeleteSelected}
            onSelectionChange={props.onSelectionChange}
            onAddParam={props.onAddParam}
            onReplaceData={props.onReplaceData}
            onValueChange={props.onValueChange}
          />
        )}

        {props.readOnly && !props.forceParamsEditable ? null : (
          <Dialog open={props.isParamModalOpen} onOpenChange={props.setIsParamModalOpen}>
            <DialogContent data-testid="productForm_paramModal">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  {props.editingParamIndex === null ? props.t('add_characteristic') : props.t('edit_characteristic')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {props.editingParamIndex === null ? props.t('add_characteristic') : props.t('edit_characteristic')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="param-name-modal">{props.t('characteristic_name')}</Label>
                  <Input id="param-name-modal" value={props.paramForm.name} onChange={(e) => props.setParamForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={props.t('characteristic_name_placeholder')} data-testid="productForm_modal_paramName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-value-modal">{props.t('value')}</Label>
                  {hasValueOptions ? (
                    <Select
                      value={currentValue}
                      onValueChange={(value) => {
                        const option = valueOptions.find((o) => o.value === value)
                        props.setParamForm((prev) => ({
                          ...prev,
                          value: option?.value || value,
                          valueid: option?.valueid || prev.valueid || '',
                        }))
                      }}
                    >
                      <SelectTrigger id="param-value-modal" data-testid="productForm_modal_paramValueSelect">
                        <SelectValue placeholder={props.t('characteristic_value_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {valueOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.value}>
                            {opt.display_value || opt.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="param-value-modal"
                      value={props.paramForm.value}
                      onChange={(e) => props.setParamForm((prev) => ({ ...prev, value: e.target.value }))}
                      placeholder={props.t('characteristic_value_placeholder')}
                      data-testid="productForm_modal_paramValue"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-paramid-modal">{props.t('param_id_optional')}</Label>
                  <Input id="param-paramid-modal" value={props.paramForm.paramid || ''} onChange={(e) => props.setParamForm((prev) => ({ ...prev, paramid: e.target.value }))} placeholder={props.t('param_id_placeholder')} data-testid="productForm_modal_paramId" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-valueid-modal">{props.t('value_id_optional')}</Label>
                  <Input id="param-valueid-modal" value={props.paramForm.valueid || ''} onChange={(e) => props.setParamForm((prev) => ({ ...prev, valueid: e.target.value }))} placeholder={props.t('value_id_placeholder')} data-testid="productForm_modal_valueId" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => props.setIsParamModalOpen(false)} data-testid="productForm_modal_cancel">
                  {props.t('btn_cancel')}
                </Button>
                <Button type="button" onClick={props.saveParamModal} data-testid="productForm_modal_save">
                  {props.editingParamIndex === null ? props.t('add_characteristic') : props.t('btn_update')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
