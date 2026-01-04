import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ColumnDef,
  Row,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  GripVerticalIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { XMLField } from "@/lib/xml-template-service"

interface EditableRow extends XMLField {
  id: number;
}

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent cursor-grab active:cursor-grabbing"
    >
      <GripVerticalIcon className="size-4 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

interface EditableXMLTableProps {
  category: string;
  fields: XMLField[];
  onFieldsChange: (fields: XMLField[]) => void;
}

function DraggableRow({ 
  row, 
  onUpdate, 
  onDelete,
  category,
  allData
}: { 
  row: Row<EditableRow>; 
  onUpdate: (id: number, field: Partial<EditableRow>) => void;
  onDelete: (id: number) => void;
  category: string;
  allData: EditableRow[];
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [editedValue, setEditedValue] = React.useState('');

  // Инициализация значений при открытии редактирования
  const initEditValues = React.useCallback(() => {
    if (category === 'Валюти' || category === 'Характеристики товару') {
      setEditedName(row.original.sample || '');
      
      if (category === 'Валюти' && row.original.path.includes('@id')) {
        const ratePath = row.original.path.replace('@id', '@rate');
        const rateField = allData.find(f => f.path === ratePath);
        setEditedValue(rateField?.sample || '');
      } else if (category === 'Характеристики товару' && row.original.path.includes('@name')) {
        const basePath = row.original.path.replace('.@name', '');
        const textField = allData.find(f => f.path === basePath + '._text' || f.path === basePath);
        setEditedValue(textField?.sample || '');
      }
    } else {
      setEditedName(row.original.path);
      setEditedValue(row.original.sample || '');
    }
  }, [category, row.original.path, row.original.sample, allData]);

  const handleSave = () => {
    if (category === 'Валюти') {
      onUpdate(row.original.id, { sample: editedName });
      const ratePath = row.original.path.replace('@id', '@rate');
      const rateField = allData.find(f => f.path === ratePath);
      if (rateField) {
        onUpdate(rateField.id, { sample: editedValue });
      }
    } else if (category === 'Характеристики товару') {
      onUpdate(row.original.id, { sample: editedName });
      const basePath = row.original.path.replace('.@name', '');
      const textField = allData.find(f => f.path === basePath + '._text' || f.path === basePath);
      if (textField) {
        onUpdate(textField.id, { sample: editedValue });
      }
    } else {
      onUpdate(row.original.id, {
        path: editedName,
        sample: editedValue
      });
    }
    setIsEditing(false);
    toast.success('Зміни збережено локально');
  };

  const handleStartEdit = () => {
    initEditValues();
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Получить короткое имя для отображения
  const getDisplayName = (field: EditableRow, category: string) => {
    if (category === 'Валюти') {
      // Для валют показываем currency[0].@id как название валюты
      return field.sample || field.path.split('.').pop() || '';
    } else if (category === 'Характеристики товару') {
      // Для характеристик показываем sample из поля с @name (это название характеристики)
      return field.sample || field.path.split('.').pop() || '';
    }
    // Для остальных - последние 2 сегмента пути
    const parts = field.path.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return field.path;
  };

  // Получить значение для отображения
  const getDisplayValue = (field: EditableRow, category: string) => {
    if (category === 'Валюти') {
      // Для валют во втором столбце показываем rate из следующего поля
      const path = field.path;
      if (path.includes('@id')) {
        const ratePath = path.replace('@id', '@rate');
        const rateField = allData.find(f => f.path === ratePath);
        if (rateField) {
          return rateField.sample || '-';
        }
      }
      return field.sample || '-';
    } else if (category === 'Характеристики товару') {
      // Для характеристик берем значение из поля с _text (которое может быть до или после @name)
      const path = field.path;
      if (path.includes('@name')) {
        // Убираем .@name из пути и ищем поле с ._text
        const basePath = path.replace('.@name', '');
        const textField = allData.find(f => f.path === basePath + '._text' || f.path === basePath);
        if (textField) {
          return textField.sample || '-';
        }
      }
      return field.sample || '-';
    }
    return field.sample || '-';
  };

  return (
    <TableRow
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      <TableCell className="w-12">
        <DragHandle id={row.original.id} />
      </TableCell>
      <TableCell className="font-mono text-sm">
        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="h-8 text-sm"
          />
        ) : (
          <span onClick={handleStartEdit} className="cursor-pointer hover:bg-muted px-2 py-1 rounded">
            {getDisplayName(row.original, category)}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {isEditing ? (
          <Input
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="h-8 text-sm"
          />
        ) : (
          <span onClick={handleStartEdit} className="cursor-pointer hover:bg-muted px-2 py-1 rounded">
            {getDisplayValue(row.original, category)}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              className="h-7 px-2"
            >
              Зберегти
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="h-7 px-2"
            >
              Скасувати
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVerticalIcon className="h-4 w-4" />
                <span className="sr-only">Дії</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleStartEdit}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Редагувати
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(row.original.id)}
                className="text-destructive"
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Видалити
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

export function EditableXMLTable({ category, fields, onFieldsChange }: EditableXMLTableProps) {
  // Локальный state - инициализируем ОДИН РАЗ и НИКОГДА не трогаем из props
  const [data, setData] = React.useState<EditableRow[]>(() => 
    fields.map((field, index) => ({
      ...field,
      id: Date.now() + index
    }))
  );

  // State для ограничения отображаемых строк
  const [showAll, setShowAll] = React.useState(false);
  const INITIAL_ROWS = 50;

  // НЕТ useEffect - НИКАКОЙ синхронизации с props

  // Фильтруем данные для отображения и объединяем пары
  const filteredData = React.useMemo(() => {
    if (category === 'Валюти') {
      return data.filter(field => field.path.includes('@id'));
    } else if (category === 'Характеристики товару') {
      return data.filter(field => field.path.includes('@name'));
    }
    return data;
  }, [data, category]);

  // Ограничиваем количество отображаемых строк для производительности
  const displayData = React.useMemo(() => {
    return showAll ? filteredData : filteredData.slice(0, INITIAL_ROWS);
  }, [filteredData, showAll]);

  const hasMore = filteredData.length > INITIAL_ROWS;

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => displayData?.map(({ id }) => id) || [],
    [displayData]
  );

  const columns: ColumnDef<EditableRow>[] = [
    {
      id: "drag",
      header: () => null,
      cell: ({ row }) => null,
    },
    {
      id: "path",
      header: category === 'Валюти' ? 'Валюта' : category === 'Характеристики товару' ? 'Характеристика' : 'Поле',
      cell: ({ row }) => null,
    },
    {
      id: "sample",
      header: "Значення",
      cell: ({ row }) => null,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => null,
    },
  ];

  const table = useReactTable({
    data: displayData,
    columns,
    getRowId: (row) => row.id.toString(),
    getCoreRowModel: getCoreRowModel(),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id);
        const newIndex = prev.findIndex(item => item.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  const handleUpdate = (id: number, updates: Partial<EditableRow>) => {
    setData(prev => prev.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
    // НЕ вызываем onFieldsChange
  };

  const handleDelete = (id: number) => {
    setData(prev => prev.filter(row => row.id !== id));
    toast.success('Поле видалено');
  };

  const handleAddField = () => {
    const timestamp = Date.now();
    
    if (category === 'Валюти') {
      // Для валют создаем пару полей: @id и @rate
      const basePath = `yml_catalog.shop.currencies.currency[${filteredData.length}]`;
      const newFields: EditableRow[] = [
        {
          id: timestamp,
          path: `${basePath}.@id`,
          type: 'string',
          required: false,
          sample: 'UAH',
          category: category,
          order: data.length
        },
        {
          id: timestamp + 1,
          path: `${basePath}.@rate`,
          type: 'string',
          required: false,
          sample: '1',
          category: category,
          order: data.length + 1
        }
      ];
      setData(prev => [...prev, ...newFields]);
    } else if (category === 'Характеристики товару') {
      // Для характеристик создаем пару полей: @name и _text
      const basePath = `yml_catalog.shop.offers.offer.param[${filteredData.length}]`;
      const newFields: EditableRow[] = [
        {
          id: timestamp,
          path: `${basePath}.@name`,
          type: 'string',
          required: false,
          sample: 'Нова характеристика',
          category: category,
          order: data.length
        },
        {
          id: timestamp + 1,
          path: `${basePath}._text`,
          type: 'string',
          required: false,
          sample: 'Значення',
          category: category,
          order: data.length + 1
        }
      ];
      setData(prev => [...prev, ...newFields]);
    } else {
      // Для остальных категорий - обычное поле
      const newField: EditableRow = {
        id: timestamp,
        path: `${category.toLowerCase()}.new_field`,
        type: 'string',
        required: false,
        sample: '',
        category: category,
        order: data.length
      };
      setData(prev => [...prev, newField]);
    }
    
    toast.success('Поле додано');
  };

  const handleSaveAll = () => {
    onFieldsChange(data.map(({ id, ...field }) => field));
    toast.success('Всі зміни збережено!');
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{category}</CardTitle>
        <div className="flex gap-2">
          <Button
            onClick={handleSaveAll}
            size="sm"
            variant="default"
          >
            Зберегти всі зміни
          </Button>
          <Button
            onClick={handleAddField}
            size="sm"
            variant="outline"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Додати поле
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasMore && !showAll && (
          <div className="mb-3 p-3 bg-muted rounded-lg flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Показано {INITIAL_ROWS} з {filteredData.length} записів
            </span>
            <Button
              onClick={() => setShowAll(true)}
              size="sm"
              variant="outline"
            >
              Показати всі ({filteredData.length})
            </Button>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow 
                        key={row.id} 
                        row={row} 
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        category={category}
                        allData={data}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      Немає полів
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}
