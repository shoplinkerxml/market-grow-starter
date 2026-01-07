import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useProductsRealtime } from "@/hooks/useProductsRealtime";
import { ProductService } from "@/lib/product-service";
import { UserAuthService } from "@/lib/user-auth-service";
import { ShopService, type ShopAggregated } from "@/lib/shop-service";
import { ShopCountsService } from "@/lib/shop-counts";
import type { ProductRow } from "./columns";

type PageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; total: number };
type ResponseData = { products: ProductRow[]; page: PageInfo };

export type ProductsDataArgs = {
  uid: string;
  storeId?: string;
  pageSize: number;
  pageIndex: number;
  refreshTrigger?: number;
  onProductsLoaded?: (count: number) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export function useProductsData({ uid, storeId, pageSize, pageIndex, refreshTrigger, onProductsLoaded, onLoadingChange }: ProductsDataArgs) {
  const queryClient = useQueryClient();
  const productsBaseKey = useMemo(() => ["user", uid, "products", storeId ?? "all"] as const, [uid, storeId]);
  const productsQueryKey = useMemo(() => [...productsBaseKey, "pageSize", pageSize] as const, [productsBaseKey, pageSize]);
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
      const { products, page } = await ProductService.getProductsPage(storeId ?? null, pageSize, offset);
      return { products: products as unknown as ProductRow[], page: page as unknown as PageInfo };
    },
    getNextPageParam: (lastPage) => (lastPage?.page?.nextOffset == null ? undefined : lastPage.page.nextOffset),
    placeholderData: (prev) => prev,
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
    const total = pageInfo?.total ?? items.length;
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

      const baseline = Math.max(0, Number(pageInfo?.total ?? items.length) || 0);
      if (next.source === "shopsList" && next.count < baseline) return;
      onProductsLoadedRef.current?.(next.count);
    };

    emit();

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

      emit();
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
      try {
        const shops = await ShopService.getShopsAggregated({ force: false });
        if (Array.isArray(shops) && shops.length > 0) return shops as ShopAggregated[];
      } catch {
        void 0;
      }
      return [];
    },
    enabled: !storeId,
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

    try {
      const shops = await ShopService.getShopsAggregated({ force: true });
      if (Array.isArray(shops) && shops.length > 0) {
        queryClient.setQueryData<ShopAggregated[]>(shopsMenuKey, shops);
        return;
      }
    } catch {
      void 0;
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
