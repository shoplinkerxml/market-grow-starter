import { supabase } from "@/integrations/supabase/client";
import { ProductService, type Product } from "@/lib/product-service";
import { R2Storage } from "@/lib/r2-storage";
import { invokeSupabaseFunctionWithRetry } from "@/lib/request-handler";
import { requireValidSession, type SessionValidationResult } from "./session-validation";
import { CACHE_TTL, UnifiedCacheManager } from "./cache-utils";
import { GlobalRequestDeduplicator } from "./request-deduplicator";

export type ExportLink = {
  id: string;
  store_id: string;
  format: 'xml' | 'csv';
  token: string;
  object_key: string;
  is_active: boolean;
  auto_generate?: boolean;
  last_generated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const ExportService = {
  cache: UnifiedCacheManager.create("rq:exportLinks", {
    mode: "auto",
    defaultTtlMs: CACHE_TTL.productLinks,
  }),

  async ensureSession(): Promise<SessionValidationResult> {
    const v = await requireValidSession({ requireAccessToken: false });
    if (!v.isValid || !v.user?.id) throw new Error("Invalid session");
    return v;
  },

  makeLinksCacheKey(storeId: string, userId?: string | null): string {
    const suffix = userId ? `:${userId}` : "";
    return `${storeId}${suffix}`;
  },

  invalidateLinksCache(storeId: string, userId?: string | null): void {
    ExportService.cache.remove(ExportService.makeLinksCacheKey(storeId, userId));
    try {
      GlobalRequestDeduplicator.cancelPrefix("ExportService:");
    } catch {
      void 0;
    }
  },

  async listForStore(storeId: string): Promise<ExportLink[]> {
    void storeId;
    return [];
  },

  async createLink(storeId: string, format: 'xml' | 'csv'): Promise<ExportLink | null> {
    void storeId;
    void format;
    return null;
  },

  async regenerate(storeId: string, format: 'xml' | 'csv'): Promise<boolean> {
    const session = await ExportService.ensureSession();
    try {
      const { data, error } = await invokeSupabaseFunctionWithRetry<{ success?: boolean }>(
        supabase.functions.invoke.bind(supabase.functions) as any,
        "export-generate",
        { body: { store_id: storeId, format } },
      );
      if (error) return false;
      ExportService.invalidateLinksCache(storeId, session.user?.id);
      return !!(data?.success);
    } catch {
      return false;
    }
  },

  async updateAutoGenerate(linkId: string, auto: boolean): Promise<boolean> {
    void linkId;
    void auto;
    return false;
  },

  async generateAndUpload(storeId: string, format: 'xml' | 'csv', options?: { local?: boolean }): Promise<boolean> {
    const session = await ExportService.ensureSession();
    if (options?.local) {
      return await ExportService.generateLocalAndUpload(storeId, format);
    }
    try {
      const { data, error } = await invokeSupabaseFunctionWithRetry<{ success?: boolean }>(
        supabase.functions.invoke.bind(supabase.functions) as any,
        "export-generate",
        { body: { store_id: storeId, format } },
      );
      if (error) return false;
      ExportService.invalidateLinksCache(storeId, session.user?.id);
      return !!(data?.success);
    } catch {
      return false;
    }
  },

  buildPublicUrl(origin: string, format: 'xml' | 'csv', token: string): string {
    const base = origin.replace(/\/+$/, '');
    return `${base}/export/${format}/${token}`;
  },

  buildXml(products: Product[]): string {
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const offers = products.filter(p => p.is_active).map(p => {
      const id = (p.external_id || p.id).toString();
      const escape = (s: unknown) => {
        const str = s == null ? '' : String(s);
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };
      const parts = [
        `<name>${escape(p.name)}</name>`,
        `<price>${p.price ?? 0}</price>`,
        `<currency>${escape(p.currency_code || 'UAH')}</currency>`,
        `<available>${p.available ? 1 : 0}</available>`,
        `<stock_quantity>${p.stock_quantity ?? 0}</stock_quantity>`,
        `<vendor>${escape(p.vendor || '')}</vendor>`,
        `<article>${escape(p.article || '')}</article>`,
        `<docket>${escape(p.docket || '')}</docket>`,
        `<docket_ua>${escape(p.docket_ua || '')}</docket_ua>`,
        `<description>${escape(p.description || '')}</description>`,
        `<updated_at>${escape(p.updated_at)}</updated_at>`,
      ].join('');
      return `<offer id="${escape(id)}">${parts}</offer>`;
    }).join('');
    const body = `<yml_catalog><shop><offers>${offers}</offers></shop></yml_catalog>`;
    return header + body;
  },

  buildCsv(products: Product[]): string {
    const header = ['id','name','price','currency','available','stock_quantity','vendor','article','docket','docket_ua'].join(',');
    const rows = products.filter(p => p.is_active).map(p => [
      JSON.stringify(p.external_id || p.id),
      JSON.stringify(p.name || ''),
      String(p.price ?? 0),
      JSON.stringify(p.currency_code || 'UAH'),
      String(p.available ? 1 : 0),
      String(p.stock_quantity ?? 0),
      JSON.stringify(p.vendor || ''),
      JSON.stringify(p.article || ''),
      JSON.stringify(p.docket || ''),
      JSON.stringify(p.docket_ua || ''),
    ].join(','));
    return [header, ...rows].join('\n');
  },

  async generateLocalAndUpload(storeId: string, format: 'xml' | 'csv'): Promise<boolean> {
    const session = await ExportService.ensureSession();
    const productsAgg = await ProductService.getProductsAggregated(storeId);
    const products = productsAgg as Product[];
    const content = format === 'xml' ? ExportService.buildXml(products) : ExportService.buildCsv(products);
    const blob = new Blob([content], { type: format === 'xml' ? 'application/xml' : 'text/csv' });
    const file = new File([blob], `export-${storeId}-${Date.now()}.${format}`, { type: blob.type });
    const res = await R2Storage.uploadFile(file);
    const ok = !!res?.success;
    if (ok) ExportService.invalidateLinksCache(storeId, session.user?.id);
    return ok;
  },
};
