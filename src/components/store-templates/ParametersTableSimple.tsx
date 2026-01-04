import React from 'react';
import { XMLStructure } from '@/lib/xml-template-service';
import { InteractiveXmlTree } from './InteractiveXmlTree';
import { StructureTable } from './StructureTable';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, X, Table, FileCode } from 'lucide-react';

interface ParametersTableProps {
  structure: XMLStructure | null;
  onStructureChange?: (structure: XMLStructure) => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
}

export const ParametersTable: React.FC<ParametersTableProps> = ({ 
  structure,
  onStructureChange,
  onSave,
  onCancel,
  saving = false
}) => {
  const [viewMode, setViewMode] = React.useState<'tree' | 'table'>('tree');
  const treeRef = React.useRef<any>(null);

  const handleViewModeChange = () => {
    // При переключении сохраняем текущее состояние
    setViewMode(viewMode === 'tree' ? 'table' : 'tree');
  };
  if (!structure || !structure.fields || structure.fields.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Завантажте XML файл для перегляду структури</p>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4">
      {/* Заголовок с кнопками */}
      {(onSave || onCancel) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg">Структура XML</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Перегляньте та редагуйте структуру шаблону
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleViewModeChange} 
                  title={viewMode === 'tree' ? 'Переключити на таблицю' : 'Переключити на XML'}
                >
                  {viewMode === 'tree' ? <Table className="h-4 w-4" /> : <FileCode className="h-4 w-4" />}
                </Button>
                {onCancel && (
                  <Button variant="outline" size="icon" onClick={onCancel} disabled={saving} title="Скасувати">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {onSave && (
                  <Button variant="default" size="icon" onClick={onSave} disabled={saving} title="Зберегти">
                    <Save className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
      
      {viewMode === 'tree' ? (
        <InteractiveXmlTree 
          structure={structure}
          onSave={onStructureChange}
        />
      ) : (
        <StructureTable 
          structure={structure}
        />
      )}
    </div>
  );
};
