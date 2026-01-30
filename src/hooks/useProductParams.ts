import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ProductParam } from '@/components/ProductFormTabs/types';

function makeParamsKey(params: ProductParam[]): string {
  if (!Array.isArray(params) || params.length === 0) return '';
  return params
    .map((p) => {
      const id = (p as any)?.id != null ? String((p as any).id) : '';
      const order = (p as any)?.order_index != null ? String((p as any).order_index) : '';
      const name = (p as any)?.name != null ? String((p as any).name) : '';
      const value = (p as any)?.value != null ? String((p as any).value) : '';
      const paramid = (p as any)?.paramid != null ? String((p as any).paramid) : '';
      const valueid = (p as any)?.valueid != null ? String((p as any).valueid) : '';
      const templateId = (p as any)?.template_attribute_id != null ? String((p as any).template_attribute_id) : '';
      return `${id}\u241f${order}\u241f${name}\u241f${value}\u241f${paramid}\u241f${valueid}\u241f${templateId}`;
    })
    .join('\u241e');
}

export function useProductParams(preloadedParams?: ProductParam[], onChange?: (params: ProductParam[]) => void) {
  const dirtyRef = useRef(false);
  const initialIncoming = Array.isArray(preloadedParams) ? preloadedParams : [];
  const preloadedKeyRef = useRef<string>(makeParamsKey(initialIncoming));
  const [parameters, setParametersState] = useState<ProductParam[]>(() => (Array.isArray(preloadedParams) ? preloadedParams : []));
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<{
    name: string;
    value: string;
    paramid?: string;
    valueid?: string;
    template_attribute_id?: number;
    attribute_type?: string;
    value_options?: ProductParam["value_options"];
  }>({
    name: '',
    value: '',
    paramid: '',
    valueid: '',
    template_attribute_id: undefined,
    attribute_type: undefined,
    value_options: [],
  });
  const [selectedParamRows, setSelectedParamRows] = useState<number[]>([]);

  useEffect(() => {
    const incoming = Array.isArray(preloadedParams) ? preloadedParams : [];
    const nextKey = makeParamsKey(incoming);
    if (nextKey === preloadedKeyRef.current) return;
    preloadedKeyRef.current = nextKey;
    dirtyRef.current = false;
    setParametersState(incoming);
  }, [preloadedParams]);

  useEffect(() => {
    if (dirtyRef.current) return;
    const incoming = Array.isArray(preloadedParams) ? preloadedParams : [];
    if (incoming.length === 0) return;
    if (parameters.length === 0) {
      setParametersState(incoming);
    }
  }, [parameters.length, preloadedParams]);

  const setParameters = useCallback<Dispatch<SetStateAction<ProductParam[]>>>((next) => {
    dirtyRef.current = true;
    setParametersState(next);
  }, []);

  const openAddParamModal = useCallback(() => {
    setEditingParamIndex(null);
    setParamForm({
      name: '',
      value: '',
      paramid: '',
      valueid: '',
      template_attribute_id: undefined,
      attribute_type: undefined,
      value_options: [],
    });
    setIsParamModalOpen(true);
  }, []);

  const openEditParamModal = useCallback((index: number) => {
    const p = parameters[index];
    setEditingParamIndex(index);
    setParamForm({
      name: p.name,
      value: p.value,
      paramid: p.paramid || '',
      valueid: p.valueid || '',
      template_attribute_id: p.template_attribute_id,
      attribute_type: p.attribute_type,
      value_options: p.value_options || [],
    });
    setIsParamModalOpen(true);
  }, [parameters]);

  const saveParamModal = useCallback(() => {
    const name = paramForm.name.trim();
    const value = paramForm.value.trim();
    const paramid = (paramForm.paramid || '').trim();
    const valueid = (paramForm.valueid || '').trim();
    if (!name || !value) return;
    if (editingParamIndex === null) {
      const newParams = [
        ...parameters,
        {
          name,
          value,
          paramid,
          valueid,
          order_index: parameters.length,
          template_attribute_id: paramForm.template_attribute_id,
          attribute_type: paramForm.attribute_type,
          value_options: paramForm.value_options || [],
        },
      ];
      dirtyRef.current = true;
      setParametersState(newParams);
      onChange?.(newParams);
    } else {
      const updated = [...parameters];
      updated[editingParamIndex] = {
        ...updated[editingParamIndex],
        name,
        value,
        paramid,
        valueid,
        value_options: updated[editingParamIndex].value_options || [],
      };
      dirtyRef.current = true;
      setParametersState(updated);
      onChange?.(updated);
    }
    setIsParamModalOpen(false);
  }, [parameters, editingParamIndex, paramForm, onChange]);

  const deleteParam = useCallback((index: number) => {
    const newParams = parameters.filter((_, i) => i !== index).map((p, i) => ({ ...p, order_index: i }));
    dirtyRef.current = true;
    setParametersState(newParams);
    onChange?.(newParams);
  }, [parameters, onChange]);

  const deleteSelectedParams = useCallback((indexes: number[]) => {
    if (!indexes || indexes.length === 0) return;
    const keep = parameters.filter((_, i) => !indexes.includes(i)).map((p, i) => ({ ...p, order_index: i }));
    dirtyRef.current = true;
    setParametersState(keep);
    onChange?.(keep);
  }, [parameters, onChange]);

  return {
    parameters,
    isParamModalOpen,
    setIsParamModalOpen,
    editingParamIndex,
    selectedParamRows,
    setSelectedParamRows,
    paramForm,
    setParamForm,
    openAddParamModal,
    openEditParamModal,
    saveParamModal,
    deleteParam,
    deleteSelectedParams,
    setParameters,
  };
}
