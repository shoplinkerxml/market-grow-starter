import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useProductsRealtime } from "@/hooks/useProductsRealtime";
import { useProductLinksRealtime } from "@/hooks/useProductLinksRealtime";
import { ProductService } from "@/lib/product-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { type ShopAggregated } from "@/lib/shop-service";
import { ShopCountsService } from "@/lib/shop-counts";
import type { ProductRow } from "./columns";
import { DEFAULT_PRODUCTS_SERVER_FILTERS, type ProductsServerFilters } from "./state";
import { ProductsWithDetailsService } from "@/lib/product/products-with-details-service";

type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };
type ResponseData = { products: ProductRow[]; page: PageInfo };

const NO_STORE_FILTER_ID = "__no_store__";

export type ProductsDataArgs = {
  uid: string;
  storeId?: string;
  pageSize: number;
  pageIndex: number;
  refreshTrigger?: number;
  onProductsLoaded?: (count: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  serverFilters?: ProductsServerFilters;
};

function normalizeServerFilters(filters: ProductsServerFilters | undefined, storeId?: string) {
  const f = filters || DEFAULT_PRODUCTS_SERVER_FILTERS;
  const supplierIds = Array.from(
    new Set((f.supplierIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))),
  ).sort((a, b) => a - b);
  const categoryIds = Array.from(
    new Set((f.categoryIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))),
  ).sort((a, b) => a - b);
  const storeIdsRaw = storeId ? [] : Array.from(new Set((f.storeIds || []).map(String).filter(Boolean)));
  const storeIds =
    storeIdsRaw.includes(NO_STORE_FILTER_ID)
      ? [NO_STORE_FILTER_ID]
      : storeIdsRaw.sort((a, b) => a.localeCompare(b));
  const stockMin = f.stockMin == null ? null : (Number.isFinite(Number(f.stockMin)) ? Number(f.stockMin) : null);
  const stockMax = f.stockMax == null ? null : (Number.isFinite(Number(f.stockMax)) ? Number(f.stockMax) : null);
  const priceOrder = f.priceOrder === "asc" || f.priceOrder === "desc" ? f.priceOrder : null;
  return { supplierIds, categoryIds, storeIds, stockMin, stockMax, priceOrder };
}

function isDefaultNormalizedFilters(normalized: ReturnType<typeof normalizeServerFilters>) {
  return (
    normalized.priceOrder == null &&
    normalized.supplierIds.length === 0 &&
    normalized.categoryIds.length === 0 &&
    normalized.storeIds.length === 0 &&
    normalized.stockMin == null &&
    normalized.stockMax == null
  );
}

