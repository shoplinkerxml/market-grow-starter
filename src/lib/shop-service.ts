export * from "./shop-core";

import { ShopCategoriesService } from "./shop-categories";
import { ShopServiceCore, type StoreCategory } from "./shop-core";
import { ShopCurrenciesService } from "./shop-currencies";

export class ShopService extends ShopServiceCore {
  static async getStoreCategories(storeId: string): Promise<StoreCategory[]> {
    return await ShopCategoriesService.getStoreCategories(storeId);
  }

  static async updateStoreCategory(payload: {
    id: number;
    rz_id_value?: string | null;
    is_active?: boolean;
    custom_name?: string | null;
    external_id?: string | null;
  }): Promise<void> {
    await ShopCategoriesService.updateStoreCategory(payload);
  }

  static async deleteStoreCategoryWithProducts(storeId: string, categoryId: number): Promise<void> {
    await ShopCategoriesService.deleteStoreCategoryWithProducts(storeId, categoryId);
  }

  static async deleteStoreCategoriesWithProducts(storeId: string, categoryIds: number[]): Promise<void> {
    await ShopCategoriesService.deleteStoreCategoriesWithProducts(storeId, categoryIds);
  }

  static async ensureStoreCategory(
    storeId: string,
    categoryId: number,
    options?: { external_id?: string | null; custom_name?: string | null }
  ): Promise<number | null> {
    return await ShopCategoriesService.ensureStoreCategory(storeId, categoryId, options);
  }

  static async getStoreCategoryExternalId(storeId: string, categoryId: number): Promise<string | null> {
    return await ShopCategoriesService.getStoreCategoryExternalId(storeId, categoryId);
  }

  static async cleanupUnusedStoreCategory(storeId: string, categoryId: number): Promise<void> {
    await ShopCategoriesService.cleanupUnusedStoreCategory(storeId, categoryId);
  }

  static async getStoreCurrencies(storeId: string): Promise<Array<{ code: string; rate: number; is_base: boolean }>> {
    return await ShopCurrenciesService.getStoreCurrencies(storeId);
  }

  static async addStoreCurrency(storeId: string, code: string, rate: number): Promise<void> {
    await ShopCurrenciesService.addStoreCurrency(storeId, code, rate);
  }

  static async updateStoreCurrencyRate(storeId: string, code: string, rate: number): Promise<void> {
    await ShopCurrenciesService.updateStoreCurrencyRate(storeId, code, rate);
  }

  static async setBaseStoreCurrency(storeId: string, code: string): Promise<void> {
    await ShopCurrenciesService.setBaseStoreCurrency(storeId, code);
  }

  static async deleteStoreCurrency(storeId: string, code: string): Promise<void> {
    await ShopCurrenciesService.deleteStoreCurrency(storeId, code);
  }

  static async getAvailableCurrencies(): Promise<Array<{ code: string; rate?: number }>> {
    return await ShopCurrenciesService.getAvailableCurrencies();
  }
}

