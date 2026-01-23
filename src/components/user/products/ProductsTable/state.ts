import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { CACHE_TTL, UnifiedCacheManager } from "@/lib/cache-utils";

export type PaginationState = { pageIndex: number; pageSize: number };

export const PAGINATION_KEY = "user_products_pagination";
export const COLUMN_VIS_KEY = "user_products_columnVisibility_v3";
export const COLUMN_ORDER_KEY = "user_products_columnOrder_v1";
export const COLUMN_ORDER_STORE_KEY = "user_products_columnOrder_store_v1";
export const ROW_ORDER_ALL_KEY = "user_products_rowOrder_all_v1";
export const ROW_ORDER_STORE_PREFIX = "user_products_rowOrder_store_v1_";
export const ROW_REORDER_ENABLED_KEY = "user_products_rowReorderEnabled_v1";
export const VIEW_MODE_KEY = "user_products_viewMode_v1";

export const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 };

export type ProductsViewMode = "table" | "cards";

export type ProductsServerFilters = {
  priceOrder: "asc" | "desc" | null;
  supplierIds: number[];
  categoryIds: number[];
  storeIds: string[];
  stockMin: number | null;
  stockMax: number | null;
};

export const DEFAULT_PRODUCTS_SERVER_FILTERS: ProductsServerFilters = {
  priceOrder: null,
  supplierIds: [],
  categoryIds: [],
  storeIds: [],
  stockMin: null,
  stockMax: null,
};

export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  select: true,
  article: true,
  photo: true,
  name_ua: true,
  price: true,
  stock_quantity: true,
  supplier: true,
  stores: true,
  actions: true,
  status: false,
  category: false,
  created_at: false,
  vendor: false,
  active: false,
  docket_ua: false,
  description_ua: false,
  price_old: false,
  price_promo: false,
};

export const DEFAULT_COLUMN_ORDER: string[] = [
  "select",
  "article",
  "photo",
  "name_ua",
  "price",
  "stock_quantity",
  "supplier",
  "stores",
  "status",
  "category",
  "price_old",
  "price_promo",
  "vendor",
  "docket_ua",
  "description_ua",
  "created_at",
  "actions",
];

export const DEFAULT_COLUMN_ORDER_STORE: string[] = DEFAULT_COLUMN_ORDER.filter((id) => id !== "stores");

const uiPrefsCache = UnifiedCacheManager.create("auth:uiPrefs", {
  mode: "local",
  defaultTtlMs: CACHE_TTL.uiPrefs,
});

export type ProductsTableState = {
  pagination: PaginationState;
  rowSelection: Record<string, boolean>;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  rowOrder: string[];
  rowReorderEnabled: boolean;
  viewMode: ProductsViewMode;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  filtersOpen: boolean;
  serverFilters: ProductsServerFilters;
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
  | { type: "setColumnOrder"; next: string[] | ((prev: string[]) => string[]); storageKey?: string }
  | { type: "setRowOrder"; next: string[] | ((prev: string[]) => string[]); storageKey: string }
  | { type: "setRowReorderEnabled"; next: boolean | ((prev: boolean) => boolean) }
  | { type: "setViewMode"; next: ProductsViewMode }
  | { type: "setColumnFilters"; next: ColumnFiltersState }
  | { type: "setSorting"; next: SortingState }
  | { type: "setFiltersOpen"; next: boolean }
  | { type: "setServerFilters"; next: ProductsServerFilters | ((prev: ProductsServerFilters) => ProductsServerFilters) }
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
      persistColumnOrderToPrefs(next, action.storageKey);
      return { ...state, columnOrder: next };
    }
    case "setRowOrder": {
      const next = typeof action.next === "function" ? action.next(state.rowOrder) : action.next;
      persistRowOrderToPrefs(next, action.storageKey);
      return { ...state, rowOrder: next };
    }
    case "setRowReorderEnabled": {
      const next = typeof action.next === "function" ? action.next(state.rowReorderEnabled) : action.next;
      persistRowReorderEnabledToPrefs(next);
      return { ...state, rowReorderEnabled: next };
    }
    case "setViewMode":
      persistViewModeToPrefs(action.next);
      return { ...state, viewMode: action.next };
    case "setColumnFilters":
      return { ...state, columnFilters: action.next };
    case "setSorting":
      return { ...state, sorting: action.next };
    case "setFiltersOpen":
      return { ...state, filtersOpen: action.next };
    case "setServerFilters": {
      const next = typeof action.next === "function" ? action.next(state.serverFilters) : action.next;
      const nextPagination = { ...state.pagination, pageIndex: 0 };
      persistPaginationToPrefs(nextPagination);
      return { ...state, serverFilters: next, pagination: nextPagination, rowSelection: {} };
    }
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
  const withoutActive = order.filter((id) => id !== "active");
  if (!storeId) return ensureActionsLast(withoutActive);

  if (order.includes("active")) return ensureActionsLast(order);

  const idx = withoutActive.indexOf("actions");
  const next = idx === -1 ? [...withoutActive, "active"] : [...withoutActive.slice(0, idx), "active", ...withoutActive.slice(idx)];
  return ensureActionsLast(next);
}

