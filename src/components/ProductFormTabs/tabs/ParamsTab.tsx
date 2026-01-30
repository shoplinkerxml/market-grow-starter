import React, { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import type { ProductParam } from '../types';

const ParamsSection = lazy(() => import('../ParamsSection'));

type Props = {
  t: (k: string) => string;
  readOnly?: boolean;
  forceParamsEditable?: boolean;
  parameters: ProductParam[];
  templates: Array<{ id: number; name: string }>;
  templatesLoading: boolean;
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
  onApplyTemplate: () => void;
  applyingTemplate: boolean;
  onEditRow: (index: number) => void;
  onDeleteRow: (index: number) => void;
  onDeleteSelected: (indexes: number[]) => void;
  onSelectionChange: (indexes: number[]) => void;
  onAddParam: () => void;
  onReplaceData: (rows: ProductParam[]) => void;
  onValueChange: (rowIndex: number, value: string, valueid?: string | null) => void;
  onNameChange: (rowIndex: number, value: string) => void;
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
          templates={props.templates}
          templatesLoading={props.templatesLoading}
          selectedTemplateId={props.selectedTemplateId}
          onTemplateChange={props.onTemplateChange}
          onApplyTemplate={props.onApplyTemplate}
          applyingTemplate={props.applyingTemplate}
          onEditRow={props.onEditRow}
          onDeleteRow={props.onDeleteRow}
          onDeleteSelected={props.onDeleteSelected}
          onSelectionChange={props.onSelectionChange}
          onAddParam={props.onAddParam}
          onReplaceData={props.onReplaceData}
          onValueChange={props.onValueChange}
          onNameChange={props.onNameChange}
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
