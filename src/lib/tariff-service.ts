import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import TariffCache, { getTariffsListCached, invalidateTariffsCache } from './tariff-cache';
import { PersistentCacheService } from "./persistent-cache-service";
import { EdgeClient } from "./request-handler";

export type Tariff = Database['public']['Tables']['tariffs']['Row'];
export type TariffInsert = Database['public']['Tables']['tariffs']['Insert'];
export type TariffUpdate = Database['public']['Tables']['tariffs']['Update'];

export type TariffFeature = Database['public']['Tables']['tariff_features']['Row'];
export type TariffFeatureInsert = Database['public']['Tables']['tariff_features']['Insert'];
export type TariffFeatureUpdate = Database['public']['Tables']['tariff_features']['Update'];

export type TariffLimit = Database['public']['Tables']['tariff_limits']['Row'];
export type TariffLimitInsert = Database['public']['Tables']['tariff_limits']['Insert'];
export type TariffLimitUpdate = Database['public']['Tables']['tariff_limits']['Update'];

export type Currency = Database['public']['Tables']['currencies']['Row'];

export interface TariffWithDetails {
  id: number;
  name: string;
  description: string | null;
  old_price: number | null;
  new_price: number | null;
  currency_id: number;
  currency_code: string;
  duration_days: number | null;
  is_free: boolean | null;
  is_lifetime: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  sort_order: number | null;
  visible: boolean | null;
  popular: boolean | null;
  currency_data: Currency;
  features: TariffFeature[];
  limits: TariffLimit[];
}

export class TariffService {
  private static tariffsRefreshInFlight = false;
  private static tariffsLastRefreshAt = 0;

  private static invalidateTariffsCaches(): void {
    try {
      invalidateTariffsCache();
    } catch {
      void 0;
    }
    try {
      PersistentCacheService.invalidateTariffs();
    } catch {
      void 0;
    }
  }

  static clearAllCaches(): void {
    TariffService.invalidateTariffsCaches();
  }

  static async activateMyTariff(tariffId: number): Promise<{ success: boolean; subscription?: unknown }> {
    return await EdgeClient.invokeWithRetry<{ success: boolean; subscription?: unknown }>(
      'user-activate-tariff',
      { tariffId },
    );
  }
  static async getTariffsAggregated(includeInactive = false, includeDemo = false): Promise<TariffWithDetails[]> {
    const cacheKey = `list:${includeInactive ? "inactive" : "active"}:${includeDemo ? "demo" : "noDemo"}`;
    return await getTariffsListCached<TariffWithDetails>(cacheKey, async () => {
      return await PersistentCacheService.getTariffs(async () => {
        try {
          const payload = await EdgeClient.invokeWithRetry<{ tariffs: TariffWithDetails[] }>("tariffs-list", {
            includeInactive,
            includeDemo,
          });
          return Array.isArray(payload.tariffs) ? payload.tariffs : [];
        } catch {
          return [];
        }
      }, cacheKey);
    });
  }

  static async getTariffById(
    id: number,
    options?: { includeInactive?: boolean; includeDemo?: boolean },
  ): Promise<TariffWithDetails | null> {
    const includeInactive = options?.includeInactive ?? false;
    const includeDemo = options?.includeDemo ?? false;
    const cacheKey = `list:${includeInactive ? "inactive" : "active"}:${includeDemo ? "demo" : "noDemo"}`;

    const cached = TariffCache.get<TariffWithDetails[]>(cacheKey);
    const fromCache = (cached || []).find((t) => Number((t as any)?.id) === Number(id));
    if (fromCache) return fromCache;

    const list = await TariffService.getTariffsAggregated(includeInactive, includeDemo);
    const found = (list || []).find((t) => Number((t as any)?.id) === Number(id)) || null;
    return found;
  }

  // Create a new tariff
  static async createTariff(tariffData: TariffInsert) {
    try {
      // First, create the tariff without joins
      const { data: createdTariff, error: createError } = await supabase
        .from('tariffs')
        .insert(tariffData)
        .select('id,name,description,old_price,new_price,currency_id,currency_code,duration_days,is_free,is_lifetime,is_active,created_at,updated_at,sort_order,visible,popular')
        .single();

      if (createError) throw createError;
      TariffService.invalidateTariffsCaches();

      // Then fetch the currency data separately - handle both currency and currency_id fields
      const currencyField = createdTariff.currency_id;
      if (typeof currencyField === 'number') {
        const { data: currencyData, error: currencyError } = await supabase
          .from('currencies')
          .select('id,code,name,rate,status,is_base')
          .eq('id', currencyField)
          .single();

        if (currencyError) {
          console.warn('Could not fetch currency data:', currencyError);
          // Return tariff without currency data if currency fetch fails
          return createdTariff as Tariff;
        }

        // Combine the data
        return {
          ...createdTariff,
          currency_data: currencyData
        } as (Tariff & { currency_data: Currency });
      }

      // Return tariff without currency data if no valid currency field
      return createdTariff as Tariff;
    } catch (error) {
      console.error('Error creating tariff:', error);
      throw error;
    }
  }

