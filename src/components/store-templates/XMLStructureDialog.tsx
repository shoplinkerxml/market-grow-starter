import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XmlPreviewViewer } from './XmlPreviewViewer';
import { InteractiveXmlTree } from './InteractiveXmlTree';

export interface XMLStructureMapping {
  formatType: 'rozetka' | 'epicentr' | 'prom' | 'price' | 'mma' | 'google_shopping' | 'custom';
  rootTag: string;
  productTag: string;
  categoryTag: string;
  currencyTag: string;
  paramTag: string;
}

interface XMLStructureDialogProps {
  open: boolean;
  onConfirm: (mapping: XMLStructureMapping) => void;
  onCancel: () => void;
  detectedRoot?: string;
  xmlPreview?: string;
  detectedFormat?: XMLStructureMapping['formatType'];
}

export const XMLStructureDialog = ({
  open,
  onConfirm,
  onCancel,
  detectedRoot = '',
  xmlPreview = '',
  detectedFormat = 'custom'
}: XMLStructureDialogProps) => {
  const [formatType, setFormatType] = useState<XMLStructureMapping['formatType']>(detectedFormat);
  const [rootTag, setRootTag] = useState(detectedRoot);
  const [productTag, setProductTag] = useState('');
  const [categoryTag, setCategoryTag] = useState('');
  const [currencyTag, setCurrencyTag] = useState('');
  const [paramTag, setParamTag] = useState('param');

  // При изменении detectedFormat обновляем formatType
  useEffect(() => {
    if (detectedFormat && detectedFormat !== 'custom') {
      setFormatType(detectedFormat);
      handleFormatChange(detectedFormat);
    }
  }, [detectedFormat]);

  const handleFormatChange = (value: XMLStructureMapping['formatType']) => {
    setFormatType(value);
    
    // Предзаполнение для известных форматов
    if (value === 'rozetka') {
      setProductTag('offers.offer');
      setCategoryTag('categories.category');
      setCurrencyTag('currencies.currency');
      setParamTag('param');
    } else if (value === 'epicentr') {
      setProductTag('offers.offer');
      setCategoryTag('');
      setCurrencyTag('');
      setParamTag('param');
    } else if (value === 'google_shopping') {
      setProductTag('channel.item');
      setCategoryTag('');
      setCurrencyTag('');
      setParamTag('');
    } else if (value === 'prom') {
      setProductTag('items.item');
      setCategoryTag('catalog.category');
      setCurrencyTag('');
      setParamTag('param');
    } else if (value === 'mma') {
      setProductTag('items.item');
      setCategoryTag('catalog.category');
      setCurrencyTag('currency');
      setParamTag('param');
    } else if (value === 'price') {
      setProductTag('items.item');
      setCategoryTag('categories.category');
      setCurrencyTag('currency');
      setParamTag('param');
    } else {
      setProductTag('');
      setCategoryTag('');
      setCurrencyTag('');
      setParamTag('param');
    }
  };

  const handleConfirm = () => {
    onConfirm({
      formatType,
      rootTag,
      productTag,
      categoryTag,
      currencyTag,
      paramTag
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" noOverlay>
        <DialogHeader>
          <DialogTitle>Визначення структури XML</DialogTitle>
          <DialogDescription>
            Вкажіть теги які відповідають за різні розділи в вашому XML файлі
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_2fr] gap-6 flex-1 overflow-hidden">
          {/* Ліва колонка - форма */}
          <div className="space-y-4 overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Тип формату</Label>
              <Select value={formatType} onValueChange={handleFormatChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rozetka">Rozetka</SelectItem>
                  <SelectItem value="epicentr">Epicentr</SelectItem>
                  <SelectItem value="google_shopping">Google Shopping</SelectItem>
                  <SelectItem value="prom">Prom</SelectItem>
                  <SelectItem value="mma">MMA</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="custom">Власний формат</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="root">Кореневий тег</Label>
              <Input
                id="root"
                value={rootTag}
                onChange={(e) => setRootTag(e.target.value)}
                placeholder="yml_catalog, shop, price"
              />
              <p className="text-xs text-muted-foreground">
                Наприклад: yml_catalog, shop, price
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Тег товару *</Label>
              <Input
                id="product"
                value={productTag}
                onChange={(e) => setProductTag(e.target.value)}
                placeholder="offers.offer, items.item"
              />
              <p className="text-xs text-muted-foreground">
                Шлях до товарів: offers.offer, items.item, products.product
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Тег категорій</Label>
              <Input
                id="category"
                value={categoryTag}
                onChange={(e) => setCategoryTag(e.target.value)}
                placeholder="categories.category"
              />
              <p className="text-xs text-muted-foreground">
                Шлях до категорій: categories.category, catalog.category
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Тег валют</Label>
              <Input
                id="currency"
                value={currencyTag}
                onChange={(e) => setCurrencyTag(e.target.value)}
                placeholder="currencies.currency"
              />
              <p className="text-xs text-muted-foreground">
                Шлях до валют (якщо є): currencies.currency
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="param">Тег характеристик</Label>
              <Input
                id="param"
                value={paramTag}
                onChange={(e) => setParamTag(e.target.value)}
                placeholder="param"
              />
              <p className="text-xs text-muted-foreground">
                Назва тегу характеристик всередині товару: param, characteristic
              </p>
            </div>
          </div>

          {/* Права колонка - превью XML */}
          <div className="flex flex-col overflow-hidden">
            <div className="mb-2">
              <Label>Превью XML файлу</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Скопіюйте назви тегів з цього превью
              </p>
            </div>
            <InteractiveXmlTree 
              structure={{ 
                root: '', 
                fields: [], 
                originalXml: xmlPreview || '' 
              }}
              xmlContent={xmlPreview || '<загрузка...>'}
              onSave={() => {}}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Скасувати
          </Button>
          <Button onClick={handleConfirm} disabled={!productTag}>
            Підтвердити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
