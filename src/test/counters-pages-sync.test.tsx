import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

vi.mock("@/i18n", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useI18n: () => ({
    t: (key: string) =>
      ({
        shop_products: "Товарів",
        shop_categories: "Категорії",
        shops_title: "Магазини",
        suppliers_title: "Постачальники",
        totals_title: "Загальна статистика",
        total_products: "Всього товарів",
        total_categories: "Всього категорій",
        products_count_suffix: "тов.",
        no_shops: "Немає магазинів",
        no_suppliers: "Немає постачальників",
        menu_main: "Головна",
        menu_dashboard: "Дашборд",
      } as Record<string, string | undefined>)[key],
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const supabaseChannel = {
  on: vi.fn(() => supabaseChannel),
  subscribe: vi.fn(() => supabaseChannel),
};
const removeChannel = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => supabaseChannel),
    removeChannel: (...args: any[]) => removeChannel(...args),
  },
}));

const invalidateShops = vi.fn();
const invalidateMenu = vi.fn();
vi.mock("@/lib/persistent-cache-service", () => ({
  PersistentCacheService: {
    getShops: vi.fn(async (fn: any) => await fn()),
    getMenu: vi.fn(async (fn: any) => await fn()),
    getSuppliers: vi.fn(async (fn: any) => await fn()),
    getTariffs: vi.fn(async (fn: any) => await fn()),
    getCurrencies: vi.fn(async (fn: any) => await fn()),
    getAuthMe: vi.fn(async (fn: any) => await fn()),
    invalidateShops: (...args: any[]) => invalidateShops(...args),
    invalidateMenu: (...args: any[]) => invalidateMenu(...args),
  },
}));

const getDashboardStats = vi.fn();
vi.mock("@/lib/dashboard-service", () => ({
  DashboardService: {
    getDashboardStats: (...args: any[]) => getDashboardStats(...args),
    clearCache: vi.fn(),
  },
}));

const getShopsAggregated = vi.fn();
const getShopDetail = vi.fn();
vi.mock("@/lib/shop-service", () => ({
  ShopService: {
    getShopsAggregated: (...args: any[]) => getShopsAggregated(...args),
    getShopDetail: (...args: any[]) => getShopDetail(...args),
  },
}));

import { ShopsList } from "@/components/user/shops/ShopsList";
import UserDashboard from "@/pages/UserDashboard";
import { ShopCountsService } from "@/lib/shop-counts";
import { useCountersRealtime } from "@/hooks/useCountersRealtime";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
}

