import { useCallback } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Controls, 
  Background,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import type { XMLField, MappingRule } from '@/lib/xml-template-service';

interface VisualMapperProps {
  xmlFields: XMLField[];
  systemFields: Array<{ name: string; required: boolean; type: string }>;
  mappings: MappingRule[];
  onMappingChange: (mappings: MappingRule[]) => void;
}

export const VisualMapper = ({ 
  xmlFields, 
  systemFields, 
  mappings, 
  onMappingChange 
}: VisualMapperProps) => {
  // Левая колонка - поля XML (только листовые, без children)
  const leafXmlFields = xmlFields.filter(f => !f.children || f.children.length === 0);
  
  const sourceNodes: Node[] = leafXmlFields.map((field, idx) => ({
    id: `source-${field.path}`,
    type: 'input',
    position: { x: 0, y: idx * 80 },
    data: { 
      label: (
        <div className="text-sm">
          <div className="font-medium">{field.path}</div>
          <div className="text-xs text-muted-foreground">{field.type}</div>
        </div>
      )
    },
    style: {
      background: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: '8px',
      padding: '10px'
    }
  }));

  // Правая колонка - системные поля
  const targetNodes: Node[] = systemFields.map((field, idx) => ({
    id: `target-${field.name}`,
    type: 'output',
    position: { x: 600, y: idx * 80 },
    data: { 
      label: (
        <div className="text-sm">
          <div className="font-medium">
            {field.name}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </div>
          <div className="text-xs text-muted-foreground">{field.type}</div>
        </div>
      )
    },
    style: {
      background: '#eff6ff',
      border: '1px solid #93c5fd',
      borderRadius: '8px',
      padding: '10px'
    }
  }));

  // Связи между полями
  const initialEdges: Edge[] = mappings.map(m => ({
    id: `${m.sourceField}-${m.targetField}`,
    source: `source-${m.sourceField}`,
    target: `target-${m.targetField}`,
    animated: true,
    style: { stroke: '#10b981' }
  }));

  const [nodes] = useNodesState([...sourceNodes, ...targetNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
    
    // Обновляем маппинги
    const sourceField = connection.source?.replace('source-', '') || '';
    const targetField = connection.target?.replace('target-', '') || '';
    
    const newMapping: MappingRule = {
      sourceField,
      targetField,
      transformation: { type: 'direct' }
    };
    
    onMappingChange([...mappings, newMapping]);
  }, [mappings, onMappingChange, setEdges]);

  return (
    <Card className="h-[600px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-gray-50"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </Card>
  );
};
