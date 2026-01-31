import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Edit2, Eye, EyeOff, GripVertical } from 'lucide-react';
import type { XMLStructure } from '@/lib/xml-template-service';
import { useI18n } from "@/i18n";
import { toast } from 'sonner';
import { useState } from 'react';

interface TemplateEditorProps {
  structure?: XMLStructure;
}

export const TemplateEditor = ({ structure }: TemplateEditorProps) => {
  const { t } = useI18n();
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  
  if (!structure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('xml_structure')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            {t('upload_xml_file')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleFieldVisibility = (path: string) => {
    setHiddenFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('Путь скопирован');
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'string': return 'bg-primary/10 text-primary dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
      case 'number': return 'bg-primary/10 text-primary dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
      case 'array': return 'bg-secondary/50 text-secondary-foreground dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
      case 'object': return 'bg-orange-100 text-orange-800 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
      case 'boolean': return 'bg-accent/50 text-accent-foreground dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
      default: return 'bg-gray-100 text-gray-800 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border dark:border-emerald-500/40';
    }
  };

  const getCategoryIcon = (path: string) => {
    if (path.includes('price')) return '💰';
    if (path.includes('category')) return '🏷️';
    if (path.includes('product') || path.includes('name')) return '📦';
    if (path.includes('image')) return '🖼️';
    return '📤';
  };

  const leafFields = structure.fields.filter(f => !f.children || f.children.length === 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Таблица параметров</CardTitle>
            <div className="text-sm text-muted-foreground">
              {leafFields.length} полей
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Название параметра</TableHead>
                  <TableHead>Значение (пример)</TableHead>
                  <TableHead>XML путь</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="w-32">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leafFields.map((field) => (
                  <TableRow key={field.path} className={hiddenFields.has(field.path) ? 'opacity-50' : ''}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {getCategoryIcon(field.path)} {field.path.split('.').pop()}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {field.sample || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded dark:bg-neutral-900/60 dark:border dark:border-emerald-500/40 dark:text-emerald-100">{field.path}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full border border-border hover:border-emerald-500 hover:text-emerald-600"
                          onClick={() => copyPath(field.path)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeBadgeColor(field.type)}>
                        {field.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {field.path.includes('price') ? '💰 Цена' : '📦 Основная'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-border hover:border-emerald-500 hover:text-emerald-600">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full border border-border hover:border-emerald-500 hover:text-emerald-600"
                          onClick={() => toggleFieldVisibility(field.path)}
                        >
                          {hiddenFields.has(field.path) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