  // Update a tariff
  static async updateTariff(id: number, tariffData: TariffUpdate) {
    try {
      console.log('Updating tariff:', { id, tariffData });
      
      // First, update the tariff without joins
      const { data: updatedTariff, error: updateError } = await supabase
        .from('tariffs')
        .update(tariffData)
        .eq('id', id)
        .select('id,name,description,old_price,new_price,currency_id,currency_code,duration_days,is_free,is_lifetime,is_active,created_at,updated_at,sort_order,visible,popular')
        .maybeSingle();

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      
      if (!updatedTariff) {
        console.error('No tariff returned after update - possible RLS issue');
        throw new Error('Failed to update tariff - no data returned');
      }
      TariffService.invalidateTariffsCaches();

      // Then fetch the currency data separately - handle both currency and currency_id fields
      const currencyField = updatedTariff.currency_id;
      if (typeof currencyField === 'number') {
        const { data: currencyData, error: currencyError } = await supabase
          .from('currencies')
          .select('id,code,name,rate,status,is_base')
          .eq('id', currencyField)
          .single();

        if (currencyError) {
          console.warn('Could not fetch currency data:', currencyError);
          return updatedTariff as Tariff;
        }

        return {
          ...updatedTariff,
          currency_data: currencyData
        } as (Tariff & { currency_data: Currency });
      }

      return updatedTariff as Tariff;
    } catch (error) {
      console.error('Error updating tariff:', error);
      throw error;
    }
  }

