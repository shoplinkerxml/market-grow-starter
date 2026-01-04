import React, { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import type { ProductParam } from '../types';

const ParamsSection = lazy(() => import('../ParamsSection'));

type Props = {
  t: (k: string) => string;
  readOnly?: boolean;
  forceParamsEditable?: boolean;
  parameters: ProductParam[];
  onEditRow: (index: number) => void;
  onDeleteRow: (index: number) => void;
  onDeleteSelected: (indexes: number[]) => void;
  onSelectionChange: (indexes: number[]) => void;
  onAddParam: () => void;
  onReplaceData: (rows: ProductParam[]) => void;
  isParamModalOpen: boolean;
  setIsParamModalOpen: (v: boolean) => void;
  paramForm: { name: string; value: string; paramid?: string; valueid?: string };
  setParamForm: (v: { name: string; value: string; paramid?: string; valueid?: string }) => void;
  saveParamModal: () => void;
  editingParamIndex: number | null;
};

export const ParamsTab = React.memo(function ParamsTab(props: Props) {
  return (
    <div className="space-y-6" data-testid="productFormTabs_paramsContent">
      <Suspense fallback={<Spinner className="mx-auto" />}>
        <ParamsSection
          t={props.t}
          readOnly={props.readOnly}
          forceParamsEditable={props.forceParamsEditable}
          parameters={props.parameters}
          onEditRow={props.onEditRow}
          onDeleteRow={props.onDeleteRow}
          onDeleteSelected={props.onDeleteSelected}
          onSelectionChange={props.onSelectionChange}
          onAddParam={props.onAddParam}
          onReplaceData={props.onReplaceData}
          isParamModalOpen={props.isParamModalOpen}
          setIsParamModalOpen={props.setIsParamModalOpen}
          paramForm={props.paramForm}
          setParamForm={props.setParamForm as any}
          saveParamModal={props.saveParamModal}
          editingParamIndex={props.editingParamIndex}
        />
      </Suspense>
    </div>
  );
})
