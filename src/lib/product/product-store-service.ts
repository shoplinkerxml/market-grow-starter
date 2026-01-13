import { SessionValidator } from "@/lib/session-validation";
import { GlobalRequestDeduplicator } from "@/lib/request-deduplicator";

export class ProductStoreService {
  /** Получение store_ids текущего пользователя (через функции) */
  static async getUserStoreIds(): Promise<string[]> {
    const stores = await ProductStoreService.getUserStores();
    return stores.filter((s) => s.is_active).map((s) => s.id);
  }

  /** Получение полной информации о магазинах пользователя (только функции + кэш) */
  static async getUserStores(): Promise<
    Array<{
      id: string;
      store_name: string;
      store_url: string | null;
      is_active: boolean;
      productsCount: number;
      categoriesCount: number;
    }>
  > {
    const uid = await SessionValidator.validateSession()
      .then((v) => (v?.user?.id ? String(v.user.id) : "current"))
      .catch(() => "current");
    return await GlobalRequestDeduplicator.dedupeExpensive(
      { service: "ProductStoreService", method: "getUserStores", params: { userId: uid } },
      async (_ctx) => {
        try {
          const { UserAuthService } = await import("@/lib/user-auth-service");
          const authMe = await UserAuthService.fetchAuthMe();
          if (Array.isArray((authMe as any)?.userStores)) {
            return (authMe.userStores || []).map((s: any) => ({
              id: String(s.id),
              store_name: String(s.store_name || ""),
              store_url: null,
              is_active: true,
              productsCount: 0,
              categoriesCount: 0,
            }));
          }
        } catch {
          void 0;
        }

        const { ShopService } = await import("@/lib/shop-service");
        const shops = await ShopService.getShopsAggregated();
        const mapped = (shops || []).map((s) => ({
          id: String(s.id),
          store_name: String(s.store_name || ""),
          store_url: s.store_url ? String(s.store_url) : null,
          is_active: !!s.is_active,
          productsCount: Number(s.productsCount ?? 0),
          categoriesCount: Number(s.categoriesCount ?? 0),
        }));
        return mapped;
      },
    );
  }

  static clearCache(): void {
    try {
      GlobalRequestDeduplicator.cancelPrefix("ProductStoreService:");
    } catch {
      void 0;
    }
  }
}
