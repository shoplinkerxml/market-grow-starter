import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ParametersDataTable from '@/components/products/ParametersDataTable'
import { Settings, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
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
  onNameChange: (rowIndex: number, value: string) => void
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
  const resolveDisplayValue = React.useCallback((param: ProductParam) => {
    const options = param.value_options || []
    const matched = options.find((o) => o.value === param.value || (!!param.valueid && o.valueid === param.valueid))
    if (matched?.display_value || matched?.value) {
      return matched.display_value || matched.value
    }
    if (param.unit) {
      const base = String(param.value || '').trim()
      if (base) return `${base} ${param.unit}`
    }
    return param.value
  }, [])
  const isValidParamText = React.useCallback((value: string) => {
    const v = String(value ?? "")
    if (!v) return true
    if (v.trim().startsWith("-")) return false
    return /^[\p{L}\p{N}\s.,:;()\-+/%&_'"#]+$/u.test(v)
  }, [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{props.t('product_characteristics')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.readOnly && !props.forceParamsEditable ? null : (
          <>
            {props.templates.length === 0 && !props.templatesLoading ? (
              <div className="text-xs text-muted-foreground mb-2">{props.t('template_empty_for_category')}</div>
            ) : null}
          </>
        )}
        {props.readOnly && !props.forceParamsEditable ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {props.parameters.map((p) => (
              <div key={`${p.name}_${p.order_index}`} className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">{p.name}</div>
                <div className="text-sm break-words">{resolveDisplayValue(p)}</div>
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
            toolbarLeft={
              props.readOnly && !props.forceParamsEditable ? null : (
                <>
                  <Label className="sr-only">{props.t('template_select_label')}</Label>
                  <Select
                    value={props.selectedTemplateId}
                    onValueChange={props.onTemplateChange}
                    disabled={props.templatesLoading || props.templates.length === 0}
                  >
                    <SelectTrigger className="w-[clamp(11.2rem,22.4vw,18.2rem)] max-w-full" data-testid="productForm_params_templateSelect">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={props.onApplyTemplate}
                    disabled={!props.selectedTemplateId || props.templatesLoading || props.templates.length === 0 || props.applyingTemplate}
                    aria-disabled={!props.selectedTemplateId || props.templatesLoading || props.templates.length === 0 || props.applyingTemplate}
                    data-testid="productForm_params_applyTemplate"
                  >
                    <Wand2 className="h-4 w-4" />
                    {props.applyingTemplate ? props.t('applying_template') : props.t('apply_template')}
                  </Button>
                </>
              )
            }
            onReplaceData={props.onReplaceData}
            onValueChange={props.onValueChange}
            onNameChange={props.onNameChange}
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
                  <Input
                    id="param-name-modal"
                    value={props.paramForm.name}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!isValidParamText(v)) {
                        toast.error(props.t('invalid_characteristic_name'))
                        return
                      }
                      props.setParamForm((prev) => ({ ...prev, name: v }))
                    }}
                    placeholder={props.t('characteristic_name_placeholder')}
                    data-testid="productForm_modal_paramName"
                  />
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
                      <SelectTrigger id="param-value-modal" data-testid="productForm_modal_paramValueSelect" className="h-9 pl-3 pr-8">
                        <SelectValue placeholder={props.t('characteristic_value_placeholder')} />
                      </SelectTrigger>
                      <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]">
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
                      onChange={(e) => {
                        const v = e.target.value
                        if (!isValidParamText(v)) {
                          toast.error(props.t('invalid_characteristic_value'))
                          return
                        }
                        props.setParamForm((prev) => ({ ...prev, value: v }))
                      }}
                      placeholder={props.t('characteristic_value_placeholder')}
                      data-testid="productForm_modal_paramValue"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-paramid-modal">{props.t('param_id_optional')}</Label>
                  <Input
                    id="param-paramid-modal"
                    value={props.paramForm.paramid || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!isValidParamText(v)) {
                        toast.error(props.t('invalid_characteristic_name'))
                        return
                      }
                      props.setParamForm((prev) => ({ ...prev, paramid: v }))
                    }}
                    placeholder={props.t('param_id_placeholder')}
                    data-testid="productForm_modal_paramId"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="param-valueid-modal">{props.t('value_id_optional')}</Label>
                  <Input
                    id="param-valueid-modal"
                    value={props.paramForm.valueid || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!isValidParamText(v)) {
                        toast.error(props.t('invalid_characteristic_value'))
                        return
                      }
                      props.setParamForm((prev) => ({ ...prev, valueid: v }))
                    }}
                    placeholder={props.t('value_id_placeholder')}
                    data-testid="productForm_modal_valueId"
                  />
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
