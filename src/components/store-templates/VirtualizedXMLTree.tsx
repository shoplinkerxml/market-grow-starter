import { FixedSizeList } from 'react-window';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { XMLField } from '@/lib/xml-template-service';
import { useI18n } from "@/i18n";

interface VirtualizedXMLTreeProps {
  items: XMLField[];
}

export const VirtualizedXMLTree = ({ items }: VirtualizedXMLTreeProps) => {
  const { t } = useI18n();
  
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    
    return (
      <div 
        style={style} 
        className="border-b p-3 hover:bg-gray-50 flex items-center justify-between"
      >
        <div className="flex-1">
          <div className="font-mono text-sm font-medium">{item.path}</div>
          {item.sample && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {item.sample}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {item.type}
          </Badge>
          {item.required && (
            <Badge variant="destructive" className="text-xs">
              Required
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('xml_structure')} ({items.length} {t('fields_found')})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <FixedSizeList
          height={600}
          itemCount={items.length}
          itemSize={70}
          width="100%"
        >
          {Row}
        </FixedSizeList>
      </CardContent>
    </Card>
  );
};
