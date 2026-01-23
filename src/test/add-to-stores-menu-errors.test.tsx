import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/i18n", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useI18n: () => ({
    t: (key: string) =>
      ({
        failed_load_shops: "Не вдалося завантажити магазини",
        add_to_stores: "Додати до магазинів",
        select_store: "Обрати магазин",
        loading: "Завантаження",
      } as Record<string, string | undefined>)[key] || `[${key}]`,
  }),
}));

import { AddToStoresMenu } from "@/components/user/products/ProductsTable/AddToStoresMenu";
import { toast } from "sonner";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
}

function Harness({ loadStoresForMenu }: { loadStoresForMenu: () => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [stores, setStores] = React.useState<any[]>([{ id: "s1", store_name: "MMA", productsCount: 1, categoriesCount: 1 }]);
  const [selectedStoreIds, setSelectedStoreIds] = React.useState<string[]>([]);
  const [removingStores, setRemovingStores] = React.useState(false);
  const [removingStoreId, setRemovingStoreId] = React.useState<string | null>(null);
  const [addingStores, setAddingStores] = React.useState(false);

  const queryClient = new QueryClient();
  const table = {
    getSelectedRowModel: () => ({ rows: [] }),
    resetRowSelection: () => void 0,
  } as any;

  return (
    <AddToStoresMenu
      open={open}
      setOpen={setOpen}
      loadStoresForMenu={loadStoresForMenu}
      stores={stores}
      setStores={setStores}
      selectedStoreIds={selectedStoreIds}
      setSelectedStoreIds={setSelectedStoreIds}
      items={[{ id: "p1", linkedStoreIds: ["s1"] } as any]}
      table={table}
      removingStores={removingStores}
      setRemovingStores={setRemovingStores}
      removingStoreId={removingStoreId}
      setRemovingStoreId={setRemovingStoreId}
      queryClient={queryClient as any}
      addingStores={addingStores}
      setAddingStores={setAddingStores}
      setProductsCached={() => void 0}
    />
  );
}

describe("AddToStoresMenu error handling", () => {
  it("показывает toast при ошибке загрузки магазинов", async () => {
    const loadStoresForMenu = vi.fn(async () => {
      throw new Error("network_down");
    });

    const Parent = ({ context }: { context: any }) => <Outlet context={context} />;
    const context = { user: { id: "u1" } };

    const router = createMemoryRouter(
      [
        {
          path: "/user",
          element: <Parent context={context} />,
          children: [{ path: "products", element: <Harness loadStoresForMenu={loadStoresForMenu} /> }],
        },
      ],
      { initialEntries: ["/user/products"] },
    );

    const qc = createTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const trigger = await screen.findByTestId("user_products_dataTable_addToStores");
    fireEvent.pointerDown(trigger);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося завантажити магазини"));
  });
});
