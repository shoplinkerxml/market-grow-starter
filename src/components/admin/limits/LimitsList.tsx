import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Settings, Edit, Trash2, Loader2, MoreVertical, Shield, GripVertical } from 'lucide-react';
import { useI18n } from "@/i18n";
import { LimitService, type LimitTemplate } from '@/lib/limit-service';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  limit: LimitTemplate;
  onEdit?: (limit: LimitTemplate) => void;
  onDelete: (limit: LimitTemplate) => void;
}

const SortableRow = ({ limit, onEdit, onDelete }: SortableRowProps) => {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: limit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <div 
          className="flex items-center justify-center cursor-move touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center">
          <Shield className="h-5 w-5 text-emerald-600" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{limit.name}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-2 py-1 text-sm">{limit.code}</code>
      </TableCell>
      <TableCell>{limit.description || '—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{limit.path || '—'}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Відкрити меню</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(limit)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(limit)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

interface LimitsListProps {
  onEdit?: (limit: LimitTemplate) => void;
  onDelete?: (id: number) => void;
  onCreateNew?: () => void;
  onLimitsLoaded?: (count: number) => void;
  refreshTrigger?: number;
}

export const LimitsList = ({ 
  onEdit, 
  onDelete, 
  onCreateNew, 
  onLimitsLoaded,
  refreshTrigger 
}: LimitsListProps) => {
  const { t } = useI18n();
  const [limits, setLimits] = useState<LimitTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; limit: LimitTemplate | null }>({
    open: false,
    limit: null
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = limits.findIndex((item) => item.id === active.id);
      const newIndex = limits.findIndex((item) => item.id === over.id);

      const newLimits = arrayMove(limits, oldIndex, newIndex);
      
      // Оновлюємо локальний стан негайно
      setLimits(newLimits);

      // Зберігаємо новий порядок в базі даних
      try {
        const updates = newLimits.map((limit, index) => ({
          id: limit.id,
          order_index: index,
        }));
        
        await LimitService.updateLimitsOrder(updates);
        toast.success(t('limits_order_updated') || 'Порядок оновлено');
      } catch (error: any) {
        console.error('Update order error:', error);
        toast.error(error?.message || t('failed_update_limits_order') || 'Помилка оновлення порядку');
        // Повертаємо попередній стан при помилці
        loadLimits();
      }
    }
  };

  const loadLimits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await LimitService.getLimits();
      setLimits(data);
      onLimitsLoaded?.(data.length);
    } catch (error: any) {
      console.error('Load limits error:', error);
      toast.error(error?.message || t('failed_load_limits'));
    } finally {
      setLoading(false);
    }
  }, [t, onLimitsLoaded]);

  useEffect(() => {
    loadLimits();
  }, [loadLimits, refreshTrigger]);

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.limit) return;

    try {
      await onDelete?.(deleteDialog.limit.id);
      setDeleteDialog({ open: false, limit: null });
      loadLimits();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.message || t('failed_delete_limit'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (limits.length === 0) {
    return (
      <div className="flex justify-center">
        <Empty className="border max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Settings />
            </EmptyMedia>
            <EmptyTitle>{t('no_limits')}</EmptyTitle>
            <EmptyDescription>
              {t('no_limits_description')}
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={onCreateNew} className="mt-4">
            <Settings className="h-4 w-4 mr-2" />
            {t('add_limit_btn')}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>{t('limit_name_field')}</TableHead>
                <TableHead>{t('limit_code_field')}</TableHead>
                <TableHead>{t('limit_description_field')}</TableHead>
                <TableHead>{t('limit_path_field')}</TableHead>
                <TableHead className="w-[70px]">{t('table_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext 
                items={limits.map(l => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {limits.map((limit) => (
                  <SortableRow
                    key={limit.id}
                    limit={limit}
                    onEdit={onEdit}
                    onDelete={(limit) => setDeleteDialog({ open: true, limit })}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </div>
      </DndContext>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, limit: null })}>
        <AlertDialogContent noOverlay>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_limit_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{t('delete_limit_warning')}</span>
              {deleteDialog.limit?.name && (
                <span className="block">
                  {t('delete_limit_name_prefix')}: "{deleteDialog.limit.name}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