function createOutletContext(userId: string) {
  return {
    user: {
      id: userId,
      email: "a@b.com",
      name: "Alice",
      role: "user",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    subscription: { hasValidSubscription: true, subscription: null, isDemo: false },
    tariffLimits: [],
    refetch: () => void 0,
  };
}

describe("Counters sync on pages", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("invalidate с refetch:inactive обновляет кеш неактивного /user/shops", async () => {
    getShopsAggregated
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 4, categoriesCount: 1 }])
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 3, categoriesCount: 1 }]);

    const queryClient = createTestQueryClient();
    await queryClient.prefetchQuery({
      queryKey: ["user", "u1", "shops"],
      queryFn: async () => await getShopsAggregated({ forceCounts: true }),
    });

    expect(getShopsAggregated).toHaveBeenCalledTimes(1);
    expect((queryClient.getQueryData(["user", "u1", "shops"]) as any)?.[0]?.productsCount).toBe(4);

    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync", { broadcast: false, refetch: "inactive" });
    });

    await waitFor(() => expect(getShopsAggregated).toHaveBeenCalledTimes(2));
    expect((queryClient.getQueryData(["user", "u1", "shops"]) as any)?.[0]?.productsCount).toBe(3);
  });

  it("/user/shops: счетчики товаров/категорий обновляются синхронно после invalidate", async () => {
    getShopsAggregated
      .mockResolvedValueOnce([
        { id: "s1", store_name: "MMA", marketplace: "MMA", is_active: true, productsCount: 0, categoriesCount: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "s1", store_name: "MMA", marketplace: "MMA", is_active: true, productsCount: 1, categoriesCount: 1 },
      ]);

    const Parent = ({ context }: { context: any }) => <Outlet context={context} />;
    const context = createOutletContext("u1");

    const router = createMemoryRouter(
      [
        {
          path: "/user",
          element: <Parent context={context} />,
          children: [{ path: "shops", element: <ShopsList userId="u1" /> }],
        },
      ],
      { initialEntries: ["/user/shops"] },
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("user_shop_item_products_s1")).toHaveTextContent("0");
    expect(await screen.findByTestId("user_shop_item_categories_s1")).toHaveTextContent("0");

    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync");
    });

    await waitFor(() => expect(getShopsAggregated).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("user_shop_item_products_s1")).toHaveTextContent("1");
    expect(await screen.findByTestId("user_shop_item_categories_s1")).toHaveTextContent("1");
  });

  it("/user/dashboard: счетчики магазинов и totals обновляются после invalidate", async () => {
    getDashboardStats
      .mockResolvedValueOnce({
        suppliers: [],
        stores: [{ id: "s1", store_name: "MMA", productsCount: 0 }],
        totalProducts: 0,
        totalCategories: 0,
      })
      .mockResolvedValueOnce({
        suppliers: [],
        stores: [{ id: "s1", store_name: "MMA", productsCount: 1 }],
        totalProducts: 1,
        totalCategories: 1,
      });

    const Parent = ({ context }: { context: any }) => <Outlet context={context} />;
    const context = createOutletContext("u1");

    const router = createMemoryRouter(
      [
        {
          path: "/user",
          element: <Parent context={context} />,
          children: [{ path: "dashboard", element: <UserDashboard /> }],
        },
      ],
      { initialEntries: ["/user/dashboard"] },
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getDashboardStats).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("MMA - 0 тов.")).toBeInTheDocument();

    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync");
    });

    await waitFor(() => expect(getDashboardStats).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("MMA - 1 тов.")).toBeInTheDocument();
  });

  it("/user/products menu: счетчики магазинов обновляются после invalidate shops key", async () => {
    const ShopsMenuCounters = ({ uid }: { uid: string }) => {
      const key = ["user", uid, "shops"] as const;
      const q = useQuery({
        queryKey: key,
        queryFn: async () => await getShopsAggregated({ forceCounts: true }),
        staleTime: 900_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      });
      const first = Array.isArray(q.data) ? q.data[0] : null;
      const count = first?.productsCount ?? 0;
      return <div data-testid="shops_menu_first_products">{count}</div>;
    };

    getShopsAggregated
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 0, categoriesCount: 0 }])
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 2, categoriesCount: 1 }]);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ShopsMenuCounters uid="u1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("shops_menu_first_products")).toHaveTextContent("0");

    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync");
    });

    await waitFor(() => expect(getShopsAggregated).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("shops_menu_first_products")).toHaveTextContent("2");
  });

  it("/user/shops/:id: счетчик shopDetail refetch после invalidate", async () => {
    const ShopDetailCounter = ({ uid, storeId }: { uid: string; storeId: string }) => {
      const key = ShopCountsService.shopDetailKey(uid, storeId);
      const q = useQuery({
        queryKey: key,
        queryFn: async () => await getShopDetail(storeId),
        retry: false,
      });
      return <div data-testid="shop_detail_products">{q.data?.productsCount ?? 0}</div>;
    };

    getShopDetail.mockResolvedValueOnce({ id: "s1", productsCount: 0 }).mockResolvedValueOnce({ id: "s1", productsCount: 3 });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ShopDetailCounter uid="u1" storeId="s1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("shop_detail_products")).toHaveTextContent("0");
    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync");
    });
    await waitFor(() => expect(getShopDetail).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("shop_detail_products")).toHaveTextContent("3");
  });

  it("Кросс-вкладочная синхронизация: storage-event приводит к refetch активных счетчиков", async () => {
    const RealtimeHarness = ({ uid }: { uid: string }) => {
      useCountersRealtime(uid);
      const key = ["user", uid, "shops"] as const;
      const q = useQuery({
        queryKey: key,
        queryFn: async () => await getShopsAggregated({ forceCounts: true }),
        retry: false,
      });
      const first = Array.isArray(q.data) ? q.data[0] : null;
      return <div data-testid="shops_first_products">{first?.productsCount ?? 0}</div>;
    };

    getShopsAggregated
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 0, categoriesCount: 0 }])
      .mockResolvedValueOnce([{ id: "s1", store_name: "MMA", productsCount: 5, categoriesCount: 1 }]);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RealtimeHarness uid="u1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("shops_first_products")).toHaveTextContent("0");

    const evt = {
      type: "shop_counts_invalidate",
      tabId: "other-tab",
      ts: Date.now(),
      userId: "u1",
      storeIds: ["s1"],
      reason: "external",
    };

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ShopCountsService.syncStorageKey(),
          newValue: JSON.stringify(evt),
        }),
      );
    });

    await waitFor(() => expect(getShopsAggregated).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("shops_first_products")).toHaveTextContent("5");
  });

  it("Ошибки: если refetch упал, UI сохраняет предыдущее значение счетчика", async () => {
    getShopsAggregated
      .mockResolvedValueOnce([
        { id: "s1", store_name: "MMA", marketplace: "MMA", is_active: true, productsCount: 1, categoriesCount: 1 },
      ])
      .mockRejectedValueOnce(new Error("network_down"));

    const Parent = ({ context }: { context: any }) => <Outlet context={context} />;
    const context = createOutletContext("u1");

    const router = createMemoryRouter(
      [
        {
          path: "/user",
          element: <Parent context={context} />,
          children: [{ path: "shops", element: <ShopsList userId="u1" /> }],
        },
      ],
      { initialEntries: ["/user/shops"] },
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("user_shop_item_products_s1")).toHaveTextContent("1");

    await act(async () => {
      ShopCountsService.invalidate(queryClient, "u1", ["s1"], "test_sync");
    });

    await waitFor(() => expect(getShopsAggregated).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("user_shop_item_products_s1")).toHaveTextContent("1");
  });
});