export function useProductsData({ uid, storeId, pageSize, pageIndex, refreshTrigger, onProductsLoaded, onLoadingChange, serverFilters }: ProductsDataArgs) {
  const queryClient = useQueryClient();
  const productsBaseKey = useMemo(() => ["user", uid, "products", storeId ?? "all"] as const, [uid, storeId]);
  const normalizedFilters = useMemo(() => normalizeServerFilters(serverFilters, storeId), [serverFilters, storeId]);
  const filtersKey = useMemo(() => JSON.stringify(normalizedFilters), [normalizedFilters]);
  const productsQueryKey = useMemo(
    () => [...productsBaseKey, "pageSize", pageSize, "filters", filtersKey] as const,
    [productsBaseKey, pageSize, filtersKey],
  );
  const shopsMenuKey = useMemo(() => ["user", uid, "shops", "menu"] as const, [uid]);

  const mapUserStoresToAgg = useCallback((rows: Array<{ id: string; store_name: string }>) => {
    const baseIso = new Date(0).toISOString();
    return rows.map((s) => ({
      id: String(s.id),
      user_id: String(uid),
      store_name: String(s.store_name || ""),
      store_company: null,
      store_url: null,
      template_id: null,
      xml_config: null,
      custom_mapping: null,
      marketplace: undefined,
      is_active: true,
      created_at: baseIso,
      updated_at: baseIso,
    })) as ShopAggregated[];
  }, [uid]);

  const productsQuery = useInfiniteQuery<ResponseData, Error, InfiniteData<ResponseData, number>, typeof productsQueryKey, number>({
    queryKey: productsQueryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number.isFinite(pageParam) ? pageParam : 0;
      if (isDefaultNormalizedFilters(normalizedFilters)) {
        const { products, page } = await ProductService.getProductsPage(storeId ?? null, pageSize, offset);
        return { products: products as unknown as ProductRow[], page: page as unknown as PageInfo };
      }
      const { products, page } = await ProductsWithDetailsService.getProductsPage(
        {
          storeId: storeId ?? null,
          storeIds: normalizedFilters.storeIds,
          supplierIds: normalizedFilters.supplierIds,
          categoryIds: normalizedFilters.categoryIds,
          stockMin: normalizedFilters.stockMin,
          stockMax: normalizedFilters.stockMax,
          priceOrder: normalizedFilters.priceOrder,
        },
        pageSize,
        offset,
      );
      return { products: products as unknown as ProductRow[], page: page as unknown as PageInfo };
    },
    getNextPageParam: (lastPage) => (lastPage?.page?.nextOffset == null ? undefined : lastPage.page.nextOffset),
    placeholderData: (prev) => prev,
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(
    () => (productsQuery.data?.pages || []).flatMap((p) => (Array.isArray(p?.products) ? p.products : [])),
    [productsQuery.data],
  );

  const pageInfo: PageInfo | null = useMemo(() => {
    const pages = productsQuery.data?.pages || [];
    const last = pages.length > 0 ? pages[pages.length - 1] : null;
    return (last?.page as PageInfo | undefined) ?? null;
  }, [productsQuery.data]);

  const loading = productsQuery.isPending || (productsQuery.isFetching && items.length === 0);

  const setProductsCached = useCallback(
    (updater: (prev: ProductRow[]) => ProductRow[]) => {
      queryClient.setQueriesData({ queryKey: productsBaseKey, exact: false }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return updater(old as ProductRow[]);
        if (typeof old === "object" && Array.isArray((old as any).pages)) {
          const prev = old as any;
          return {
            ...prev,
            pages: prev.pages.map((p: any) => {
              const products = Array.isArray(p?.products) ? (p.products as ProductRow[]) : [];
              return { ...p, products: updater(products) };
            }),
          };
        }
        return old;
      });
    },
    [queryClient, productsBaseKey],
  );

  const onProductsLoadedRef = useRef(onProductsLoaded);
  const onLoadingChangeRef = useRef(onLoadingChange);
  useEffect(() => {
    onProductsLoadedRef.current = onProductsLoaded;
  }, [onProductsLoaded]);
  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    onLoadingChangeRef.current?.(productsQuery.isFetching);
  }, [productsQuery.isFetching]);

  useEffect(() => {
    const total = Math.max(pageInfo?.total ?? 0, items.length);
    onProductsLoadedRef.current?.(total);
  }, [items.length, pageInfo]);

  const readStoreProductsCount = useCallback((): { count: number; source: "shopCounts" | "shopDetail" | "shopsList" } | null => {
    if (!storeId) return null;
    const sid = String(storeId);

    const fromCounts = queryClient.getQueryData<{ productsCount?: number }>(ShopCountsService.key(uid, sid));
    if (fromCounts && typeof fromCounts.productsCount === "number") {
      return { count: Math.max(0, Number(fromCounts.productsCount) || 0), source: "shopCounts" };
    }

    const fromDetail = queryClient.getQueryData<ShopAggregated | null>(ShopCountsService.shopDetailKey(uid, sid));
    if (fromDetail && typeof (fromDetail as any).productsCount === "number") {
      return { count: Math.max(0, Number((fromDetail as any).productsCount) || 0), source: "shopDetail" };
    }

    const list = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]);
    const fromList = Array.isArray(list) ? (list || []).find((s) => String(s.id) === sid) : null;
    if (fromList && typeof (fromList as any).productsCount === "number") {
      return { count: Math.max(0, Number((fromList as any).productsCount) || 0), source: "shopsList" };
    }

    return null;
  }, [queryClient, storeId, uid]);

  useEffect(() => {
    if (!storeId) return;

    const emit = () => {
      const next = readStoreProductsCount();
      if (!next) return;

      const baseline = Math.max(0, Math.max(Number(pageInfo?.total ?? 0), items.length));
      if (next.source === "shopsList" && next.count < baseline) return;
      onProductsLoadedRef.current?.(next.count);
    };

    let scheduled = false;
    const scheduleEmit = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        emit();
      });
    };

    scheduleEmit();

    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      const key = event?.query?.queryKey;
      if (!Array.isArray(key)) return;
      if (key[0] !== "user") return;
      if (String(key[1]) !== String(uid)) return;

      const sid = String(storeId);
      const isCounts = key[2] === "shopCounts" && String(key[3]) === sid;
      const isShopsList = key[2] === "shops";
      const isShopDetail = key[2] === "shopDetail" && String(key[3]) === sid;
      if (!isCounts && !isShopsList && !isShopDetail) return;

      scheduleEmit();
    });

    return () => {
      try {
        unsubscribe();
      } catch {
        void 0;
      }
    };
  }, [items.length, pageInfo?.total, queryClient, readStoreProductsCount, storeId, uid]);

  const refreshFirstRef = useRef(true);
  useEffect(() => {
    if (refreshFirstRef.current) {
      refreshFirstRef.current = false;
      return;
    }
    if (refreshTrigger == null) return;
    queryClient.invalidateQueries({ queryKey: productsBaseKey, exact: false });
  }, [refreshTrigger, queryClient, productsBaseKey]);

  const hasNextPage = productsQuery.hasNextPage;
  const isFetchingNextPage = productsQuery.isFetchingNextPage;
  const fetchNextPage = productsQuery.fetchNextPage;
  useEffect(() => {
    const requiredForCurrent = (pageIndex + 1) * pageSize;
    const requiredForPrefetch = (pageIndex + 2) * pageSize;
    const canLoad = !!hasNextPage;
    if (!canLoad) return;
    if (isFetchingNextPage) return;
    if (items.length < requiredForCurrent) {
      void fetchNextPage();
      return;
    }
    if (items.length < requiredForPrefetch) {
      void fetchNextPage();
    }
  }, [pageIndex, pageSize, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useProductsRealtime(storeId, uid, queryClient);
  useProductLinksRealtime(uid, queryClient);
  const storesQuery = useQuery<ShopAggregated[]>({
    queryKey: shopsMenuKey,
    queryFn: async () => {
      const cachedShops = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]);
      if (Array.isArray(cachedShops) && cachedShops.length > 0) return cachedShops;
      const cachedAuthMe = queryClient.getQueryData<any>(["auth", "me"]);
      const cachedRows = Array.isArray((cachedAuthMe as any)?.userStores)
        ? ((cachedAuthMe as any).userStores as Array<{ id: string; store_name: string }>)
        : null;
      if (cachedRows && cachedRows.length > 0) return mapUserStoresToAgg(cachedRows);
      const authMe = await UserAuthService.fetchAuthMe();
      const rows = Array.isArray((authMe as any)?.userStores)
        ? ((authMe as any).userStores as Array<{ id: string; store_name: string }>)
        : [];
      if (rows.length > 0) return mapUserStoresToAgg(rows);
      
      return [];
    },
    enabled: true,
    retry: false,
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const stores = useMemo(() => (Array.isArray(storesQuery.data) ? storesQuery.data : []), [storesQuery.data]);

  const loadStoresForMenu = useCallback(async () => {
    const cachedAgg = queryClient.getQueryData<ShopAggregated[]>(shopsMenuKey) || [];
    const hasCounts =
      cachedAgg.length > 0 &&
      cachedAgg.some((s) => typeof (s as any)?.productsCount === "number" || typeof (s as any)?.categoriesCount === "number");
    if (hasCounts) return;

    const cachedShops = queryClient.getQueryData<ShopAggregated[]>(["user", uid, "shops"]);
    if (Array.isArray(cachedShops) && cachedShops.length > 0) {
      queryClient.setQueryData<ShopAggregated[]>(shopsMenuKey, cachedShops);
    }

    const cachedAuthMe = queryClient.getQueryData<any>(["auth", "me"]);
    const cachedRows = Array.isArray((cachedAuthMe as any)?.userStores)
      ? ((cachedAuthMe as any).userStores as Array<{ id: string; store_name: string }>)
      : null;
    if (cachedRows && cachedRows.length > 0) {
      const mapped = mapUserStoresToAgg(cachedRows);
      queryClient.setQueryData<ShopAggregated[]>(shopsMenuKey, mapped);
    }

    await queryClient.fetchQuery({
      queryKey: shopsMenuKey,
      queryFn: async () => {
        const authMe = await UserAuthService.fetchAuthMe();
        const rows = Array.isArray((authMe as any)?.userStores)
          ? ((authMe as any).userStores as Array<{ id: string; store_name: string }>)
          : [];
        return mapUserStoresToAgg(rows);
      },
      staleTime: 900_000,
    });
  }, [mapUserStoresToAgg, queryClient, shopsMenuKey, uid]);

  return {
    queryClient,
    productsBaseKey,
    items,
    pageInfo,
    loading,
    setProductsCached,
    stores,
    loadStoresForMenu,
  };
}
