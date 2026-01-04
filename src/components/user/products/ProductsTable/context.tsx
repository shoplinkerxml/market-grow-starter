import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Table as TanTable } from "@tanstack/react-table";
import type { Product } from "@/lib/product-service";
import type { ProductRow } from "./columns";
import type { ShopAggregated } from "@/lib/shop-service";

export type ProductsTableContextValue = {
  t: (k: string) => string;
  table: TanTable<ProductRow>;
  storeId?: string;
  onCreateNew?: () => void;
  onEdit?: (p: ProductRow) => void;
  canCreate?: boolean;
  hideDuplicate?: boolean;
  loading: boolean;
  duplicating: boolean;
  queryClient: QueryClient;
  items: ProductRow[];
  stores: ShopAggregated[];
  setStores: (v: ShopAggregated[]) => void;
  storesMenuOpen: boolean;
  setStoresMenuOpen: (v: boolean) => void;
  selectedStoreIds: string[];
  setSelectedStoreIds: Dispatch<SetStateAction<string[]>>;
  removingStores: boolean;
  setRemovingStores: (v: boolean) => void;
  removingStoreId: string | null;
  setRemovingStoreId: (v: string | null) => void;
  addingStores: boolean;
  setAddingStores: (v: boolean) => void;
  setDeleteDialog: (v: { open: boolean; product: ProductRow | null }) => void;
  handleDuplicate: (p: Product) => Promise<void>;
  loadStoresForMenu: () => Promise<void>;
  setProductsCached: (updater: (prev: ProductRow[]) => ProductRow[]) => void;
};

const ProductsTableContext = createContext<ProductsTableContextValue | null>(null);

export function ProductsTableProvider({
  value,
  children,
}: {
  value: ProductsTableContextValue;
  children: ReactNode;
}) {
  return <ProductsTableContext.Provider value={value}>{children}</ProductsTableContext.Provider>;
}

export function useProductsTableContext(): ProductsTableContextValue {
  const ctx = useContext(ProductsTableContext);
  if (!ctx) throw new Error("useProductsTableContext must be used within ProductsTableProvider");
  return ctx;
}
