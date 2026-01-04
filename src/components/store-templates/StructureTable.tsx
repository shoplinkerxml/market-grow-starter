import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, GripVertical, Save, X, Table as TableIcon, FileCode, MoreHorizontal, Edit, Trash2, Copy as CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { XMLStructure } from '@/lib/xml-template-service';
import { InteractiveXmlTree } from './InteractiveXmlTree';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StructureTableProps {
  structure: XMLStructure;
  onStructureChange?: (structure: XMLStructure) => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
}

// Категории в правильном порядке
const CATEGORY_ORDER = [
  'Основна інформація',
  'Валюти',
  'Категорії',
  'Параметри товару',
  'Характеристики товару',
  'Інше'
];

export function StructureTable({ structure, onStructureChange, onSave, onCancel, saving }: StructureTableProps) {
  const [viewMode, setViewMode] = React.useState<'tree' | 'table'>('table');

  const handleViewModeChange = () => {
    setViewMode(viewMode === 'tree' ? 'table' : 'tree');
  };
  
  // Сортируем поля по правильному порядку категорий
  const sortedFields = React.useMemo(() => {
    const categoryOrder: Record<string, number> = {
      'Основна інформація': 1,
      'Валюти': 2,
      'Категорії': 3,
      'Параметри товару': 4,
      'Характеристики товару': 5,
      'Інше': 6
    };
    
    return [...structure.fields].sort((a, b) => {
      const catA = categoryOrder[a.category || 'Інше'] || 999;
      const catB = categoryOrder[b.category || 'Інше'] || 999;
      
      if (catA !== catB) {
        return catA - catB;
      }
      
      // Внутри категории сохраняем порядок из XML
      return (a.order || 0) - (b.order || 0);
    });
  }, [structure.fields]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('XML шлях скопійовано');
  };

  const handleEdit = (field: any) => {
    toast.info('Редагування буде реалізовано');
  };

  const handleDelete = (field: any) => {
    toast.info('Видалення буде реалізовано');
  };

  const handleDuplicate = (field: any) => {
    toast.info('Дублювання буде реалізовано');
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'Основна інформація':
        return 'text-primary/60 border-primary/30';
      case 'Валюти':
        return 'text-primary/70 border-primary/40';
      case 'Категорії':
        return 'text-primary/80 border-primary/50';
      case 'Параметри товару':
        return 'text-primary/90 border-primary/60';
      case 'Характеристики товару':
        return 'text-primary border-primary/70';
      default:
        return 'text-muted-foreground border-muted';
    }
  };

  const getFieldDisplayName = (path: string): string => {
    const parts = path.split('.');
    const lastPart = parts[parts.length - 1];
    
    // Убираем индексы массивов для отображения
    return lastPart.replace(/\[\d+\]$/g, '');
  };

  const getShortenedPath = (path: string): string => {
    const parts = path.split('.');
    if (parts.length <= 2) return path;
    return '...' + parts.slice(-2).join('.');
  };

  return (
    <div className="space-y-4">
      {/* Заголовок с кнопками */}
      {(onSave || onCancel) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg">Структура XML</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Перегляньте структуру шаблону в режимі таблиці або дерева
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleViewModeChange} 
                  title={viewMode === 'tree' ? 'Переключити на таблицю' : 'Переключити на дерево'}
                >
                  {viewMode === 'tree' ? <TableIcon className="h-4 w-4" /> : <FileCode className="h-4 w-4" />}
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
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[250px]">Назва параметру</TableHead>
                <TableHead className="w-[150px]">Значення</TableHead>
                <TableHead className="w-[280px]">XML шлях</TableHead>
                <TableHead className="w-[100px]">Тип</TableHead>
                <TableHead className="w-[150px]">Категорія</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFields.map((field, index) => (
                <TableRow key={`${field.path}-${index}`} className="hover:bg-gray-50">
                  <TableCell className="py-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  </TableCell>
                  <TableCell className="font-medium font-mono text-sm py-3">
                    {getFieldDisplayName(field.path)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="truncate text-sm max-w-[150px]" title={field.sample}>
                      {field.sample || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate" title={field.path}>
                        {getShortenedPath(field.path)}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => handleCopyPath(field.path)}
                        title="Копіювати шлях"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="secondary" className="text-xs">
                      {field.type === 'string' ? 'Текст' : 
                       field.type === 'number' ? 'Число' :
                       field.type === 'boolean' ? 'Так/Ні' :
                       field.type === 'array' ? 'Масив' :
                       field.type === 'object' ? "Об'єкт" : field.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge 
                      className={getCategoryColor(field.category || 'Інше')} 
                      variant="outline"
                    >
                      {field.category || 'Інше'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