function normalizeColumnOrder(saved: unknown, defaults: string[]): string[] {
  const allowed = new Set([...defaults, "active"]);
  const raw = Array.isArray(saved) ? saved : [];
  const uniq: string[] = [];
  const seen = new Set<string>();

  for (const v of raw) {
    const id = String(v);
    if (!allowed.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
  }

  for (const id of defaults) {
    if (!seen.has(id)) {
      seen.add(id);
      uniq.push(id);
    }
  }

  const withoutActions = uniq.filter((id) => id !== "actions");
  const withActions = [...withoutActions, "actions"];
  if (!withActions.includes("select")) return withActions;
  const withoutSelect = withActions.filter((id) => id !== "select");
  return ["select", ...withoutSelect];
}

function normalizeRowOrder(saved: unknown): string[] {
  const raw = Array.isArray(saved) ? saved : [];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const id = String(v);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
  }
  return uniq;
}

export function loadPaginationFromPrefs(): PaginationState {
  const cached = uiPrefsCache.get<{ pageIndex?: number; pageSize?: number }>(PAGINATION_KEY, true);
  if (cached) {
    const pi = typeof cached.pageIndex === "number" ? Math.max(0, cached.pageIndex) : 0;
    const ps = typeof cached.pageSize === "number" ? Math.max(5, cached.pageSize) : 10;
    return { pageIndex: pi, pageSize: ps };
  }
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(PAGINATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { pageIndex?: number; pageSize?: number };
        const pi = typeof parsed.pageIndex === "number" ? Math.max(0, parsed.pageIndex) : 0;
        const ps = typeof parsed.pageSize === "number" ? Math.max(5, parsed.pageSize) : 10;
        uiPrefsCache.set(PAGINATION_KEY, { pageIndex: pi, pageSize: ps }, CACHE_TTL.uiPrefs);
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
    uiPrefsCache.set(PAGINATION_KEY, { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize }, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadColumnVisibilityFromPrefs(defaults: VisibilityState): VisibilityState {
  try {
    const cached = uiPrefsCache.get<VisibilityState>(COLUMN_VIS_KEY, true);
    if (cached) return { ...defaults, ...(cached || {}) };
    const saved = typeof window !== "undefined" ? localStorage.getItem(COLUMN_VIS_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as VisibilityState;
      uiPrefsCache.set(COLUMN_VIS_KEY, parsed, CACHE_TTL.uiPrefs);
      return { ...defaults, ...(parsed || {}) };
    }
  } catch {
    void 0;
  }
  return defaults;
}

export function persistColumnVisibilityToPrefs(vis: VisibilityState) {
  try {
    uiPrefsCache.set(COLUMN_VIS_KEY, vis, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadColumnOrderFromPrefs(defaults: string[], storageKey: string = COLUMN_ORDER_KEY): string[] {
  try {
    const cached = uiPrefsCache.get<string[]>(storageKey, true);
    if (cached) return normalizeColumnOrder(cached, defaults);
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      uiPrefsCache.set(storageKey, parsed as any, CACHE_TTL.uiPrefs);
      return normalizeColumnOrder(parsed, defaults);
    }
  } catch {
    void 0;
  }
  return normalizeColumnOrder(defaults, defaults);
}

export function persistColumnOrderToPrefs(order: string[], storageKey: string = COLUMN_ORDER_KEY) {
  try {
    uiPrefsCache.set(storageKey, order, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadRowOrderFromPrefs(storageKey: string): string[] {
  try {
    const cached = uiPrefsCache.get<string[]>(storageKey, true);
    if (cached) return normalizeRowOrder(cached);
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      uiPrefsCache.set(storageKey, parsed as any, CACHE_TTL.uiPrefs);
      return normalizeRowOrder(parsed);
    }
  } catch {
    void 0;
  }
  return [];
}

export function persistRowOrderToPrefs(order: string[], storageKey: string) {
  try {
    uiPrefsCache.set(storageKey, normalizeRowOrder(order), CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadRowReorderEnabledFromPrefs(): boolean {
  try {
    const cached = uiPrefsCache.get<boolean>(ROW_REORDER_ENABLED_KEY, true);
    if (typeof cached === "boolean") return cached;
    const saved = typeof window !== "undefined" ? localStorage.getItem(ROW_REORDER_ENABLED_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      const v = parsed === true;
      uiPrefsCache.set(ROW_REORDER_ENABLED_KEY, v, CACHE_TTL.uiPrefs);
      return v;
    }
  } catch {
    void 0;
  }
  return false;
}

export function persistRowReorderEnabledToPrefs(enabled: boolean) {
  try {
    uiPrefsCache.set(ROW_REORDER_ENABLED_KEY, enabled === true, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}

export function loadViewModeFromPrefs(): ProductsViewMode {
  try {
    const cached = uiPrefsCache.get<ProductsViewMode>(VIEW_MODE_KEY, true);
    if (cached === "cards" || cached === "table") return cached;
    const saved = typeof window !== "undefined" ? localStorage.getItem(VIEW_MODE_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      const v = parsed === "cards" ? "cards" : "table";
      uiPrefsCache.set(VIEW_MODE_KEY, v, CACHE_TTL.uiPrefs);
      return v;
    }
  } catch {
    void 0;
  }
  return "table";
}

export function persistViewModeToPrefs(mode: ProductsViewMode) {
  try {
    uiPrefsCache.set(VIEW_MODE_KEY, mode, CACHE_TTL.uiPrefs);
  } catch {
    void 0;
  }
}
