import { ShopServiceCore } from "./shop-core";

export class ShopCurrenciesService extends ShopServiceCore {
  static async getStoreCurrencies(storeId: string): Promise<Array<{ code: string; rate: number; is_base: boolean }>> {
    if (!storeId) throw new Error("Store ID is required");

    await this.ensureSession();
    const response = await this.invokeEdge<{
      rows: Array<{ code: string; rate?: number; is_base?: boolean }>;
    }>("store-currencies-list", { store_id: storeId });

    return (response.rows || []).map((row) => ({
      code: row.code,
      rate: Number(row.rate) || 1,
      is_base: Boolean(row.is_base),
    }));
  }

  static async addStoreCurrency(storeId: string, code: string, rate: number): Promise<void> {
    if (!storeId) throw new Error("Store ID is required");
    await this.ensureSession();
    await this.invokeEdge("add-store-currency", { store_id: storeId, code, rate });
  }

  static async updateStoreCurrencyRate(storeId: string, code: string, rate: number): Promise<void> {
    if (!storeId) throw new Error("Store ID is required");
    await this.ensureSession();
    await this.invokeEdge("update-store-currency-rate", { store_id: storeId, code, rate });
  }

  static async setBaseStoreCurrency(storeId: string, code: string): Promise<void> {
    if (!storeId) throw new Error("Store ID is required");
    await this.ensureSession();
    await this.invokeEdge("set-base-store-currency", { store_id: storeId, code });
  }

  static async deleteStoreCurrency(storeId: string, code: string): Promise<void> {
    if (!storeId) throw new Error("Store ID is required");
    await this.ensureSession();
    await this.invokeEdge("delete-store-currency", { store_id: storeId, code });
  }

  static async getAvailableCurrencies(): Promise<Array<{ code: string; rate?: number }>> {
    await this.ensureSession();
    const response = await this.invokeEdge<{
      rows: Array<{ code: string; rate?: number }>;
    }>("get-available-currencies", {});

    return (response.rows || []).map((row) => ({
      code: row.code,
      rate: row.rate,
    }));
  }
}

