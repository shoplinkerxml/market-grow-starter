import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useProductsRealtime } from "@/hooks/useProductsRealtime";
import { ProductService } from "@/lib/product-service";
import { ShopService, type ShopAggregated } from "@/lib/shop-service";
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
    queryKey: ["user", uid, "shops"],
    queryFn: async () => {
      const rows = await ShopService.getShopsAggregated();
      return rows as ShopAggregated[];
    },
    enabled: !storeId,
    retry: false,
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const stores = useMemo(() => (Array.isArray(storesQuery.data) ? storesQuery.data : []), [storesQuery.data]);

  const loadStoresForMenu = useCallback(async () => {
    await queryClient.fetchQuery({
      queryKey: ["user", uid, "shops"],
      queryFn: async () => {
        const rows = await ShopService.getShopsAggregated();
        return rows as ShopAggregated[];
      },
      staleTime: 900_000,
    });
  }, [queryClient, uid]);

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
