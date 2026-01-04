import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { XMLTemplateService } from '@/lib/xml-template-service';
import { toast } from 'sonner';
import { useI18n } from "@/i18n";
import { XMLStructureDialog, type XMLStructureMapping } from './XMLStructureDialog';
import type { XMLParseResult } from '@/lib/xml-template-service';

export const XMLUploader = ({ onParsed }: { onParsed?: (result: XMLParseResult) => void }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showStructureDialog, setShowStructureDialog] = useState(false);
  const [pendingSource, setPendingSource] = useState<File | string | null>(null);
  const [xmlPreview, setXmlPreview] = useState('');
  const [detectedFormatType, setDetectedFormatType] = useState<'rozetka' | 'epicentr' | 'prom' | 'price' | 'mma' | 'google_shopping' | 'custom'>('custom');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xml')) {
      toast.error(t('xml_parse_error'));
      return;
    }

    setFile(selectedFile);
    setPendingSource(selectedFile);
    
    // Читаем первые 50 строк для превью и определяем формат
    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').slice(0, 50);
      setXmlPreview(lines.join('\n') + (text.split('\n').length > 50 ? '\n\n... (файл обрізано для перегляду)' : ''));
      
      // Определяем формат
      const lowerText = text.toLowerCase();
      if (lowerText.includes('<rss') && (lowerText.includes('g:id') || lowerText.includes('g:price') || lowerText.includes('g:link'))) {
        setDetectedFormatType('google_shopping');
      } else if (lowerText.includes('yml_catalog') && lowerText.includes('categories') && lowerText.includes('currencies')) {
        setDetectedFormatType('rozetka');
      } else if (lowerText.includes('yml_catalog') || (lowerText.includes('offers') && lowerText.includes('offer'))) {
        setDetectedFormatType('epicentr');
      } else if (lowerText.includes('<price>') && lowerText.includes('<currency') && lowerText.includes('<catalog>')) {
        setDetectedFormatType('mma');
      } else if (lowerText.includes('<price>') && lowerText.includes('<items>')) {
        setDetectedFormatType('price');
      } else if (lowerText.includes('<shop>') && lowerText.includes('<items>')) {
        setDetectedFormatType('prom');
      } else {
        setDetectedFormatType('custom');
      }
    } catch (error) {
      console.error('Error reading XML preview:', error);
    }
    
    setShowStructureDialog(true);
  };

  const handleUrlSubmit = async () => {
    if (!url) {
      toast.error(t('enter_xml_url'));
      return;
    }

    setPendingSource(url);
    
    // Загружаем превью для URL и определяем формат
    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.split('\n').slice(0, 50);
      setXmlPreview(lines.join('\n') + (text.split('\n').length > 50 ? '\n\n... (файл обрізано для перегляду)' : ''));
      
      // Определяем формат
      const lowerText = text.toLowerCase();
      if (lowerText.includes('<rss') && (lowerText.includes('g:id') || lowerText.includes('g:price') || lowerText.includes('g:link'))) {
        setDetectedFormatType('google_shopping');
      } else if (lowerText.includes('yml_catalog') && lowerText.includes('categories') && lowerText.includes('currencies')) {
        setDetectedFormatType('rozetka');
      } else if (lowerText.includes('yml_catalog') || (lowerText.includes('offers') && lowerText.includes('offer'))) {
        setDetectedFormatType('epicentr');
      } else if (lowerText.includes('<price>') && lowerText.includes('<currency') && lowerText.includes('<catalog>')) {
        setDetectedFormatType('mma');
      } else if (lowerText.includes('<price>') && lowerText.includes('<items>')) {
        setDetectedFormatType('price');
      } else if (lowerText.includes('<shop>') && lowerText.includes('<items>')) {
        setDetectedFormatType('prom');
      } else {
        setDetectedFormatType('custom');
      }
    } catch (error) {
      console.error('Error loading XML preview:', error);
      setXmlPreview('Помилка завантаження превью');
    }
    
    setShowStructureDialog(true);
  };

  const handleStructureConfirm = async (mapping: XMLStructureMapping) => {
    setShowStructureDialog(false);
    if (pendingSource) {
      await parseXML(pendingSource, mapping);
      setPendingSource(null);
    }
  };

  const handleStructureCancel = () => {
    setShowStructureDialog(false);
    setPendingSource(null);
    setXmlPreview('');
  };

  const parseXML = async (source: File | string, mapping: XMLStructureMapping) => {
    setLoading(true);
    try {
      const service = new XMLTemplateService();
      const result = await service.parseXML(source, mapping);
      
      toast.success(`${t('xml_loaded')}! ${result.stats.itemsCount} ${t('items_found')}`);
      
      if (onParsed) {
        onParsed(result);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(t('xml_parse_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <XMLStructureDialog
        open={showStructureDialog}
        onConfirm={handleStructureConfirm}
        onCancel={handleStructureCancel}
        xmlPreview={xmlPreview}
        detectedFormat={detectedFormatType}
      />
      
      <Card>
      <CardHeader>
        <CardTitle>{t('upload_xml')}</CardTitle>
        <CardDescription>
          {t('drag_drop_xml')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">{t('xml_file')}</TabsTrigger>
            <TabsTrigger value="url">{t('xml_url')}</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="xml-file">{t('xml_file')}</Label>
              <div className="flex items-center gap-2">
                <label htmlFor="xml-file" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>{file ? file.name : t('xml_file')}</span>
                  </div>
                  <Input
                    id="xml-file"
                    type="file"
                    accept=".xml"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="xml-url">{t('enter_xml_url')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="xml-url"
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                />
                <Button
                  onClick={handleUrlSubmit}
                  disabled={loading || !url}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                  {t('load_xml')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    </>
  );
};
