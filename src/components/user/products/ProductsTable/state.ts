import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { CACHE_TTL, readCache, writeCache } from "@/lib/cache-utils";

export type PaginationState = { pageIndex: number; pageSize: number };

export const PAGINATION_KEY = "user_products_pagination";
export const COLUMN_VIS_KEY = "user_products_columnVisibility";

export const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 };

export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  select: true,
  created_at: false,
  supplier: true,
  vendor: false,
  available: false,
  docket_ua: false,
  description_ua: false,
  price_old: false,
  price_promo: false,
};

export const DEFAULT_COLUMN_ORDER: string[] = [
  "select",
  "photo",
  "article",
  "category",
  "name_ua",
  "docket_ua",
  "description_ua",
  "price",
  "price_old",
  "price_promo",
  "stock_quantity",
  "vendor",
  "status",
  "supplier",
  "created_at",
  "stores",
  "actions",
];

export type ProductsTableState = {
  pagination: PaginationState;
  rowSelection: Record<string, boolean>;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  storesMenuOpen: boolean;
  selectedStoreIds: string[];
  addingStores: boolean;
  removingStores: boolean;
  removingStoreId: string | null;
  deleteDialog: { open: boolean; productId: string | null };
  copyDialog: { open: boolean; name: string | null };
  deleteProgress: { open: boolean };
};

export type ProductsTableAction =
  | { type: "setPagination"; next: PaginationState | ((prev: PaginationState) => PaginationState) }
  | { type: "setRowSelection"; next: Record<string, boolean> }
  | { type: "setColumnVisibility"; next: VisibilityState }
  | { type: "setColumnOrder"; next: string[] | ((prev: string[]) => string[]) }
  | { type: "setColumnFilters"; next: ColumnFiltersState }
  | { type: "setSorting"; next: SortingState }
  | { type: "setStoresMenuOpen"; next: boolean }
  | { type: "setSelectedStoreIds"; next: string[] | ((prev: string[]) => string[]) }
  | { type: "setAddingStores"; next: boolean }
  | { type: "setRemovingStores"; next: boolean }
  | { type: "setRemovingStoreId"; next: string | null }
  | { type: "setDeleteDialog"; next: { open: boolean; productId: string | null } }
  | { type: "setCopyDialog"; next: { open: boolean; name: string | null } }
  | { type: "setDeleteProgress"; next: { open: boolean } };

export function productsTableReducer(state: ProductsTableState, action: ProductsTableAction): ProductsTableState {
  switch (action.type) {
    case "setPagination": {
      const next = typeof action.next === "function" ? action.next(state.pagination) : action.next;
      persistPaginationToPrefs(next);
      return { ...state, pagination: next };
    }
    case "setRowSelection":
      return { ...state, rowSelection: action.next };
    case "setColumnVisibility":
      persistColumnVisibilityToPrefs(action.next);
      return { ...state, columnVisibility: action.next };
    case "setColumnOrder": {
      const next = typeof action.next === "function" ? action.next(state.columnOrder) : action.next;
      return { ...state, columnOrder: next };
    }
    case "setColumnFilters":
      return { ...state, columnFilters: action.next };
    case "setSorting":
      return { ...state, sorting: action.next };
    case "setStoresMenuOpen":
      return { ...state, storesMenuOpen: action.next };
    case "setSelectedStoreIds": {
      const next = typeof action.next === "function" ? action.next(state.selectedStoreIds) : action.next;
      return { ...state, selectedStoreIds: next };
    }
    case "setAddingStores":
      return { ...state, addingStores: action.next };
    case "setRemovingStores":
      return { ...state, removingStores: action.next };
    case "setRemovingStoreId":
      return { ...state, removingStoreId: action.next };
    case "setDeleteDialog":
      return { ...state, deleteDialog: action.next };
    case "setCopyDialog":
      return { ...state, copyDialog: action.next };
    case "setDeleteProgress":
      return { ...state, deleteProgress: action.next };
    default:
      return state;
  }
}

export function ensureActionsLast(next: string[]): string[] {
  const withoutActions = next.filter((id) => id !== "actions");
  return [...withoutActions, "actions"];
}

export function withStoreSpecificColumns(order: string[], storeId?: string): string[] {
  const filtered = order.filter((id) => id !== "active" && id !== "stores" && id !== "actions");
  if (storeId) return ensureActionsLast([...filtered, "active", "actions"]);
  return ensureActionsLast([...filtered, "stores", "actions"]);
}

export function loadPaginationFromPrefs(): PaginationState {
  const env = readCache<{ pageIndex?: number; pageSize?: number }>(PAGINATION_KEY, true);
  if (env?.data) {
    const pi = typeof env.data.pageIndex === "number" ? Math.max(0, env.data.pageIndex) : 0;
    const ps = typeof env.data.pageSize === "number" ? Math.max(5, env.data.pageSize) : 10;
    return { pageIndex: pi, pageSize: ps };
  }
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(PAGINATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { pageIndex?: number; pageSize?: number };
        const pi = typeof parsed.pageIndex === "number" ? Math.max(0, parsed.pageIndex) : 0;
        const ps = typeof parsed.pageSize === "number" ? Math.max(5, parsed.pageSize) : 10;
        writeCache(PAGINATION_KEY, { pageIndex: pi, pageSize: ps }, CACHE_TTL.uiPrefs);
        return { pageIndex: pi, pageSize: ps };
      }
    }
  } catch {
    void 0;
  }
  return DEFAULT_PAGINATION;
}

export function persistPaginationToPrefs(pagination: PaginationState) {
  try {
    writeCache(PAGINATION_KEY, { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize }, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadColumnVisibilityFromPrefs(defaults: VisibilityState): VisibilityState {
  try {
    const env = readCache<VisibilityState>(COLUMN_VIS_KEY, true);
    if (env?.data) return { ...defaults, ...(env.data || {}) };
    const saved = typeof window !== "undefined" ? localStorage.getItem(COLUMN_VIS_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as VisibilityState;
      writeCache(COLUMN_VIS_KEY, parsed, CACHE_TTL.uiPrefs);
      return { ...defaults, ...(parsed || {}) };
    }
  } catch {
    void 0;
  }
  return defaults;
}

export function persistColumnVisibilityToPrefs(vis: VisibilityState) {
  try {
    writeCache(COLUMN_VIS_KEY, vis, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}
