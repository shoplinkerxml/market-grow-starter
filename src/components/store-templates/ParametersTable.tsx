import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { XMLStructure } from '@/lib/xml-template-service';

interface ParametersTableProps {
  structure: XMLStructure | null;
  onStructureChange?: (structure: XMLStructure) => void;
}

export const ParametersTable: React.FC<ParametersTableProps> = ({ 
  structure,
  onStructureChange 
}) => {
  const [hiddenFields, setHiddenFields] = useState<Set<number>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (!structure || !structure.fields || structure.fields.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-emerald-200/70">
        <p>Завантажте XML файл для перегляду структури</p>
      </div>
    );
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('XML шлях скопійовано');
  };

  const toggleVisibility = (index: number) => {
    const newHidden = new Set(hiddenFields);
    if (newHidden.has(index)) {
      newHidden.delete(index);
    } else {
      newHidden.add(index);
    }
    setHiddenFields(newHidden);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'string':
      case 'текст':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
      case 'number':
      case 'число':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
      case 'array':
      case 'масив':
        return 'bg-success-light text-success border-success/30 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
      case 'object':
      case "об'єкт":
        return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
      case 'boolean':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-500/40';
    }
  };

  const getCategoryIcon = (path: string) => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('price') || lowerPath.includes('ціна')) return '💰';
    if (lowerPath.includes('category') || lowerPath.includes('категор')) return '🏷️';
    if (lowerPath.includes('product') || lowerPath.includes('name') || lowerPath.includes('назва')) return '📦';
    if (lowerPath.includes('image') || lowerPath.includes('зображ') || lowerPath.includes('picture')) return '🖼️';
    if (lowerPath.includes('currency') || lowerPath.includes('валют')) return '💱';
    if (lowerPath.includes('description') || lowerPath.includes('опис')) return '📝';
    if (lowerPath.includes('url') || lowerPath.includes('link')) return '🔗';
    return '📄';
  };

  const getCategoryName = (path: string) => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('price') || lowerPath.includes('ціна')) return 'Ціна';
    if (lowerPath.includes('category') || lowerPath.includes('категор')) return 'Категорія';
    if (lowerPath.includes('product') || lowerPath.includes('name') || lowerPath.includes('назва')) return 'Основна інформація';
    if (lowerPath.includes('image') || lowerPath.includes('зображ') || lowerPath.includes('picture')) return 'Медіа';
    if (lowerPath.includes('currency') || lowerPath.includes('валют')) return 'Валюта';
    if (lowerPath.includes('description') || lowerPath.includes('опис')) return 'Опис';
    if (lowerPath.includes('url') || lowerPath.includes('link')) return 'Посилання';
    return 'Інше';
  };

  const deleteField = (index: number) => {
    if (!structure || !onStructureChange) return;
    
    const newFields = structure.fields.filter((_, i) => i !== index);
    onStructureChange({
      ...structure,
      fields: newFields
    });
    toast.success('Поле видалено');
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || !structure || !onStructureChange) return;
    
    const newFields = [...structure.fields];
    const draggedField = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedField);
    
    onStructureChange({
      ...structure,
      fields: newFields
    });
    
    setDraggedIndex(null);
    toast.success('Порядок змінено');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-neutral-900/70">
            <TableHead className="w-12"></TableHead>
            <TableHead className="font-semibold">Назва параметра</TableHead>
            <TableHead className="font-semibold">Значення (приклад)</TableHead>
            <TableHead className="font-semibold">XML шлях</TableHead>
            <TableHead className="font-semibold">Тип</TableHead>
            <TableHead className="font-semibold">Категорія</TableHead>
            <TableHead className="w-40 font-semibold">Дії</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {structure.fields.map((field, index) => (
            <TableRow 
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              className={`
                ${hiddenFields.has(index) ? 'opacity-50' : ''}
                ${draggedIndex === index ? 'opacity-30' : ''}
                hover:bg-gray-50 dark:hover:bg-emerald-900/30 transition-colors
              `}
            >
              <TableCell className="cursor-move">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </TableCell>
              
              <TableCell>
                <div className="font-medium">{field.path.split('.').pop()}</div>
              </TableCell>
              
              <TableCell>
                <div className="text-gray-600 truncate max-w-xs dark:text-emerald-200/70" title={field.sample || ''}>
                  {field.sample || '-'}
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono dark:bg-neutral-900/60 dark:border dark:border-emerald-500/40 dark:text-emerald-100">
                    {field.path}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyPath(field.path)}
                    className="h-6 w-6 p-0"
                    title="Копіювати шлях"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              
              <TableCell>
                <Badge 
                  variant="outline" 
                  className={`${getTypeBadgeColor(field.type)} font-medium`}
                >
                  {field.type}
                </Badge>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCategoryIcon(field.path)}</span>
                  <span className="text-sm text-gray-600 dark:text-emerald-200/70">{getCategoryName(field.path)}</span>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleVisibility(index)}
                    className="h-8 w-8 p-0"
                    title={hiddenFields.has(index) ? 'Показати' : 'Приховати'}
                  >
                    {hiddenFields.has(index) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteField(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-200 dark:hover:text-red-100 dark:hover:bg-red-500/20"
                    title="Видалити"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
