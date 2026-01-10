import { DashboardService } from "@/lib/dashboard-service";
import { ShopService } from "@/lib/shop-service";
import { SupplierService } from "@/lib/supplier-service";
import { TariffService } from "@/lib/tariff-service";

export class LoginDataService {
  private static isPrefetching = false;
  private static lastPrefetchUserId: string | null = null;

  /**
   * Запускает фоновую загрузку данных при входе пользователя.
   * Выполняется только один раз для каждого пользователя (при инициализации сессии).
   */
  static async prefetchAll(userId: string): Promise<void> {
    if (!userId) return;

    // Check session storage to avoid re-fetching on page reload
    const storageKey = `prefetch_done_${userId}`;
    try {
      if (sessionStorage.getItem(storageKey)) {
        return;
      }
    } catch {
      // Ignore storage errors
    }

    // Если уже загружали для этого пользователя - пропускаем (in-memory check)
    if (this.lastPrefetchUserId === userId) {
      console.log(`[LoginDataService] Prefetch already done for user ${userId}`);
      return;
    }

    // Если прямо сейчас идет загрузка - пропускаем (или ждем, но тут лучше fire-and-forget)
    if (this.isPrefetching) {
      console.log("[LoginDataService] Prefetch already in progress");
      return;
    }

    this.isPrefetching = true;
    this.lastPrefetchUserId = userId;

    console.log(`[LoginDataService] Starting background prefetch for user ${userId}`);

    try {
      // Запускаем запросы параллельно, но не блокируем UI (fire-and-forget для вызывающего кода)
      // Мы не используем await Promise.all() чтобы не ждать окончания, 
      // но внутри метода мы ловим ошибки чтобы не крашить приложение.
      
      const promises = [
        this.safeFetch("Dashboard", () => DashboardService.getDashboardStats()),
        this.safeFetch("Shops", () => ShopService.getShopsAggregated({ force: false })),
        this.safeFetch("Suppliers", () => SupplierService.getSuppliers()),
        this.safeFetch("Tariffs", () => TariffService.getTariffsAggregated(false, false)),
        // Можно добавить и лимиты, если они не загружаются через UserProtected
        // this.safeFetch("Limits", () => TariffService.getSupplierLimit()),
      ];

      await Promise.allSettled(promises);
      
      // Mark as done in session storage
      try {
        sessionStorage.setItem(storageKey, "true");
      } catch {
        // Ignore storage errors
      }

      console.log(`[LoginDataService] Background prefetch completed for user ${userId}`);
    } catch (error) {
      console.error("[LoginDataService] Critical error during prefetch:", error);
    } finally {
      this.isPrefetching = false;
    }
  }

  private static async safeFetch(name: string, fn: () => Promise<any>): Promise<void> {
    try {
      console.time(`[LoginDataService] ${name}`);
      await fn();
      console.timeEnd(`[LoginDataService] ${name}`);
    } catch (error) {
      console.error(`[LoginDataService] Failed to prefetch ${name}:`, error);
    }
  }
}
