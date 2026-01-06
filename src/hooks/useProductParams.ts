import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ProductParam } from '@/components/ProductFormTabs/types';

export function useProductParams(preloadedParams?: ProductParam[], onChange?: (params: ProductParam[]) => void) {
  const dirtyRef = useRef(false);
  const [parameters, setParametersState] = useState<ProductParam[]>(() => (Array.isArray(preloadedParams) ? preloadedParams : []));
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<{ name: string; value: string; paramid?: string; valueid?: string }>({
    name: '',
    value: '',
    paramid: '',
    valueid: ''
  });
  const [selectedParamRows, setSelectedParamRows] = useState<number[]>([]);

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
    setParamForm({ name: '', value: '', paramid: '', valueid: '' });
    setIsParamModalOpen(true);
  }, []);

  const openEditParamModal = useCallback((index: number) => {
    const p = parameters[index];
    setEditingParamIndex(index);
    setParamForm({ name: p.name, value: p.value, paramid: p.paramid || '', valueid: p.valueid || '' });
    setIsParamModalOpen(true);
  }, [parameters]);

  const saveParamModal = useCallback(() => {
    const name = paramForm.name.trim();
    const value = paramForm.value.trim();
    const paramid = (paramForm.paramid || '').trim();
    const valueid = (paramForm.valueid || '').trim();
    if (!name || !value) return;
    if (editingParamIndex === null) {
      const newParams = [...parameters, { name, value, paramid, valueid, order_index: parameters.length }];
      dirtyRef.current = true;
      setParametersState(newParams);
      onChange?.(newParams);
    } else {
      const updated = [...parameters];
      updated[editingParamIndex] = { ...updated[editingParamIndex], name, value, paramid, valueid };
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
