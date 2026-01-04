import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Check, Save, X } from 'lucide-react';
import { XMLField, MappingRule } from '@/lib/xml-template-service';

interface SimpleMappingViewProps {
  xmlFields: XMLField[];
  systemFields: SystemField[];
  mappings: MappingRule[];
  onMappingChange: (mappings: MappingRule[]) => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  templateName?: string;
  onTemplateNameChange?: (name: string) => void;
  marketplace?: string;
  onMarketplaceChange?: (marketplace: string) => void;
  templateDescription?: string;
  onTemplateDescriptionChange?: (desc: string) => void;
}

export interface SystemField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  category: string;
}

export const SimpleMappingView: React.FC<SimpleMappingViewProps> = ({
  xmlFields,
  systemFields,
  mappings,
  onMappingChange,
  onSave,
  onCancel,
  saving = false,
  templateName = '',
  onTemplateNameChange,
  marketplace = '',
  onMarketplaceChange,
  templateDescription = '',
  onTemplateDescriptionChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFields = xmlFields.filter(field => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return field.path.toLowerCase().includes(query) || 
           (field.sample && field.sample.toLowerCase().includes(query));
  });

  const groupByCategory = (fields: XMLField[]) => {
    const groups: Record<string, XMLField[]> = {};
    fields.forEach(field => {
      const cat = field.category || 'Інше';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(field);
    });
    return groups;
  };

  const groupedFields = groupByCategory(filteredFields);
  
  // Правильный порядок категорий
  const categoryOrder = [
    'Основна інформація',
    'Валюти',
    'Категорії',
    'Параметри товару',
    'Характеристики товару',
    'Інше'
  ];
  
  const sortedCategories = categoryOrder.filter(cat => groupedFields[cat]);
  // Добавляем категории, которых нет в заданном порядке
  Object.keys(groupedFields).forEach(cat => {
    if (!categoryOrder.includes(cat)) {
      sortedCategories.push(cat);
    }
  });

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">Перевірка парсингу</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Перевірте чи правильно розпізнались поля з XML файлу
              </p>
            </div>
            {(onSave || onCancel) && (
              <div className="flex items-center gap-2">
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
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Блок налаштування шаблону */}
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="text-lg font-medium">Налаштування шаблону</h3>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Назва шаблону *</Label>
            <Input
              id="template-name"
              placeholder="Введіть назву шаблону"
              value={templateName}
              onChange={(e) => onTemplateNameChange?.(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace">Маркетплейс</Label>
            <Input
              id="marketplace"
              placeholder="Rozetka, Prom, Amazon..."
              value={marketplace}
              onChange={(e) => onMarketplaceChange?.(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-desc">Опис шаблону</Label>
            <Textarea
              id="template-desc"
              placeholder="Введіть опис шаблону"
              value={templateDescription}
              onChange={(e) => onTemplateDescriptionChange?.(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Пошук */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="pl-10" 
        />
      </div>

      {/* Список полів по категоріям */}
      <div className="space-y-4">
        {sortedCategories.map(category => (
          <Card key={category}>
            <CardHeader className="pb-3 bg-muted/50">
              <CardTitle className="text-base flex items-center gap-2">
                {category}
                <Badge variant="secondary" className="text-xs">
                  {groupedFields[category].length} полів
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Ліва колонка: що було в XML */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b">
                    Поля в XML файлі
                  </div>
                  {groupedFields[category].map((field, idx) => {
                    // Для валют і характеристик показуємо пари
                    if (category === 'Валюти' && field.path.includes('@id')) {
                      const ratePath = field.path.replace('@id', '@rate');
                      const rateField = xmlFields.find(f => f.path === ratePath);
                      return (
                        <div key={idx} className="p-3 bg-card border border-border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm break-words">
                                {field.path}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Приклад:</span> {field.sample || '-'} (курс: {rateField?.sample || '-'})
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          </div>
                        </div>
                      );
                    } else if (category === 'Категорії' && field.path.includes('@id')) {
                      const basePath = field.path.replace('.@id', '');
                      const nameField = xmlFields.find(f => f.path === basePath + '._text' || f.path === basePath);
                      return (
                        <div key={idx} className="p-3 bg-card border border-border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm break-words">
                                {field.path}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Приклад:</span> ID: {field.sample || '-'}, Назва: {nameField?.sample || '-'}
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          </div>
                        </div>
                      );
                    } else if (category === 'Характеристики товару' && field.path.includes('@name')) {
                      const basePath = field.path.replace('.@name', '');
                      const textField = xmlFields.find(f => f.path === basePath + '._text' || f.path === basePath);
                      return (
                        <div key={idx} className="p-3 bg-card border border-border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm break-words">
                                {field.path}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Приклад:</span> {field.sample || '-'} = {textField?.sample || '-'}
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          </div>
                        </div>
                      );
                    } else if (
                      (category === 'Валюти' && field.path.includes('@rate')) ||
                      (category === 'Категорії' && (field.path.includes('._text') || (!field.path.includes('@id') && field.path.includes('category')))) ||
                      (category === 'Характеристики товару' && (field.path.includes('._text') || (!field.path.includes('@name') && field.path.includes('param'))))
                    ) {
                      return null;
                    }
                    
                    return (
                      <div key={idx} className="p-3 bg-card border border-border rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm break-words">
                              {field.path}
                            </div>
                            {field.sample && (
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Приклад:</span> {field.sample}
                              </div>
                            )}
                          </div>
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Права колонка: що розпарсилось */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b">
                    Що розпарсилось
                  </div>
                  {groupedFields[category].map((field, idx) => {
                    const isManuallyAdded = field.path.includes('new_field') || 
                                           field.path.includes('old_price') ||
                                           (field.order && field.order >= 100);
                    
                    if (category === 'Валюти' && field.path.includes('@id')) {
                      const ratePath = field.path.replace('@id', '@rate');
                      const rateField = xmlFields.find(f => f.path === ratePath);
                      return (
                        <div key={idx} className="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-sm text-green-900">
                                  {field.sample || field.path.split('.').pop()}
                                </div>
                                {isManuallyAdded && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                                    Додано вручну
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-green-700 mt-1 break-words">
                                <span className="font-medium">Курс:</span> {rateField?.sample || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (category === 'Категорії' && field.path.includes('@id')) {
                      const basePath = field.path.replace('.@id', '');
                      const nameField = xmlFields.find(f => f.path === basePath + '._text' || f.path === basePath);
                      return (
                        <div key={idx} className="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-sm text-green-900">
                                  {nameField?.sample || field.path.split('.').pop()}
                                </div>
                                {isManuallyAdded && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                                    Додано вручну
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-green-700 mt-1 break-words">
                                <span className="font-medium">ID:</span> {field.sample || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (category === 'Характеристики товару' && field.path.includes('@name')) {
                      const basePath = field.path.replace('.@name', '');
                      const textField = xmlFields.find(f => f.path === basePath + '._text' || f.path === basePath);
                      return (
                        <div key={idx} className="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-sm text-green-900">
                                  {field.sample || field.path.split('.').pop()}
                                </div>
                                {isManuallyAdded && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                                    Додано вручну
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-green-700 mt-1 break-words">
                                <span className="font-medium">Значення:</span> {textField?.sample || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (
                      (category === 'Валюти' && field.path.includes('@rate')) ||
                      (category === 'Категорії' && (field.path.includes('._text') || (!field.path.includes('@id') && field.path.includes('category')))) ||
                      (category === 'Характеристики товару' && (field.path.includes('._text') || (!field.path.includes('@name') && field.path.includes('param'))))
                    ) {
                      return null;
                    }
                    
                    return (
                      <div key={idx} className="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-sm text-green-900">
                                {field.path.split('.').pop()}
                              </div>
                              {isManuallyAdded && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                                  Додано вручну
                                </Badge>
                              )}
                            </div>
                            {field.sample && (
                              <div className="text-xs text-green-700 mt-1 break-words">
                                <span className="font-medium">Приклад:</span> {field.sample}
                              </div>
                            )}
                            {field.required && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Обов'язкове
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Статистика */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{xmlFields.length}</div>
              <div className="text-sm text-muted-foreground">Полів розпарсено</div>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{Object.keys(groupedFields).length}</div>
              <div className="text-sm text-muted-foreground">Категорій знайдено</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
