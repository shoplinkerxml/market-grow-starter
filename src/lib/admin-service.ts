// src/lib/admin-service.ts
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeWithAuth, SessionValidator } from "./session-validation";
import type { TariffInsert, TariffUpdate, TariffFeatureInsert, TariffFeatureUpdate, TariffLimitInsert, TariffLimitUpdate } from "./tariff-service";
import { RequestDeduplicatorFactory } from "./request-deduplicator";

type AdminErrorCode = 'unauthorized' | 'validation_failed' | 'db_error' | 'rpc_error' | 'not_found';
type AdminResult<T> = { success: boolean; data?: T; errorCode?: AdminErrorCode; message?: string };

async function ensureAccessToken(): Promise<string> {
  const v = await SessionValidator.ensureValidSession();
  if (!v.isValid || !v.accessToken) throw Object.assign(new Error('Invalid session'), { status: 401 });
  return v.accessToken;
}

function mapAdminError(e: unknown): { code: AdminErrorCode; message?: string } {
  const err = e as { status?: number; statusCode?: number; message?: string };
  const s = err?.status ?? err?.statusCode;
  if (s === 401) return { code: 'unauthorized', message: err?.message };
  if (s === 404) return { code: 'not_found', message: err?.message };
  if (s === 422) return { code: 'validation_failed', message: err?.message };
  return { code: 'db_error', message: err?.message };
}

function createTraceId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function logAdminError(context: string, e: unknown, traceId: string): void {
  try {
    const mapped = mapAdminError(e);
    console.error(JSON.stringify({ type: 'admin_error', context, traceId, code: mapped.code, message: mapped.message }));
  } catch {
    console.error({ type: 'admin_error', context, traceId, error: e });
  }
}

async function invokeAdminEdge<T>(fn: string, body: unknown): Promise<AdminResult<T>> {
  try {
    const token = await ensureAccessToken();
    void token;
    const payload = await invokeEdgeWithAuth<T>(fn, body);
    return { success: true, data: payload };
  } catch (e) {
    const tid = createTraceId();
    logAdminError(`edge:${fn}`, e, tid);
    const mapped = mapAdminError(e);
    const code: AdminErrorCode = mapped.code === 'unauthorized' ? 'unauthorized' : 'rpc_error';
    return { success: false, errorCode: code, message: mapped.message };
  }
}

async function runDb<T>(op: () => Promise<T>): Promise<AdminResult<T>> {
  try {
    await ensureAccessToken();
    const res = await op();
    return { success: true, data: res };
  } catch (e) {
    const tid = createTraceId();
    logAdminError('db', e, tid);
    const mapped = mapAdminError(e);
    return { success: false, errorCode: mapped.code, message: mapped.message };
  }
}

export class AdminService {
  // ==================== TARIFF OPERATIONS ====================
  private static deduplicator = RequestDeduplicatorFactory.create<AdminResult<unknown>>("admin-service", {
    ttl: 30_000,
    maxSize: 200,
    enableMetrics: true,
    errorStrategy: "remove",
    maxRetries: 0,
  });
  private static dedupe<T>(key: string, fn: () => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
    return this.deduplicator.dedupe<AdminResult<T>>(key, fn);
  }
  
