import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowRight, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { XMLField, MappingRule, type TransformationType } from '@/lib/xml-template-service';

interface MappingTableProps {
  xmlFields: XMLField[];
  systemFields: SystemField[];
  mappings: MappingRule[];
  onMappingChange: (mappings: MappingRule[]) => void;
}

export interface SystemField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  category: string;
}

export const MappingTable: React.FC<MappingTableProps> = ({
  xmlFields,
  systemFields,
  mappings,
  onMappingChange
}) => {
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Автоматичні підказки на основі назв полів
  const getSuggestedMapping = (xmlPath: string): string | null => {
    const lowerPath = xmlPath.toLowerCase();
    
    const suggestions: Record<string, string> = {
      'price': 'price',
      'ціна': 'price',
      'name': 'name',
      'назва': 'name',
      'title': 'name',
      'заголовок': 'name',
      'description': 'description',
      'опис': 'description',
      'currency': 'currency',
      'валюта': 'currency',
      'category': 'category_id',
      'категорія': 'category_id',
      'image': 'images',
      'зображення': 'images',
      'picture': 'images',
      'article': 'article',
      'артикул': 'article',
      'id': 'external_id',
      'stock': 'stock_quantity',
      'залишок': 'stock_quantity',
      'quantity': 'stock_quantity',
      'кількість': 'stock_quantity',
      'vendor': 'vendor',
      'виробник': 'vendor',
      
    };

    for (const [key, value] of Object.entries(suggestions)) {
      if (lowerPath.includes(key)) {
        return value;
      }
    }
    
    return null;
  };

  // Отримати поточний маппінг для XML поля
  const getMappingForField = React.useCallback((xmlPath: string): MappingRule | undefined => {
    return mappings.find(m => m.sourceField === xmlPath);
  }, [mappings]);

  // Оновити маппінг
  const updateMapping = (xmlPath: string, systemFieldId: string | null, transformation?: TransformationType | string) => {
    const newMappings = [...mappings];
    const existingIndex = newMappings.findIndex(m => m.sourceField === xmlPath);
    
    if (systemFieldId === null) {
      // Видалити маппінг
      if (existingIndex >= 0) {
        newMappings.splice(existingIndex, 1);
      }
    } else {
      const systemField = systemFields.find(f => f.id === systemFieldId);
      if (!systemField) return;

      const newMapping: MappingRule = {
        sourceField: xmlPath,
        targetField: systemFieldId,
        transformation: transformation ? {
          type: (transformation as TransformationType),
          params: {}
        } : { type: 'direct', params: {} }
      };

      if (existingIndex >= 0) {
        newMappings[existingIndex] = newMapping;
      } else {
        newMappings.push(newMapping);
      }
    }
    
    onMappingChange(newMappings);
    toast.success('Маппінг оновлено');
  };

  // Фільтрація полів
  const filteredFields = useMemo(() => {
    let fields = [...xmlFields];
    
    if (showOnlyUnmapped) {
      fields = fields.filter(f => !getMappingForField(f.path));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      fields = fields.filter(f => 
        f.path.toLowerCase().includes(query)
      );
    }
    
    return fields;
  }, [xmlFields, showOnlyUnmapped, searchQuery, getMappingForField]);

  // Підрахунок прогресу
  const requiredFieldsCount = systemFields.filter(f => f.required).length;
  const mappedRequiredCount = mappings.filter(m => {
    const field = systemFields.find(f => f.id === m.targetField);
    return field?.required;
  }).length;
  const progressPercentage = requiredFieldsCount > 0 
    ? (mappedRequiredCount / requiredFieldsCount) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Прогрес-бар */}
      <div className="bg-muted/50 border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">
            Прогрес налаштування обов'язкових полів
          </h3>
          <span className="text-sm font-medium">
            {mappedRequiredCount} з {requiredFieldsCount}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-3" />
        {mappedRequiredCount === requiredFieldsCount && requiredFieldsCount > 0 && (
          <p className="text-sm mt-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Всі обов'язкові поля налаштовано!
          </p>
        )}
      </div>

      {/* Фільтри */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-unmapped"
            checked={showOnlyUnmapped}
            onCheckedChange={setShowOnlyUnmapped}
          />
          <Label htmlFor="show-unmapped" className="cursor-pointer">
            Тільки неприв'язані
          </Label>
        </div>
      </div>

      {/* Таблиця маппінгу */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold w-[25%]">XML поле</TableHead>
              <TableHead className="font-semibold w-[20%]">Значення</TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-semibold w-[25%]">Системне поле</TableHead>
              <TableHead className="font-semibold w-[20%]">Трансформація</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {searchQuery || showOnlyUnmapped 
                    ? 'Нічого не знайдено' 
                    : 'Завантажте XML файл'}
                </TableCell>
              </TableRow>
            ) : (
              filteredFields.map((field, index) => {
                const currentMapping = getMappingForField(field.path);
                const suggestedField = getSuggestedMapping(field.path);
                const systemField = currentMapping 
                  ? systemFields.find(f => f.id === currentMapping.targetField)
                  : null;
                const isRequired = systemField?.required;
                const isMapped = !!currentMapping;

                return (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          {field.path.split('.').pop()}
                          {!isMapped && suggestedField && (
                            <Badge variant="outline" className="bg-accent/50 text-accent-foreground text-xs">
                              автопідказка
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {field.path}
                        </code>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm text-gray-600 truncate max-w-[150px]" title={field.sample || ''}>
                        {field.sample || '-'}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={currentMapping?.targetField || ''}
                        onValueChange={(value) => updateMapping(field.path, value || null)}
                      >
                        <SelectTrigger className={`
                          ${!isMapped ? 'border-gray-300' : ''}
                          ${isRequired ? 'border-primary' : ''}
                        `}>
                          <SelectValue placeholder="Вибрати поле..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suggestedField && !isMapped && (
                            <>
                              <SelectItem value={suggestedField} className="bg-accent/30">
                                <div className="flex items-center gap-2">
                                  <span>⭐</span>
                                  <span>{systemFields.find(f => f.id === suggestedField)?.label}</span>
                                  <Badge variant="outline" className="text-xs">рекомендовано</Badge>
                                </div>
                              </SelectItem>
                              <div className="border-t my-1" />
                            </>
                          )}
                          {systemFields.map(sField => (
                            <SelectItem key={sField.id} value={sField.id}>
                              <div className="flex items-center gap-2">
                                {sField.label}
                                {sField.required && (
                                  <span className="text-destructive">*</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {sField.category}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={currentMapping?.transformation?.type || 'direct'}
                        onValueChange={(value) => 
                          currentMapping && updateMapping(field.path, currentMapping.targetField, value)
                        }
                        disabled={!isMapped}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Пряме</SelectItem>
                          <SelectItem value="number">Число</SelectItem>
                          <SelectItem value="string">Текст</SelectItem>
                          <SelectItem value="array">Масив</SelectItem>
                          <SelectItem value="boolean">Логічне</SelectItem>
                          <SelectItem value="date">Дата</SelectItem>
                          <SelectItem value="custom">Власне</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      {isMapped ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground/30" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Інформація про обов'язкові поля */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Обов'язкові поля
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {systemFields.filter(f => f.required).map(field => {
            const isMapped = mappings.some(m => m.targetField === field.id);
            return (
              <div 
                key={field.id}
                className={`flex items-center gap-2 text-sm p-2 rounded ${
                  isMapped ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isMapped ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{field.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
