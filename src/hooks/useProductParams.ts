import { useCallback, useState } from 'react';
import type { ProductParam } from '@/components/ProductFormTabs/types';

export function useProductParams(preloadedParams?: ProductParam[], onChange?: (params: ProductParam[]) => void) {
  const [parameters, setParameters] = useState<ProductParam[]>(preloadedParams || []);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<{ name: string; value: string; paramid?: string; valueid?: string }>({
    name: '',
    value: '',
    paramid: '',
    valueid: ''
  });
  const [selectedParamRows, setSelectedParamRows] = useState<number[]>([]);

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
      setParameters(newParams);
      onChange?.(newParams);
    } else {
      const updated = [...parameters];
      updated[editingParamIndex] = { ...updated[editingParamIndex], name, value, paramid, valueid };
      setParameters(updated);
      onChange?.(updated);
    }
    setIsParamModalOpen(false);
  }, [parameters, editingParamIndex, paramForm, onChange]);

  const deleteParam = useCallback((index: number) => {
    const newParams = parameters.filter((_, i) => i !== index).map((p, i) => ({ ...p, order_index: i }));
    setParameters(newParams);
    onChange?.(newParams);
  }, [parameters, onChange]);

  const deleteSelectedParams = useCallback((indexes: number[]) => {
    if (!indexes || indexes.length === 0) return;
    const keep = parameters.filter((_, i) => !indexes.includes(i)).map((p, i) => ({ ...p, order_index: i }));
    setParameters(keep);
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