  // Delete a tariff
  static async deleteTariff(id: number) {
    try {
      const { error } = await supabase
        .from('tariffs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return true;
    } catch (error) {
      console.error('Error deleting tariff:', error);
      throw error;
    }
  }

  // Get all features for a tariff
  static async getTariffFeatures(tariffId: number) {
    try {
      const { data, error } = await supabase
        .from('tariff_features')
        .select('id,tariff_id,feature_name,is_active')
        .eq('tariff_id', tariffId)
        .eq('is_active', true)
        .order('feature_name');

      if (error) throw error;
      return data as TariffFeature[];
    } catch (error) {
      console.error('Error fetching tariff features:', error);
      throw error;
    }
  }

  // Add a feature to a tariff
  static async addTariffFeature(featureData: TariffFeatureInsert) {
    try {
      const { data, error } = await supabase
        .from('tariff_features')
        .insert(featureData)
        .select('id,tariff_id,feature_name,is_active')
        .single();

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return data as TariffFeature;
    } catch (error) {
      console.error('Error adding tariff feature:', error);
      throw error;
    }
  }

  static async addTariffFeatures(features: TariffFeatureInsert[]) {
    try {
      if (!Array.isArray(features) || features.length === 0) return [] as TariffFeature[];
      const { data, error } = await supabase
        .from('tariff_features')
        .insert(features)
        .select('id,tariff_id,feature_name,is_active');
      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return (data || []) as TariffFeature[];
    } catch (error) {
      console.error('Error adding tariff features:', error);
      throw error;
    }
  }

  // Update a tariff feature
  static async updateTariffFeature(id: number, featureData: TariffFeatureUpdate) {
    try {
      const { data, error } = await supabase
        .from('tariff_features')
        .update(featureData)
        .eq('id', id)
        .select('id,tariff_id,feature_name,is_active')
        .single();

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return data as TariffFeature;
    } catch (error) {
      console.error('Error updating tariff feature:', error);
      throw error;
    }
  }

  // Delete a tariff feature
  static async deleteTariffFeature(id: number) {
    try {
      const { error } = await supabase
        .from('tariff_features')
        .delete()
        .eq('id', id);

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return true;
    } catch (error) {
      console.error('Error deleting tariff feature:', error);
      throw error;
    }
  }

  // Get all limits for a tariff
  static async getTariffLimits(tariffId: number) {
    try {
      const { data, error } = await supabase
        .from('tariff_limits')
        .select('id,tariff_id,template_id,code,limit_name,description,path,value,is_active')
        .eq('tariff_id', tariffId)
        .eq('is_active', true)
        .order('limit_name');

      if (error) throw error;
      return data as TariffLimit[];
    } catch (error) {
      console.error('Error fetching tariff limits:', error);
      throw error;
    }
  }

  // Add a limit to a tariff
  static async addTariffLimit(limitData: TariffLimitInsert) {
    try {
      const { data, error } = await supabase
        .from('tariff_limits')
        .insert(limitData)
        .select('id,tariff_id,template_id,code,limit_name,description,path,value,is_active')
        .single();

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return data as TariffLimit;
    } catch (error) {
      console.error('Error adding tariff limit:', error);
      throw error;
    }
  }

  static async addTariffLimits(limits: TariffLimitInsert[]) {
    try {
      if (!Array.isArray(limits) || limits.length === 0) return [] as TariffLimit[];
      const { data, error } = await supabase
        .from('tariff_limits')
        .insert(limits)
        .select('id,tariff_id,template_id,code,limit_name,description,path,value,is_active');
      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return (data || []) as TariffLimit[];
    } catch (error) {
      console.error('Error adding tariff limits:', error);
      throw error;
    }
  }

  // Update a tariff limit
  static async updateTariffLimit(id: number, limitData: TariffLimitUpdate) {
    try {
      const { data, error } = await supabase
        .from('tariff_limits')
        .update(limitData)
        .eq('id', id)
        .select('id,tariff_id,template_id,code,limit_name,description,path,value,is_active')
        .single();

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return data as TariffLimit;
    } catch (error) {
      console.error('Error updating tariff limit:', error);
      throw error;
    }
  }

  // Delete a tariff limit
  static async deleteTariffLimit(id: number) {
    try {
      const { error } = await supabase
        .from('tariff_limits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      TariffService.invalidateTariffsCaches();
      return true;
    } catch (error) {
      console.error('Error deleting tariff limit:', error);
      throw error;
    }
  }

  // Get all currencies
  static async getAllCurrencies() {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('id,code,name,rate,status,is_base')
        .eq('status', true)
        .order('code');

      if (error) throw error;
      return data as Currency[];
    } catch (error) {
      console.error('Error fetching currencies:', error);
      throw error;
    }
  }

  // Create sample tariff data for testing
  static async createSampleData() {
    try {
      console.log('Creating sample tariff data...');
      
      // First check if we have currencies
      const currencies = await this.getAllCurrencies();
      if (currencies.length === 0) {
        console.error('No currencies found. Please create currencies first.');
        return false;
      }
      
      const usdCurrency = currencies.find(c => c.code === 'USD') || currencies[0];
      
      // Create sample tariffs
      const sampleTariffs = [
        {
          name: 'Базовий план',
          description: 'Ідеально для початківців',
          old_price: 19.99,
          new_price: 14.99,
          currency_id: usdCurrency.id,
          currency_code: usdCurrency.code,
          duration_days: 30,
          is_free: false,
          is_lifetime: false,
          is_active: true
        },
        {
          name: 'Професійний план',
          description: 'Для професіоналів та малих команд',
          old_price: 49.99,
          new_price: 39.99,
          currency_id: usdCurrency.id,
          currency_code: usdCurrency.code,
          duration_days: 30,
          is_free: false,
          is_lifetime: false,
          is_active: true
        },
        {
          name: 'Безкоштовний план',
          description: 'Спробуйте наш сервіс безкоштовно',
          old_price: null,
          new_price: null,
          currency_id: usdCurrency.id,
          currency_code: usdCurrency.code,
          duration_days: null,
          is_free: true,
          is_lifetime: false,
          is_active: true
        }
      ];
      
      const createdTariffs = [];
      for (const tariffData of sampleTariffs) {
        const tariff = await this.createTariff(tariffData as any);
        createdTariffs.push(tariff);
        console.log('Created tariff:', tariff.name);
      }
      
      // Add sample features and limits
      const features: TariffFeatureInsert[] = [];
      const limits: TariffLimitInsert[] = [];
      for (const tariff of createdTariffs) {
        if (tariff.is_free) {
          features.push({ tariff_id: tariff.id, feature_name: 'До 3 проектів', is_active: true });
          limits.push({ tariff_id: tariff.id, limit_name: 'Сховище (ГБ)', value: 5, is_active: true });
          continue;
        }

        if (tariff.new_price && tariff.new_price < 20) {
          features.push({ tariff_id: tariff.id, feature_name: 'До 10 проектів', is_active: true });
          features.push({ tariff_id: tariff.id, feature_name: 'Базова аналітика', is_active: true });
          limits.push({ tariff_id: tariff.id, limit_name: 'Сховище (ГБ)', value: 50, is_active: true });
          continue;
        }

        features.push({ tariff_id: tariff.id, feature_name: 'Необмежені проекти', is_active: true });
        features.push({ tariff_id: tariff.id, feature_name: 'Розширена аналітика', is_active: true });
        features.push({ tariff_id: tariff.id, feature_name: 'Пріоритетна підтримка', is_active: true });
        limits.push({ tariff_id: tariff.id, limit_name: 'Сховище (ГБ)', value: 500, is_active: true });
      }

      await Promise.all([this.addTariffFeatures(features), this.addTariffLimits(limits)]);
      
      console.log('Sample data created successfully!');
      return true;
    } catch (error) {
      console.error('Error creating sample data:', error);
      throw error;
    }
  }

  // Duplicate a tariff with all its features and limits
  static async duplicateTariff(originalTariffId: number) {
    try {
      console.log('Duplicating tariff with ID:', originalTariffId);
      
      // 1. Get the original tariff with all its data
      const originalTariff = await this.getTariffById(originalTariffId);
      if (!originalTariff) {
        throw new Error('Original tariff not found');
      }
      
      // 2. Get currency data to ensure we have both currency_id and currency_code
      const currencyId = originalTariff.currency;
      let currencyCode = 'USD'; // Default
      
      if (currencyId && typeof currencyId === 'number') {
        const { data: currencyData, error: currencyError } = await supabase
          .from('currencies')
          .select('code')
          .eq('id', currencyId)
          .single();
          
        if (!currencyError && currencyData) {
          currencyCode = currencyData.code;
        }
      }
      
      // 3. Prepare the new tariff data with correct field names for REST API
      const newTariffData: any = {
        name: `${originalTariff.name} (Copy)`,
        description: originalTariff.description,
        old_price: originalTariff.old_price,
        new_price: originalTariff.new_price,
        currency_id: currencyId, // Use currency_id for REST API
        currency_code: currencyCode, // Include currency_code as required
        duration_days: originalTariff.duration_days,
        is_free: originalTariff.is_free,
        is_lifetime: originalTariff.is_lifetime,
        is_active: false // New duplicates are inactive by default
      };
      
      // 4. Create the new tariff
      const newTariff = await this.createTariff(newTariffData);
      console.log('Created duplicate tariff:', newTariff.id);
      
      // 5. Duplicate all features
      if (originalTariff.features && originalTariff.features.length > 0) {
        const features = originalTariff.features.map((feature) => ({
          tariff_id: newTariff.id,
          feature_name: feature.feature_name,
          is_active: feature.is_active,
        })) as TariffFeatureInsert[];
        await this.addTariffFeatures(features);
        console.log('Duplicated features:', features.length);
      }
      
      // 6. Duplicate all limits
      if (originalTariff.limits && originalTariff.limits.length > 0) {
        const limits = originalTariff.limits.map((limit) => ({
          tariff_id: newTariff.id,
          limit_name: limit.limit_name,
          value: limit.value,
          is_active: limit.is_active,
        })) as TariffLimitInsert[];
        await this.addTariffLimits(limits);
        console.log('Duplicated limits:', limits.length);
      }
      
      console.log('Tariff duplication completed successfully');
      return newTariff;
    } catch (error) {
      console.error('Error duplicating tariff:', error);
      throw error;
    }
  }

  // Get tariff statistics
  static async getTariffStatistics() {
    try {
      // Get total tariffs count
      const { count: totalTariffs, error: totalError } = await supabase
        .from('tariffs')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get active tariffs count
      const { count: activeTariffs, error: activeError } = await supabase
        .from('tariffs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (activeError) throw activeError;

      // Get free tariffs count
      const { count: freeTariffs, error: freeError } = await supabase
        .from('tariffs')
        .select('*', { count: 'exact', head: true })
        .eq('is_free', true)
        .eq('is_active', true);

      if (freeError) throw freeError;

      return {
        totalTariffs: totalTariffs || 0,
        activeTariffs: activeTariffs || 0,
        freeTariffs: freeTariffs || 0,
        paidTariffs: (activeTariffs || 0) - (freeTariffs || 0)
      };
    } catch (error) {
      console.error('Error fetching tariff statistics:', error);
      throw error;
    }
  }
}
