import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, XCircle, Package, DollarSign, Image, FileText } from 'lucide-react';
import { MappingRule } from '@/lib/xml-template-service';
import { SystemField } from './MappingTable';

interface TemplatePreviewProps {
  templateName: string;
  marketplace: string;
  description: string;
  mappings: MappingRule[];
  systemFields: SystemField[];
  sampleData?: Record<string, unknown> | null;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateName,
  marketplace,
  description,
  mappings,
  systemFields,
  sampleData
}) => {
  // Підрахунок статусу маппінгу
  const requiredFields = systemFields.filter(f => f.required);
  const mappedRequired = requiredFields.filter(f => 
    mappings.some(m => m.targetField === f.id)
  );
  const progressPercentage = requiredFields.length > 0
    ? (mappedRequired.length / requiredFields.length) * 100
    : 0;

  // Групування полів за статусом
  const mappedFields = systemFields.filter(f =>
    mappings.some(m => m.targetField === f.id)
  );
  const unmappedRequired = requiredFields.filter(f =>
    !mappings.some(m => m.targetField === f.id)
  );
  const unmappedOptional = systemFields.filter(f =>
    !f.required && !mappings.some(m => m.targetField === f.id)
  );

  // Отримати іконку для категорії
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'основна інформація':
      case 'основна':
        return <Package className="h-4 w-4" />;
      case 'ціна':
      case 'price':
        return <DollarSign className="h-4 w-4" />;
      case 'медіа':
      case 'зображення':
        return <Image className="h-4 w-4" />;
      case 'опис':
      case 'description':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Отримати значення поля з sample data
  const getFieldValue = (fieldId: string): unknown => {
    if (!sampleData) return null;
    
    const mapping = mappings.find(m => m.targetField === fieldId);
    if (!mapping) return null;

    // Спрощене отримання значення за шляхом
    const pathParts = mapping.sourceField.split('.');
    let value: unknown = sampleData;
    
    for (const part of pathParts) {
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        value = obj[part];
      } else {
        return null;
      }
    }
    
    return value;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* A. Інформація про шаблон (верхня частина, на всю ширину на мобільних) */}
      <div className="lg:col-span-3">
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="h-6 w-6" />
              Інформація про шаблон
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Назва шаблону</label>
                <p className="font-semibold text-lg">{templateName || 'Без назви'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Маркетплейс</label>
                <p className="font-semibold text-lg">{marketplace || 'Не вказано'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Статус</label>
                <div className="mt-1">
                  {progressPercentage === 100 ? (
                    <Badge>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Готово
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Потребує налаштування
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Опис</label>
                <p className="text-muted-foreground mt-1">{description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* B. Превью маппінгу (ліва колонка) */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Статус маппінгу</span>
              <Badge variant="outline">
                {mappedFields.length}/{systemFields.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Прогрес */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Обов'язкові поля</span>
                <span className="text-sm text-muted-foreground">
                  {mappedRequired.length}/{requiredFields.length}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Список прив'язаних полів */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Прив'язані поля ({mappedFields.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {mappedFields.map(field => {
                  const mapping = mappings.find(m => m.targetField === field.id);
                  return (
                    <div key={field.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{field.label}</div>
                        <div className="text-xs text-muted-foreground truncate">→ {mapping?.sourceField}</div>
                      </div>
                      {field.required && (
                        <span className="text-destructive flex-shrink-0">*</span>
                      )}
                    </div>
                  );
                })}
                {mappedFields.length === 0 && (
                  <p className="text-sm text-muted-foreground italic p-2">Поки що немає прив'язаних полів</p>
                )}
              </div>
            </div>

            {/* Неприв'язані обов'язкові поля */}
            {unmappedRequired.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Потребують налаштування ({unmappedRequired.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unmappedRequired.map(field => (
                    <div key={field.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium truncate">{field.label}</span>
                      <span className="text-destructive flex-shrink-0">*</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Неприв'язані опціональні поля */}
            {unmappedOptional.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Опціональні ({unmappedOptional.length})
                </h4>
                <div className="text-xs text-muted-foreground">
                  {unmappedOptional.slice(0, 3).map(f => f.label).join(', ')}
                  {unmappedOptional.length > 3 && ` та ще ${unmappedOptional.length - 3}...`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* C. Приклад даних товару (права колонка) */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Превью товару
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sampleData ? (
              <div className="space-y-4">
                {/* Основна інформація */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Основна інформація
                  </h4>
                  <div className="space-y-2">
                    {['name', 'external_id', 'article'].map(fieldId => {
                      const field = systemFields.find(f => f.id === fieldId);
                      const value = getFieldValue(fieldId);
                      if (!field || !value) return null;
                      return (
                        <div key={fieldId} className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{field.label}:</span>
                          <span className="text-sm font-medium">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ціна */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Ціна
                  </h4>
                  <div className="space-y-2">
                    {['price', 'currency'].map(fieldId => {
                      const field = systemFields.find(f => f.id === fieldId);
                      const value = getFieldValue(fieldId);
                      if (!field || !value) return null;
                      return (
                        <div key={fieldId} className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{field.label}:</span>
                          <span className="text-sm font-medium">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Опис */}
                {getFieldValue('description') && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Опис
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {String(getFieldValue('description'))}
                    </p>
                  </div>
                )}

                {/* Зображення */}
                {getFieldValue('images') && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Зображення
                    </h4>
                    <div className="text-sm">
                      {Array.isArray(getFieldValue('images')) 
                        ? `${(getFieldValue('images') as unknown[]).length} зображень`
                        : 'URL: ' + String(getFieldValue('images')).substring(0, 50) + '...'}
                    </div>
                  </div>
                )}

                {/* Додаткові поля */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Додаткові дані</h4>
                  <div className="space-y-2">
                    {mappedFields
                      .filter(f => !['name', 'external_id', 'article', 'price', 'currency', 'description', 'images'].includes(f.id))
                      .map(field => {
                        const value = getFieldValue(field.id);
                        if (!value) return null;
                        return (
                          <div key={field.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{field.label}:</span>
                            <span className="font-medium truncate max-w-xs" title={String(value)}>
                              {String(value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Завантажте XML файл для перегляду превью товару</p>
                <p className="text-sm text-gray-400 mt-2">
                  Тут відобразиться приклад того, як виглядатиме товар в системі
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
