import React from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  DollarSign,
  Hash,
  Tag,
  FileText,
  List,
  Save,
  X,
  Pencil,
  Type,
  CheckCircle2,
  Image,
  Package,
  MoreVertical,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { XMLStructure, XMLField } from '@/lib/xml-template-service';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

interface TreeNode {
  id: string;
  name: string;
  value?: string;
  type: 'category' | 'field';
  category?: string;
  children?: TreeNode[];
  fieldData?: XMLField;
  isExpanded?: boolean;
}

interface InteractiveXmlTreeProps {
  structure: XMLStructure;
  xmlContent?: string;
  onSave?: (structure: XMLStructure) => void;
}

// Отдельный компонент для узла дерева с сортировкой
function SortableTreeNode({
  node,
  level,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onDuplicate,
  parentCategory
}: {
  node: TreeNode;
  level: number;
  onToggle: (id: string) => void;
  onEdit: (id: string, name: string, value: string) => void;
  onDelete: (id: string) => void;
  onAdd: (parentId: string) => void;
  onDuplicate: (id: string) => void;
  parentCategory?: string;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(node.name);
  const [editValue, setEditValue] = React.useState(node.value || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled: node.type === 'category', // Категории не перетаскиваем
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onEdit(node.id, editName, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(node.name);
    setEditValue(node.value || '');
    setIsEditing(false);
  };

  const handleCopy = () => {
    // Копируем значение в буфер обмена
    const textToCopy = node.value || node.name;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Скопійовано');
  };

  const getIcon = (node: TreeNode) => {
    const iconClass = "h-4 w-4 text-primary";
    
    const path = node.fieldData?.path?.toLowerCase() || node.name.toLowerCase();
    
    // Атрибуты
    if (path.startsWith('@') || node.name.startsWith('@')) {
      return <Tag className={iconClass} />;
    }
    // ID поля
    if (path.includes('id')) {
      return <Hash className={iconClass} />;
    }
    // Цены
    if (path.includes('price') || path.includes('cost') || path.includes('rate')) {
      return <DollarSign className={iconClass} />;
    }
    // Изображения
    if (path.includes('image') || path.includes('picture') || path.includes('photo')) {
      return <Image className={iconClass} />;
    }
    // Наличие
    if (path.includes('available') || path.includes('stock')) {
      return <CheckCircle2 className={iconClass} />;
    }
    // Названия
    if (path.includes('name') || path.includes('title')) {
      return <Type className={iconClass} />;
    }
    // Товары
    if (path.includes('product') || path.includes('item') || path.includes('offer')) {
      return <Package className={iconClass} />;
    }
    // Валюты
    if (path.includes('currency')) {
      return <DollarSign className={iconClass} />;
    }
    // Категории
    if (path.includes('categor')) {
      return <List className={iconClass} />;
    }
    // Описания
    if (path.includes('description')) {
      return <FileText className={iconClass} />;
    }
    // URL
    if (path.includes('url') || path.includes('link')) {
      return <Tag className={iconClass} />;
    }
    
    return <FileText className={iconClass} />;
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded group overflow-hidden"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {/* Menu - 3 точки СЛЕВА, видны при hover */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-accent"
                  title="Меню"
                >
                  <MoreVertical className="h-4 w-4 text-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Редагувати
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(node.id)}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Дублювати
                </DropdownMenuItem>
                {node.children && node.children.length > 0 && (
                  <DropdownMenuItem onClick={() => onAdd(node.id)}>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Додати
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Копіювати текст
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(node.id)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Видалити
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Drag Handle - СПРАВА от меню */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 flex-shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Expand/Collapse */}
        <div onClick={() => node.children && node.children.length > 0 && onToggle(node.id)} className="cursor-pointer flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {node.children && node.children.length > 0 && (
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {node.isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
          {!(node.children && node.children.length > 0) && <div className="w-4 flex-shrink-0" />}

          {/* Icon */}
          <div className="flex-shrink-0">
            {getIcon(node)}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-6 text-xs font-mono px-1"
                style={{ width: `${Math.max(editName.length * 8 + 16, 100)}px`, minWidth: '100px' }}
                placeholder="Назва"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-6 text-xs font-mono px-1"
                style={{ width: `${Math.max(editValue.length * 7 + 16, 150)}px`, minWidth: '150px' }}
                placeholder="Значення"
              />
              <Button size="sm" variant="default" onClick={handleSave} className="h-6 w-6 p-0 flex-shrink-0" title="Зберегти">
                <Save className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-6 w-6 p-0 flex-shrink-0" title="Скасувати">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              <span className="font-mono text-base font-medium text-foreground flex-shrink-0">{node.name}</span>
              {node.value && !node.children && (
                <>
                  <span className="text-muted-foreground flex-shrink-0">:</span>
                  <span className="font-mono text-base text-muted-foreground inline-block truncate max-w-[400px]" title={node.value}>{node.value}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children - КАК В МОДАЛКЕ просто рендерим */}
      {node.isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <SortableTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdd={onAdd}
              onDuplicate={onDuplicate}
              parentCategory={node.type === 'category' ? node.name : parentCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InteractiveXmlTree({ structure, xmlContent, onSave }: InteractiveXmlTreeProps) {
  // Парсим XML напрямую если есть (приоритет: xmlContent prop, потом structure.originalXml)
  const xml = xmlContent || structure.originalXml;
  const prevXmlRef = React.useRef(xml);

  const buildTree = React.useCallback((obj: any, parentPath = '', parentName = ''): TreeNode[] => {
    const nodes: TreeNode[] = [];
    let textValue: string | null = null;
    let nodeId = 0;

    if (obj._text !== undefined) {
      textValue = String(obj._text);
    }

    // Сначала собираем атрибуты (@date, @version, @id и т.д.), потом остальные
    const attributes: [string, any][] = [];
    const others: [string, any][] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('@')) {
        attributes.push([key, value]);
      } else if (key !== '_text') {
        others.push([key, value]);
      }
    }
    
    // Для param - показываем в формате: @name → _text → @paramid → @valueid
    const isParam = parentName === 'param';
    
    if (isParam) {
      // Специальная обработка для param
      const nameAttr = attributes.find(([k]) => k === '@name');
      const paramidAttr = attributes.find(([k]) => k === '@paramid');
      const valueidAttr = attributes.find(([k]) => k === '@valueid');
      const valueField = others.find(([k]) => k === 'value');
      
      // 1. Название характеристики (@name)
      if (nameAttr) {
        const currentPath = parentPath ? `${parentPath}-${nameAttr[0]}` : nameAttr[0];
        nodes.push({
          id: `${currentPath}-${nodeId++}`,
          name: '@name',
          value: String(nameAttr[1]),
          type: 'field'
        });
      }
      
      // 2. Значение (_text или value)
      if (textValue !== null) {
        const currentPath = parentPath ? `${parentPath}-value` : 'value';
        nodes.push({
          id: `${currentPath}-${nodeId++}`,
          name: 'value',
          value: textValue,
          type: 'field'
        });
      } else if (valueField) {
        const [, val] = valueField;
        const currentPath = parentPath ? `${parentPath}-value` : 'value';
        if (typeof val === 'object' && val !== null) {
          // Вложенные <value lang="uk"> и <value lang="ru">
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: 'value',
            children: buildTree(val, currentPath, 'value'),
            type: 'field',
            isExpanded: true
          });
        } else {
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: 'value',
            value: String(val),
            type: 'field'
          });
        }
      }
      
      // 3. ID параметра (@paramid)
      if (paramidAttr) {
        const currentPath = parentPath ? `${parentPath}-${paramidAttr[0]}` : paramidAttr[0];
        nodes.push({
          id: `${currentPath}-${nodeId++}`,
          name: '@paramid',
          value: String(paramidAttr[1]),
          type: 'field'
        });
      }
      
      // 4. ID значения (@valueid)
      if (valueidAttr) {
        const currentPath = parentPath ? `${parentPath}-${valueidAttr[0]}` : valueidAttr[0];
        nodes.push({
          id: `${currentPath}-${nodeId++}`,
          name: '@valueid',
          value: String(valueidAttr[1]),
          type: 'field'
        });
      }
      
      // Обработка остальных атрибутов и полей, которые не были обработаны
      for (const [key, value] of attributes) {
        if (!['@name', '@paramid', '@valueid'].includes(key)) {
          const currentPath = parentPath ? `${parentPath}-${key}` : key;
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: key,
            value: String(value),
            type: 'field'
          });
        }
      }
      
      for (const [key, value] of others) {
        if (key !== 'value') {
          const currentPath = parentPath ? `${parentPath}-${key}` : key;
          
          if (Array.isArray(value)) {
            const children: TreeNode[] = [];
            value.forEach((item, idx) => {
              if (typeof item === 'object') {
                children.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: key,
                  children: buildTree(item, `${currentPath}-${idx}`, key),
                  type: 'field',
                  isExpanded: true
                });
              } else {
                children.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: key,
                  value: String(item),
                  type: 'field'
                });
              }
            });
            nodes.push({
              id: `${currentPath}-${nodeId++}`,
              name: key,
              children,
              type: 'field',
              isExpanded: true
            });
          } else if (typeof value === 'object' && value !== null) {
            nodes.push({
              id: `${currentPath}-${nodeId++}`,
              name: key,
              children: buildTree(value, currentPath, key),
              type: 'field',
              isExpanded: true
            });
          } else {
            nodes.push({
              id: `${currentPath}-${nodeId++}`,
              name: key,
              value: String(value),
              type: 'field'
            });
          }
        }
      }
    } else {
      // Обычная обработка для не-param элементов
      // Обрабатываем атрибуты ПЕРВЫМИ (включая @date из yml_catalog)
      for (const [key, value] of attributes) {
        const currentPath = parentPath ? `${parentPath}-${key}` : key;
        nodes.push({
          id: `${currentPath}-${nodeId++}`,
          name: key, // Оставляем @ в имени (@date, @id, @available)
          value: String(value),
          type: 'field'
        });
      }
      
      // Потом обрабатываем остальные поля
      for (const [key, value] of others) {
        const currentPath = parentPath ? `${parentPath}-${key}` : key;
        
        if (key.startsWith('@')) {
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: key.substring(1),
            value: String(value),
            type: 'field'
          });
        } else if (key === '_text') {
          continue;
        } else if (Array.isArray(value)) {
          // МАССИВ - специальная обработка для param
          if (key === 'param') {
            // Каждый param - отдельный узел
            value.forEach((item, idx) => {
              if (typeof item === 'object') {
                nodes.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: 'param',
                  children: buildTree(item, `${currentPath}-${idx}`, 'param'),
                  type: 'field',
                  isExpanded: true
                });
              } else {
                nodes.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: 'param',
                  value: String(item),
                  type: 'field'
                });
              }
            });
          } else {
            // Обычный массив - каждый элемент отдельно под родителем (БЕЗ индексов в имени)
            console.log(`[buildTree] Массив найден: ${key}, элементов: ${value.length}`, value);
            const children: TreeNode[] = [];
            value.forEach((item, idx) => {
              if (typeof item === 'object') {
                children.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: key,
                  children: buildTree(item, `${currentPath}-${idx}`, key),
                  type: 'field',
                  isExpanded: true
                });
              } else {
                children.push({
                  id: `${currentPath}-${idx}-${nodeId++}`,
                  name: key,
                  value: String(item),
                  type: 'field'
                });
              }
            });
            console.log(`[buildTree] Создано детей для ${key}:`, children.length);
            nodes.push({
              id: `${currentPath}-${nodeId++}`,
              name: key,
              children,
              type: 'field',
              isExpanded: true
            });
          }
        } else if (typeof value === 'object' && value !== null) {
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: key,
            children: buildTree(value, currentPath, key),
            type: 'field',
            isExpanded: true
          });
        } else {
          // Простое значение - проверяем, может это массив в виде строки
          const strValue = String(value);
          const isArrayLike = strValue.startsWith('[') && strValue.endsWith(']');
          
          if (isArrayLike) {
            // Парсим массив из строки
            const items = strValue
              .slice(1, -1)
              .split(',')
              .map(u => u.trim().replace(/^['"]|['"]$/g, ''))
              .filter(u => u.length > 0);
            
            if (items.length > 0) {
              const children: TreeNode[] = items.map((item, idx) => ({
                id: `${currentPath}-${idx}-${nodeId++}`,
                name: key, // Убрали [${idx}]
                value: item,
                type: 'field'
              }));
              
              nodes.push({
                id: `${currentPath}-${nodeId++}`,
                name: key,
                children,
                type: 'field',
                isExpanded: true
              });
              continue;
            }
          }
          
          // Обычное значение
          nodes.push({
            id: `${currentPath}-${nodeId++}`,
            name: key,
            value: strValue,
            type: 'field'
          });
        }
      }

      if (textValue !== null && nodes.length > 0) {
        nodes.push({
          id: `${parentPath}-value-${nodeId++}`,
          name: 'value',
          value: textValue,
          type: 'field'
        });
      }
    }

    return nodes;
  }, []);

  const buildTreeFromStructure = React.useCallback((structure: XMLStructure, xml?: string): TreeNode[] => {
    if (xml) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@',
        textNodeName: '_text',
        parseAttributeValue: true,
        parseTagValue: true,
      });

      const parsed = parser.parse(xml);
      return buildTree(parsed);
    }

    const obj: any = {};

    structure.fields.forEach(field => {
      const parts = field.path.split('.');
      let current = obj;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        const arrayMatch = part.match(/(.+)\[(\d+)\]/);
        if (arrayMatch) {
          const [, name, index] = arrayMatch;
          const idx = parseInt(index);

          if (!current[name]) current[name] = [];

          if (isLast) {
            current[name][idx] = field.sample;
          } else {
            if (!current[name][idx]) current[name][idx] = {};
            current = current[name][idx];
          }
        } else {
          if (isLast) {
            current[part] = field.sample;
          } else {
            if (!current[part]) current[part] = {};
            current = current[part];
          }
        }
      }
    });

    return buildTree(obj);
  }, [buildTree]);

  const buildTreeFromFields = (fields: XMLField[]): TreeNode[] => {
    // Fallback если нет XML
    return fields.map((f, i) => ({
      id: `field-${i}`,
      name: f.path.split('.').pop() || f.path,
      value: f.sample,
      type: 'field' as const
    }));
  };

  const [treeData, setTreeData] = React.useState<TreeNode[]>(() => 
    buildTreeFromStructure(structure, xml)
  );

  // Пересоздаем дерево ТОЛЬКО при изменении XML контента
  React.useEffect(() => {
    const currentXml = xmlContent || structure.originalXml;
    // Проверяем что XML действительно изменился
    if (currentXml && currentXml !== prevXmlRef.current) {
      console.log('XML изменился, пересоздаем дерево');
      prevXmlRef.current = currentXml;
      setTreeData(buildTreeFromStructure(structure, currentXml));
    }
  }, [structure, xmlContent, buildTreeFromStructure]);

  // Автосохранение при изменении дерева (с защитой от зацикливания)
  const isSavingRef = React.useRef(false);
  
  React.useEffect(() => {
    if (!onSave || !xml || isSavingRef.current) return;

    const saveToStructure = async () => {
      try {
        isSavingRef.current = true;
        
        // Конвертируем дерево в объект
        const treeToObject = (nodes: TreeNode[]): any => {
          const result: any = {};
          
          // Группируем узлы по имени для обработки массивов
          const grouped = new Map<string, TreeNode[]>();
          nodes.forEach(node => {
            const existing = grouped.get(node.name) || [];
            existing.push(node);
            grouped.set(node.name, existing);
          });
          
          // Обрабатываем каждую группу
          grouped.forEach((nodeGroup, name) => {
            if (nodeGroup.length === 1) {
              // Одиночный элемент
              const node = nodeGroup[0];
              if (node.children && node.children.length > 0) {
                result[name] = treeToObject(node.children);
              } else if (node.value !== undefined) {
                result[name] = node.value;
              } else {
                result[name] = '';
              }
            } else {
              // Массив элементов (дублированные или множественные)
              result[name] = nodeGroup.map(node => {
                if (node.children && node.children.length > 0) {
                  return treeToObject(node.children);
                } else if (node.value !== undefined) {
                  return node.value;
                } else {
                  return '';
                }
              });
            }
          });
          
          return result;
        };

        const xmlObject = treeToObject(treeData);
        
        const builder = new XMLBuilder({
          ignoreAttributes: false,
          attributeNamePrefix: '@',
          textNodeName: '_text',
          format: true,
          indentBy: '  ',
          suppressEmptyNode: false,
        });

        const newXmlContent = builder.build(xmlObject);
        
        // Обновляем только если XML действительно изменился
        if (newXmlContent !== prevXmlRef.current) {
          // Парсим новый XML напрямую
          const { XMLParser } = await import('fast-xml-parser');
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@',
            textNodeName: '_text',
            parseAttributeValue: true,
            parseTagValue: true,
            trimValues: true,
            processEntities: true,
            allowBooleanAttributes: true,
            isArray: (name, jpath) => {
              if (['currencies.currency', 'categories.category', 'offers.offer', 'offer.picture', 'offer.param'].includes(jpath)) {
                return true;
              }
              if (jpath.match(/\.(param|params|image|images|picture|pictures|photo|photos|category|categories|currency|currencies)$/)) {
                return true;
              }
              return false;
            }
          });
          
          const parsed = parser.parse(newXmlContent);
          
          // Используем метод extractStructure из XMLTemplateService
          const { XMLTemplateService } = await import('@/lib/xml-template-service');
          const service = new XMLTemplateService();
          
          // Устанавливаем формат из текущей структуры
          (service as any).detectedFormat = (service as any).detectXMLFormat(parsed);
          
          // Извлекаем структуру
          const newStructure = (service as any).extractStructure(parsed);
          newStructure.originalXml = newXmlContent;
          
          const updatedStructure: XMLStructure = {
            ...structure,
            originalXml: newXmlContent,
            fields: newStructure.fields,
          };
          
          prevXmlRef.current = newXmlContent;
          onSave(updatedStructure);
        }
        
        isSavingRef.current = false;
      } catch (error) {
        console.error('Auto-save error:', error);
        isSavingRef.current = false;
      }
    };

    const timeoutId = setTimeout(saveToStructure, 500);
    return () => clearTimeout(timeoutId);
  }, [treeData, xml, structure, onSave]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const handleToggle = (id: string) => {
    setTreeData(prev => {
      const toggle = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
            return { ...node, children: toggle(node.children) };
          }
          return node;
        });
      };
      return toggle(prev);
    });
  };

  const handleEdit = (id: string, name: string, value: string) => {
    setTreeData(prev => {
      const edit = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, name, value };
          }
          if (node.children) {
            return { ...node, children: edit(node.children) };
          }
          return node;
        });
      };
      return edit(prev);
    });
    toast.success('Зміни збережено локально');
  };

  const handleDelete = (id: string) => {
    setTreeData(prev => {
      const deleteNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes
          .filter(node => node.id !== id)
          .map(node => ({
            ...node,
            children: node.children ? deleteNode(node.children) : undefined
          }));
      };
      return deleteNode(prev);
    });
    toast.success('Поле видалено');
  };

  const handleAdd = (parentId: string) => {
    setTreeData(prev => {
      const timestamp = Date.now();
      
      const addToNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            const newField: TreeNode = {
              id: `field-${parentId}-${timestamp}`,
              name: 'нове_поле',
              value: '',
              type: 'field',
              category: node.category,
              isExpanded: true
            };
            
            return {
              ...node,
              children: [...(node.children || []), newField],
              isExpanded: true
            };
          }
          if (node.children) {
            return { ...node, children: addToNode(node.children) };
          }
          return node;
        });
      };
      
      return addToNode(prev);
    });
    toast.success('Поле додано');
  };

  const handleDuplicate = (id: string) => {
    setTreeData(prev => {
      const timestamp = Date.now();
      
      const duplicateNode = (nodes: TreeNode[], parentNodes?: TreeNode[]): TreeNode[] => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          
          if (node.id === id) {
            // Нашли узел - дублируем его
            const duplicateNodeRecursive = (original: TreeNode, suffix: string): TreeNode => {
              return {
                ...original,
                id: `${original.id}-copy-${suffix}`,
                children: original.children?.map((child, idx) => 
                  duplicateNodeRecursive(child, `${suffix}-${idx}`)
                )
              };
            };
            
            const newNode = duplicateNodeRecursive(node, String(timestamp));
            
            // Вставляем сразу после оригинала
            const newNodes = [...nodes];
            newNodes.splice(i + 1, 0, newNode);
            return newNodes;
          }
          
          if (node.children) {
            const updatedChildren = duplicateNode(node.children, nodes);
            if (updatedChildren !== node.children) {
              const newNodes = [...nodes];
              newNodes[i] = { ...node, children: updatedChildren };
              return newNodes;
            }
          }
        }
        return nodes;
      };
      
      return duplicateNode(prev);
    });
    toast.success('Елемент продубльовано');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTreeData(prev => {
      const reorder = (nodes: TreeNode[]): TreeNode[] => {
        // Находим категорию с элементами для сортировки
        return nodes.map(node => {
          if (node.children) {
            const oldIndex = node.children.findIndex(c => c.id === active.id);
            const newIndex = node.children.findIndex(c => c.id === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
              return {
                ...node,
                children: arrayMove(node.children, oldIndex, newIndex)
              };
            }
            
            return { ...node, children: reorder(node.children) };
          }
          return node;
        });
      };
      return reorder(prev);
    });
  };

  const handleSaveAll = () => {
    // Если дерево построено из XML - конвертируем обратно в XML
    if (xml) {
      try {
        // Конвертируем дерево обратно в объект
        const treeToObject = (nodes: TreeNode[]): any => {
          const result: any = {};
          
          nodes.forEach(node => {
            const key = node.name;
            
            if (node.children && node.children.length > 0) {
              // Проверяем, это массив или объект
              const isArray = node.children.every(child => 
                child.name.match(/\[\d+\]$/)
              );
              
              if (isArray) {
                // Это массив
                const arrayKey = key.replace(/\[\d+\]$/, '');
                if (!result[arrayKey]) result[arrayKey] = [];
                
                const childObj = treeToObject(node.children);
                result[arrayKey].push(childObj);
              } else {
                // Это объект
                result[key] = treeToObject(node.children);
              }
            } else if (node.value !== undefined) {
              // Простое значение
              result[key] = node.value;
            }
          });
          
          return result;
        };
        
        const xmlObject = treeToObject(treeData);
        
        // Конвертируем объект обратно в XML
        const builder = new XMLBuilder({
          ignoreAttributes: false,
          attributeNamePrefix: '@',
          textNodeName: '_text',
          format: true,
          indentBy: '  ',
          suppressEmptyNode: false,
        });
        
        const newXmlContent = builder.build(xmlObject);
        
        // Обновляем originalXml в структуре
        const updatedStructure: XMLStructure = {
          ...structure,
          originalXml: newXmlContent
        };
        
        if (onSave) {
          onSave(updatedStructure);
        }
        
        toast.success('Зміни збережено!');
        return;
      } catch (error) {
        console.error('Save error:', error);
        toast.error('Помилка збереження: ' + (error as Error).message);
        return;
      }
    }
    
    // Преобразуем дерево обратно в XMLStructure (только для fallback режима)
    const fields: XMLField[] = [];
    
    const extractFields = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'field' && node.fieldData) {
          // Обновляем sample из текущих значений
          const updatedField = {
            ...node.fieldData,
            sample: node.value
          };
          
          // Для валют и характеристик нужно обновить связанные поля
          if (node.category === 'Валюти' && node.fieldData.path.includes('@id')) {
            fields.push({ ...updatedField, sample: node.name }); // @id поле
            const ratePath = node.fieldData.path.replace('@id', '@rate');
            fields.push({
              path: ratePath,
              type: 'string',
              required: false,
              sample: node.value,
              category: node.category,
              order: updatedField.order! + 1
            });
          } else if (node.category === 'Характеристики товару' && node.fieldData.path.includes('@name')) {
            fields.push({ ...updatedField, sample: node.name }); // @name поле
            const basePath = node.fieldData.path.replace('.@name', '');
            fields.push({
              path: basePath + '._text',
              type: 'string',
              required: false,
              sample: node.value,
              category: node.category,
              order: updatedField.order! + 1
            });
          } else {
            // Обычное поле - обновляем path если изменилось имя
            const pathParts = updatedField.path.split('.');
            pathParts[pathParts.length - 1] = node.name;
            fields.push({
              ...updatedField,
              path: pathParts.join('.'),
              sample: node.value
            });
          }
        }
        
        if (node.children) {
          extractFields(node.children);
        }
      });
    };
    
    extractFields(treeData);
    
    const updatedStructure: XMLStructure = {
      ...structure,
      fields
    };
    
    if (onSave) {
      onSave(updatedStructure);
      toast.success('Всі зміни збережено!');
    }
  };

  // Получаем все ID для DnD контекста
  const getAllIds = (nodes: TreeNode[]): string[] => {
    const ids: string[] = [];
    nodes.forEach(node => {
      ids.push(node.id);
      if (node.children) {
        ids.push(...getAllIds(node.children));
      }
    });
    return ids;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="bg-card">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={getAllIds(treeData)}
                strategy={verticalListSortingStrategy}
              >
                {treeData.map((node) => (
                  <SortableTreeNode
                    key={node.id}
                    node={node}
                    level={0}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAdd={handleAdd}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
