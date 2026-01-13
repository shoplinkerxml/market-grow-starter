import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";

export interface MarketplaceOption {
  value: string;
  label: string;
}

export type TemplatesMap = Record<string, { id: string; xml_structure: unknown; mapping_rules: unknown }>;

const marketplacesCache = UnifiedCacheManager.create("rq:marketplaces", {
  mode: "local",
  defaultTtlMs: CACHE_TTL.marketplacesList,
});

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
        try {
          const cached = (() => {
            if (typeof window === "undefined") return null;
            const legacyKey = "rq:marketplaces:list";
            const versionedKey = `v1:${legacyKey}`;
            const tryParseEnvelope = (raw: string | null) => {
              if (!raw) return null;
              const parsed = JSON.parse(raw) as { data?: unknown; expiresAt?: unknown };
              if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;
              return parsed.data as unknown;
            };

            const fromVersioned = tryParseEnvelope(window.localStorage.getItem(versionedKey));
            if (fromVersioned && typeof fromVersioned === "object") {
              return fromVersioned as { items?: unknown; templatesByMarketplace?: TemplatesMap };
            }

            const legacyRaw = window.localStorage.getItem(legacyKey);
            if (!legacyRaw) return null;
            const legacy = JSON.parse(legacyRaw) as { items?: unknown; templatesByMarketplace?: TemplatesMap; expiresAt?: unknown };
            if (!legacy || typeof legacy.expiresAt !== "number" || legacy.expiresAt <= Date.now()) return null;
            if (!Array.isArray(legacy.items) || legacy.items.length === 0) return null;
            const tm = legacy.templatesByMarketplace || {};
            if (!tm || Object.keys(tm).length === 0) return null;

            const payload = { items: legacy.items.map((m) => String(m)), templatesByMarketplace: tm };
            marketplacesCache.set("list", payload, CACHE_TTL.marketplacesList);
            try {
              window.localStorage.removeItem(legacyKey);
            } catch {
              void 0;
            }
            return payload;
          })();

          const items = cached && Array.isArray((cached as any).items) ? ((cached as any).items as string[]) : [];
          const tm = cached && typeof (cached as any).templatesByMarketplace === "object" ? ((cached as any).templatesByMarketplace as TemplatesMap) : {};

          if (items.length > 0 && tm && Object.keys(tm).length > 0) {
            setMarketplaces(items.map((m) => ({ value: m, label: m })));
            setTemplatesMap(tm);
            setIsLoading(false);
            return;
          }
        } catch {
          void 0;
        }

        type InvokeArgs = { body?: unknown };
        type InvokeResult<T> = Promise<{ data: T; error?: { message?: string } }>;
        const { data, error: fnError } = await (supabase as unknown as {
          functions: { invoke: <T = unknown>(name: string, args: InvokeArgs) => InvokeResult<T> };
        }).functions.invoke("store-templates-marketplaces", {
          body: {},
        });
        if (fnError) throw new Error((fnError as { message?: string })?.message || "fetch_failed");
        const payload =
          typeof data === "string"
            ? (JSON.parse(data) as { marketplaces?: string[]; templatesByMarketplace?: TemplatesMap })
            : (data as { marketplaces?: string[]; templatesByMarketplace?: TemplatesMap });
        const items = Array.isArray(payload?.marketplaces) ? (payload.marketplaces as string[]) : [];
        const options: MarketplaceOption[] = items.map((m) => ({ value: String(m), label: String(m) }));
        const tmRaw = payload?.templatesByMarketplace || {};
        const tm: TemplatesMap = Object.fromEntries(Object.entries(tmRaw).map(([k, v]) => [String(k).toLowerCase().trim(), v]));
        
        setMarketplaces(options);
        setTemplatesMap(tm);
        try {
          marketplacesCache.set("list", { items, templatesByMarketplace: tm }, CACHE_TTL.marketplacesList);
        } catch {
          void 0;
        }
      } catch (err) {
        console.error("Error fetching marketplaces:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch marketplaces"));
      } finally {
        setIsLoading(false);
      }
    };
    if (enabled) fetchMarketplaces();
    else {
      setIsLoading(false);
    }
  }, [enabled]);

  return { marketplaces, templatesMap, isLoading, error };
};
