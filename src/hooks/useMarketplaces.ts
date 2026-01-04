import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceOption {
  value: string;
  label: string;
}

export type TemplatesMap = Record<string, { id: string; xml_structure: unknown; mapping_rules: unknown }>;

export const useMarketplaces = (enabled: boolean = true) => {
  const [marketplaces, setMarketplaces] = useState<MarketplaceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [templatesMap, setTemplatesMap] = useState<TemplatesMap>({});

  useEffect(() => {
    const fetchMarketplaces = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const cacheKey = 'rq:marketplaces:list';
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
          if (raw) {
            const parsed = JSON.parse(raw) as { items: string[]; templatesByMarketplace?: TemplatesMap; expiresAt: number };
            const hasValidItems = parsed && Array.isArray(parsed.items) && parsed.items.length > 0;
            const notExpired = parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now();
            const tm = parsed?.templatesByMarketplace || {};
            const hasTemplates = tm && Object.keys(tm).length > 0;
            if (hasValidItems && notExpired && hasTemplates) {
              setMarketplaces(parsed.items.map((m) => ({ value: m, label: m })));
              setTemplatesMap(tm);
              setIsLoading(false);
              return;
            }
            // If cache exists but without templates, fall through to fetch and upgrade cache
          }
        } catch (e) { void 0; }

        type InvokeArgs = { body?: unknown }
        type InvokeResult<T> = Promise<{ data: T; error?: { message?: string } }>
        const { data, error: fnError } = await (supabase as unknown as { functions: { invoke: <T = unknown>(name: string, args: InvokeArgs) => InvokeResult<T> } }).functions.invoke('store-templates-marketplaces', {
          body: {},
        });
        if (fnError) throw new Error((fnError as { message?: string })?.message || 'fetch_failed');
        const payload = typeof data === 'string' 
          ? JSON.parse(data) as { marketplaces?: string[]; templatesByMarketplace?: TemplatesMap } 
          : (data as { marketplaces?: string[]; templatesByMarketplace?: TemplatesMap });
        const items = Array.isArray(payload?.marketplaces) ? (payload.marketplaces as string[]) : [];
        const options: MarketplaceOption[] = items.map((m) => ({ value: String(m), label: String(m) }));
        const tmRaw = payload?.templatesByMarketplace || {};
        const tm: TemplatesMap = Object.fromEntries(
          Object.entries(tmRaw).map(([k, v]) => [String(k).toLowerCase().trim(), v])
        );
        
        setMarketplaces(options);
        setTemplatesMap(tm);
        try {
          const payloadStore = JSON.stringify({ items: items, templatesByMarketplace: tm, expiresAt: Date.now() + 900_000 });
          if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, payloadStore);
        } catch (e) { void 0; }
      } catch (err) {
        console.error('Error fetching marketplaces:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch marketplaces'));
      } finally {
        setIsLoading(false);
      }
    };
    if (enabled) fetchMarketplaces(); else { setIsLoading(false); }
  }, [enabled]);

  return { marketplaces, templatesMap, isLoading, error };
};