  static async createTariff(data: TariffInsert): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariffs')
        .insert(data)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async updateTariff(id: number, data: TariffUpdate): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariffs')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async deleteTariff(id: number): Promise<AdminResult<{ success: boolean }>> {
    return runDb(async () => {
      const { error } = await supabase
        .from('tariffs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    });
  }

  // ==================== TARIFF FEATURES ====================
  
  static async createTariffFeature(data: TariffFeatureInsert): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariff_features')
        .insert(data)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async updateTariffFeature(id: number, data: TariffFeatureUpdate): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariff_features')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async deleteTariffFeature(id: number): Promise<AdminResult<{ success: boolean }>> {
    return runDb(async () => {
      const { error } = await supabase
        .from('tariff_features')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    });
  }

  // ==================== TARIFF LIMITS ====================
  
  static async createTariffLimit(data: TariffLimitInsert): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariff_limits')
        .insert(data)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async updateTariffLimit(id: number, data: TariffLimitUpdate): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('tariff_limits')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async deleteTariffLimit(id: number): Promise<AdminResult<{ success: boolean }>> {
    return runDb(async () => {
      const { error } = await supabase
        .from('tariff_limits')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    });
  }

  // ==================== SUBSCRIPTION OPERATIONS ====================
  
  static async activateUserTariff(userId: string, tariffId: number): Promise<AdminResult<unknown>> {
    return this.dedupe<unknown>(`activate:${userId}`, async () => {
      const edge = await invokeAdminEdge<unknown>('admin-activate-tariff', { userId, tariffId });
      if (edge.success) return edge;
      return runDb(async () => {
        const { error: deactivateError } = await supabase
          .from('user_subscriptions')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('is_active', true);
        if (deactivateError) throw deactivateError;
        const { data: tariff, error: tariffError } = await supabase
          .from('tariffs')
          .select('duration_days, is_lifetime')
          .eq('id', tariffId)
          .single();
        if (tariffError) throw tariffError;
        const startDate = new Date();
        let endDate: Date | null = null;
        if (!tariff.is_lifetime && tariff.duration_days) {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + tariff.duration_days);
        }
        const { data: newSubscription, error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            tariff_id: tariffId,
            start_date: startDate.toISOString(),
            end_date: endDate ? endDate.toISOString() : null,
            is_active: true
          })
          .select(`
            *,
            tariffs (id,name,description,new_price,currency_id,duration_days,is_lifetime)
          `)
          .single();
        if (insertError) throw insertError;
        return newSubscription;
      });
    });
  }

  static async deactivateUserTariff(subscriptionId: number): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('id', subscriptionId)
        .select()
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async deleteSubscription(subscriptionId: number): Promise<AdminResult<{ success: boolean }>> {
    return runDb(async () => {
      const { data: subscription, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('is_active')
        .eq('id', subscriptionId)
        .single();
      if (checkError) throw checkError;
      if (subscription.is_active) throw Object.assign(new Error('Cannot delete active subscription'), { status: 422 });
      const { error } = await supabase
        .from('user_subscriptions')
        .delete()
        .eq('id', subscriptionId);
      if (error) throw error;
      return { success: true };
    });
  }

  // ==================== CURRENCY OPERATIONS ====================
  
  static async createCurrency(data: { code: string; name: string; rate: number; is_base?: boolean; status?: boolean }): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('currencies')
        .insert(data)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async updateCurrency(id: number, data: Partial<{ code: string; name: string; rate: number; is_base: boolean; status: boolean }>): Promise<AdminResult<unknown>> {
    return runDb(async () => {
      const { data: result, error } = await supabase
        .from('currencies')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return result;
    });
  }

  static async deleteCurrency(id: number): Promise<AdminResult<{ success: boolean }>> {
    return runDb(async () => {
      const { error } = await supabase
        .from('currencies')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    });
  }

  static async bulkUpsertTariffFeatures(items: Array<(TariffFeatureInsert & { id?: number }) | TariffFeatureUpdate>): Promise<AdminResult<unknown>> {
    const edge = await invokeAdminEdge<unknown>('admin-bulk-upsert-tariff-features', { items });
    if (edge.success) return edge;
    return runDb(async () => {
      const inserts: TariffFeatureInsert[] = [];
      const updates: Array<{ id: number; data: TariffFeatureUpdate }> = [];
      for (const it of items) {
        const id = (it as { id?: number }).id;
        if (id) {
          const d = { ...it } as TariffFeatureUpdate;
          delete (d as unknown as { id?: number }).id;
          updates.push({ id, data: d });
        } else {
          inserts.push(it as TariffFeatureInsert);
        }
      }
      if (inserts.length) {
        const { error: upsertError } = await supabase
          .from('tariff_features')
          .upsert(inserts, { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }
      if (updates.length) {
        for (const { id, data } of updates) {
          const { error: updateError } = await supabase
            .from('tariff_features')
            .update(data)
            .eq('id', id);
          if (updateError) throw updateError;
        }
      }
      const ids = Array.from(new Set(items.map(i => (i as { tariff_id?: number }).tariff_id).filter(Boolean))) as number[];
      if (ids.length) {
        const { data, error } = await supabase
          .from('tariff_features')
          .select('*')
          .in('tariff_id', ids);
        if (error) throw error;
        return data;
      }
      return [] as unknown[];
    });
  }
}
