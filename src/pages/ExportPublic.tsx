import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export default function ExportPublic() {
  const { format, token } = useParams();
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const run = async () => {
      if (!format || !token) return;
      const url = `${SUPABASE_URL}/functions/v1/export-serve/export/${format}/${token}?ts=${Date.now()}`;
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token || SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(url, {
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${authToken}`,
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          setError('Не вдалося завантажити файл');
          return;
        }
        const ct = res.headers.get('Content-Type') || '';
        if ((ct.includes('xml') && format === 'xml')) {
          const txt = await res.text();
          try {
            const { XMLParser, XMLBuilder } = await import('fast-xml-parser');
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '_text', parseAttributeValue: true, parseTagValue: true });
            const obj = parser.parse(txt);
            const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '_text', format: true, indentBy: '  ', suppressEmptyNode: false });
            const pretty = builder.build(obj);
            setContent(pretty);
          } catch {
            setContent(txt);
          }
        } else {
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = objectUrl;
          downloadLink.download = format === 'xml' ? 'export.xml' : 'export.csv';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        setError('Помилка при завантаженні');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [format, token]);

  if (error) {
    return (
      <div className="p-4">
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }
  if (loading && !content) {
    return <div className="p-4 text-sm">Завантаження…</div>;
  }
  const serveUrl = `${SUPABASE_URL}/functions/v1/export-serve/export/${format}/${token}`;
  const handleDownload = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${serveUrl}?dl=1`, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        setError('Не вдалося завантажити файл');
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = format === 'xml' ? 'export.xml' : 'export.csv';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Помилка при завантаженні');
    } finally {
      setLoading(false);
    }
  };
  const handleOpen = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(serveUrl, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        setError('Не вдалося відкрити файл');
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch {
      setError('Помилка при відкритті');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-4">
      {content ? (
        <pre className="whitespace-pre-wrap text-xs overflow-auto border rounded p-3" data-testid="export_xml_viewer">{content}</pre>
      ) : (
        <div className="text-sm">Файл згенеровано. Ви можете завантажити його нижче.</div>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" onClick={handleDownload} className="h-9 px-3">Скачати</Button>
        <Button type="button" variant="outline" onClick={handleOpen} className="h-9 px-3">Відкрити</Button>
      </div>
    </div>
  );
}