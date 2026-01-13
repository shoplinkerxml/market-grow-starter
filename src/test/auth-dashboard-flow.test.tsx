import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

vi.mock("@/i18n", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useI18n: () => ({
    t: (key: string) =>
      ({
        menu_main: "Main",
        menu_dashboard: "Dashboard",
        suppliers_title: "Suppliers",
        shops_title: "Shops",
        totals_title: "Totals",
        total_products: "Total products",
        total_categories: "Total categories",
        no_suppliers: "No suppliers",
        no_shops: "No shops",
        products_count_suffix: "products",
        active_tariff_title: "Active tariff",
        subscription_expired: "Subscription expired",
        please_select_new_tariff: "Please select a new tariff",
        until: "until",
      } as Record<string, string | undefined>)[key],
  }),
}));

const signInWithPassword = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => signInWithPassword(...args),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const waitForValidSession = vi.fn();
const clearCache = vi.fn();
vi.mock("@/lib/session-validation", () => ({
  SessionValidator: {
    waitForValidSession: (...args: any[]) => waitForValidSession(...args),
    clearCache: (...args: any[]) => clearCache(...args),
  },
}));

const getDashboardStats = vi.fn();
vi.mock("@/lib/dashboard-service", () => ({
  DashboardService: {
    getDashboardStats: (...args: any[]) => getDashboardStats(...args),
    clearCache: vi.fn(),
  },
}));

import { loginUser } from "@/lib/user-auth-login";
import UserDashboard from "@/pages/UserDashboard";

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

describe("auth + dashboard flow", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("authorizes and returns user only after auth-me becomes available", async () => {
    vi.useFakeTimers();

    signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: "u1", email: "a@b.com" },
        session: {
          access_token: "t",
          refresh_token: "r",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: "u1", email: "a@b.com" },
        },
      },
      error: null,
    });

    waitForValidSession.mockResolvedValueOnce({
      isValid: true,
      user: { id: "u1" },
      session: { user: { id: "u1" } },
      accessToken: "t",
      refreshToken: "r",
      expiresAt: Date.now() + 3600_000,
      timeUntilExpiry: 3600_000,
      needsRefresh: false,
      error: null,
    });

    const clearAuthMeCache = vi.fn();
    const fetchAuthMe = vi
      .fn()
      .mockResolvedValueOnce({ user: null })
      .mockResolvedValueOnce({
        user: {
          id: "u1",
          email: "a@b.com",
          name: "Alice",
          role: "user",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

    const resultPromise = loginUser(
      { email: "a@b.com", password: "p" },
      {
        mapSupabaseError: () => "mapped_error",
        clearAuthMeCache,
        fetchAuthMe,
      },
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(waitForValidSession).toHaveBeenCalledWith("u1", 5_000);
    expect(fetchAuthMe).toHaveBeenCalledTimes(2);
    expect(result.user?.id).toBe("u1");
    expect(result.error).toBeNull();
  });

  it("loads dashboard and renders stats from service", async () => {
    getDashboardStats.mockResolvedValueOnce({
      suppliers: [],
      stores: [],
      totalProducts: 7,
      totalCategories: 3,
    });

    const Parent = ({
      context,
    }: {
      context: {
        user: any;
        subscription: any;
        tariffLimits: any[];
        refetch: () => void;
      };
    }) => <Outlet context={context} />;

    const context = {
      user: {
        id: "u1",
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
    expect(await screen.findByText("Totals")).toBeInTheDocument();
    expect(await screen.findByText(/Total products/i)).toBeInTheDocument();
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(await screen.findByText(/Total categories/i)).toBeInTheDocument();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });
});
