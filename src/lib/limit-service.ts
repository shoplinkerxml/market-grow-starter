import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CACHE_TTL, UnifiedCacheManager } from "./cache-utils";

export interface LimitTemplate {
  id: number;
  code: string;
  name: string;
  path?: string;
  description?: string;
  order_index?: number;
}

export interface CreateLimitData {
  code: string;
  name: string;
  path?: string;
  description?: string;
}

export interface UpdateLimitData {
  code?: string;
  name?: string;
  path?: string;
  description?: string;
}

export class LimitService {
  private static codeRegex = /^[a-z][a-z0-9_]*$/;
  private static cache = UnifiedCacheManager.create("rq:limitTemplates", {
    mode: "auto",
    defaultTtlMs: CACHE_TTL.limits,
  });
  private static ensureName(name?: string): string {
    const v = (name ?? '').trim();
    if (!v) throw new Error("Назва обмеження обов'язкова");
    return v;
  }
  private static ensureCode(code?: string): string {
    const v = (code ?? '').trim();
    if (!v) throw new Error("Системне ім'я обмеження обов'язкове");
    if (!LimitService.codeRegex.test(v)) {
      throw new Error("Системне ім'я має бути в форматі snake_case (тільки малі літери, цифри та _)");
    }
    return v;
  }
  private static trimOrNull(v?: string): string | null { return (v?.trim() || '') || null; }
  private static invalidateCache() {
    LimitService.cache.remove("list");
  }

  static async getLimits(): Promise<LimitTemplate[]> {
    const cached = LimitService.cache.get<LimitTemplate[]>("list");
    if (cached && Array.isArray(cached)) return cached;
    const { data, error } = await supabase
      .from('limit_templates')
      .select('id,code,name,path,description,order_index')
      .order('order_index', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as LimitTemplate[];
    LimitService.cache.set("list", rows);
    return rows;
  }

  /** Отримання одного ліміту за ID */
  static async getLimit(id: number): Promise<LimitTemplate> {
    if (!id) throw new Error("Limit ID is required");

    const { data, error } = await supabase
      .from('limit_templates')
      .select('id,code,name,path,description,order_index')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Limit not found");
    }

    return data as LimitTemplate;
  }

  /** Створення нового ліміту */
  static async createLimit(limitData: CreateLimitData): Promise<LimitTemplate> {
    const name = LimitService.ensureName(limitData.name);
    const code = LimitService.ensureCode(limitData.code);

    const { data, error } = await supabase
      .from('limit_templates')
      .insert({
        name,
        code,
        path: LimitService.trimOrNull(limitData.path),
        description: LimitService.trimOrNull(limitData.description),
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw new Error("Ліміт з таким системним ім'ям вже існує");
      }
      throw new Error(error.message);
    }

    const row = data as LimitTemplate;
    LimitService.invalidateCache();
    return row;
  }

  /** Оновлення ліміту */
  static async updateLimit(id: number, limitData: UpdateLimitData): Promise<LimitTemplate> {
    if (!id) throw new Error("Limit ID is required");

    const cleanData: Partial<Database['public']['Tables']['limit_templates']['Update']> = {};
    
    if (limitData.name !== undefined) {
      cleanData.name = LimitService.ensureName(limitData.name);
    }
    
    if (limitData.code !== undefined) {
      cleanData.code = LimitService.ensureCode(limitData.code);
    }
    
    if (limitData.path !== undefined) {
      cleanData.path = LimitService.trimOrNull(limitData.path);
    }
    
    if (limitData.description !== undefined) {
      cleanData.description = LimitService.trimOrNull(limitData.description);
    }

    if (Object.keys(cleanData).length === 0) {
      throw new Error("No fields to update");
    }

    const { data, error } = await supabase
      .from('limit_templates')
      .update(cleanData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw new Error("Ліміт з таким системним ім'ям вже існує");
      }
      throw new Error(error.message);
    }

    const row = data as LimitTemplate;
    LimitService.invalidateCache();
    return row;
  }

  /** Видалення ліміту */
  static async deleteLimit(id: number): Promise<void> {
    if (!id) throw new Error("Limit ID is required");

    const { error } = await supabase
      .from('limit_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
    LimitService.invalidateCache();
  }

  /** Оновлення порядку лімітів */
  static async updateLimitsOrder(limits: { id: number; order_index: number }[]): Promise<void> {
    if (!Array.isArray(limits) || limits.length === 0) return;
    const results = await Promise.all(
      limits.map(async (l) => {
        const idx = l.order_index < 0 ? 0 : l.order_index;
        const { error } = await supabase.from('limit_templates').update({ order_index: idx }).eq('id', l.id);
        return { id: l.id, error };
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error('Failed to update limits order');
    LimitService.invalidateCache();
  }
}
