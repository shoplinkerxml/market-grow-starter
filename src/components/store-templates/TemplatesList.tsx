import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { FileText, Edit, Trash2, Loader2 } from 'lucide-react';
import { useI18n } from "@/i18n";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TemplateService } from '@/lib/template-service';

interface Template {
  id: string;
  name: string;
  marketplace: string;
  xml_structure: any;
  mapping_rules: any[];
  description?: string;
  created_at: string;
}

interface TemplatesListProps {
  onSelect?: (template: Template) => void;
  onTemplatesLoaded?: (count: number) => void;
  onCreateNew?: () => void;
}

export const TemplatesList = ({ onSelect, onTemplatesLoaded, onCreateNew }: TemplatesListProps) => {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: Template | null }>({
    open: false,
    template: null
  });

  const loadTemplates = useCallback(async () => {
    try {
     
      const { data, error } = await (supabase as any)
        .from('store_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
      onTemplatesLoaded?.(data?.length || 0);
    } catch (error) {
      console.error('Load templates error:', error);
      toast.error(t('failed_save_template'));
    } finally {
      setLoading(false);
    }
  }, [t, onTemplatesLoaded]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = async (templateId: string, templateName: string) => {
    try {
      await TemplateService.deleteTemplate(templateId);
      
      toast.success(t('template_deleted'));
      setDeleteDialog({ open: false, template: null });
      loadTemplates();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.message || t('failed_delete_template'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex justify-center">
        <Empty className="border max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>{t('no_templates')}</EmptyTitle>
            <EmptyDescription>
              {t('no_templates_description')}
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onCreateNew} className="mt-4">
            <FileText className="h-4 w-4 mr-2" />
            {t('create_template')}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card 
            key={template.id} 
            className="card-elevated card-elevated-hover cursor-pointer"
            onClick={() => onSelect?.(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-emerald-600" />
                <div 
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => onSelect?.(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog({ open: true, template })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="mt-2">{template.name}</CardTitle>
              <CardDescription>
                {new Date(template.created_at).toLocaleDateString('uk-UA')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {template.marketplace && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{template.marketplace}</Badge>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{(template.mapping_rules?.length || 0)} {t('fields_found')}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, template: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_template_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{t('delete_template_warning')}</span>
              {deleteDialog.template?.name && (
                <span className="block">
                  {t('delete_template_name_prefix')}: "{deleteDialog.template.name}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.template && handleDelete(deleteDialog.template.id, deleteDialog.template.name)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
