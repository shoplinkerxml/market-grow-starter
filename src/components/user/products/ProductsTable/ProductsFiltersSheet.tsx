import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useProductsTableContext } from "./context";
import { DEFAULT_PRODUCTS_SERVER_FILTERS } from "./state";
import { ProductService } from "@/lib/product-service";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";

const NO_STORE_FILTER_ID = "__no_store__";

function toggleInArray<T extends string | number>(prev: T[], value: T, checked: boolean): T[] {
  if (checked) return Array.from(new Set([...prev, value]));
  return prev.filter((v) => String(v) !== String(value));
}

export function ProductsFiltersSheet() {
  const { t, storeId, stores, filtersOpen, setFiltersOpen, serverFilters, setServerFilters, userId, items } = useProductsTableContext();

  const hasNoStoreProductsQuery = useQuery({
    queryKey: ["user", userId, "products", "hasNoStoreProducts"],
    queryFn: async () => {
      if (!userId) return false;
      const resp = await supabase
        .from("products_with_details")
        .select("id, store_product_links(is_active)")
        .eq("owner_user_id", String(userId))
        .is("store_product_links", null)
        .limit(1);

      if (resp.error) throw new Error(resp.error.message);
      return Array.isArray(resp.data) && resp.data.length > 0;
    },
    enabled: filtersOpen && !storeId && !!userId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
  });

  const showNoStoreOption =
    hasNoStoreProductsQuery.isSuccess && hasNoStoreProductsQuery.data === true && !hasNoStoreProductsQuery.isFetching;

  useEffect(() => {
    if (storeId) return;
    if (showNoStoreOption) return;
    if ((serverFilters.storeIds || []).map(String).includes(NO_STORE_FILTER_ID)) {
      setServerFilters((prev) => ({
        ...prev,
        storeIds: (prev.storeIds || []).map(String).filter((id) => id !== NO_STORE_FILTER_ID),
      }));
    }
  }, [serverFilters.storeIds, setServerFilters, showNoStoreOption, storeId]);

  const lookupsQuery = useQuery({
    queryKey: ["user", userId, "lookups"],
    queryFn: async () => await ProductService.getUserLookups(),
    staleTime: 900_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
    enabled: filtersOpen,
  });

  const suppliers = useMemo(() => {
    const list = (lookupsQuery.data as any)?.suppliers;
    if (!Array.isArray(list)) return [];
    return (list || []).map((s: any) => ({ id: String(s?.id ?? ""), name: String(s?.supplier_name ?? "") }));
  }, [lookupsQuery.data]);

  const supplierCategoriesMap = useMemo(() => {
    const raw = (lookupsQuery.data as any)?.supplierCategoriesMap;
    if (!raw || typeof raw !== "object") return {} as Record<string, Array<{ id: string | number; name?: string | null; external_id?: string | null }>>;
    return raw as Record<string, Array<{ id: string | number; name?: string | null; external_id?: string | null }>>;
  }, [lookupsQuery.data]);

  const categories = useMemo(() => {
    const nameById = new Map<string, string>();
    for (const list of Object.values(supplierCategoriesMap)) {
      for (const c of Array.isArray(list) ? list : []) {
        const id = c?.id == null ? "" : String(c.id);
        if (!id || nameById.has(id)) continue;
        const name = c?.name != null ? String(c.name) : (c?.external_id != null ? String(c.external_id) : "");
        if (name) nameById.set(id, name);
      }
    }

    const ids = new Set<string>();
    for (const p of items || []) {
      const n = Number((p as any)?.category_id);
      if (!Number.isFinite(n)) continue;
      const id = String(n);
      ids.add(id);
      const name = (p as any)?.categoryName != null ? String((p as any).categoryName) : "";
      if (name && !nameById.has(id)) nameById.set(id, name);
    }

    for (const n of serverFilters.categoryIds || []) {
      const nn = Number(n);
      if (!Number.isFinite(nn)) continue;
      ids.add(String(nn));
    }

    const grouped = new Map<string, { name: string; ids: string[] }>();
    for (const id of Array.from(ids)) {
      const name = nameById.get(id) || id;
      const normalized = String(name).trim().toLowerCase();
      const key = normalized ? `name:${normalized}` : `id:${id}`;
      if (!grouped.has(key)) {
        grouped.set(key, { name, ids: [id] });
      } else {
        grouped.get(key)!.ids.push(id);
      }
    }

    const out = Array.from(grouped.values());
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [items, serverFilters.categoryIds, supplierCategoriesMap]);

  const stockBoundsQuery = useQuery({
    queryKey: ["user", userId, "products", "stockBounds", storeId ?? "all"],
    queryFn: async () => {
      const makeReq = (ascending: boolean) => {
        let req = supabase
          .from("products_with_details")
          .select("stock_quantity")
          .eq("owner_user_id", userId)
          .not("stock_quantity", "is", null)
          .order("stock_quantity", { ascending })
          .limit(1);
        if (storeId) req = req.eq("store_id", storeId);
        return req;
      };

      const [minResp, maxResp] = await Promise.all([makeReq(true), makeReq(false)]);
      if (minResp.error) throw minResp.error;
      if (maxResp.error) throw maxResp.error;

      const minRaw = Array.isArray(minResp.data) && minResp.data.length > 0 ? (minResp.data[0] as any)?.stock_quantity : null;
      const maxRaw = Array.isArray(maxResp.data) && maxResp.data.length > 0 ? (maxResp.data[0] as any)?.stock_quantity : null;
      const min = Number.isFinite(Number(minRaw)) ? Math.max(0, Math.round(Number(minRaw))) : 0;
      const max = Number.isFinite(Number(maxRaw)) ? Math.max(0, Math.round(Number(maxRaw))) : 0;
      return { min: Math.min(min, max), max: Math.max(min, max) };
    },
    enabled: filtersOpen,
    staleTime: 900_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
  });

  const stockBounds = useMemo(() => {
    const data = stockBoundsQuery.data as { min: number; max: number } | undefined;
    const min = Number.isFinite(Number(data?.min)) ? Math.max(0, Math.round(Number(data?.min))) : 0;
    const max = Number.isFinite(Number(data?.max)) ? Math.max(0, Math.round(Number(data?.max))) : 0;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }, [stockBoundsQuery.data]);

  const stockSliderValue = useMemo(() => {
    const minBound = stockBounds.min;
    const maxBound = stockBounds.max;
    const clamp = (n: number) => Math.min(maxBound, Math.max(minBound, n));
    const rawMin = serverFilters.stockMin == null ? minBound : Number(serverFilters.stockMin);
    const rawMax = serverFilters.stockMax == null ? maxBound : Number(serverFilters.stockMax);
    const a = Number.isFinite(rawMin) ? clamp(Math.round(rawMin)) : minBound;
    const b = Number.isFinite(rawMax) ? clamp(Math.round(rawMax)) : maxBound;
    return [Math.min(a, b), Math.max(a, b)];
  }, [serverFilters.stockMax, serverFilters.stockMin, stockBounds.max, stockBounds.min]);

  return (
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetContent side="left" className="flex flex-col w-full sm:max-w-[22rem]" onInteractOutside={() => {}}>
        <SheetHeader className="flex-row items-center justify-start gap-2 space-y-0 pr-10 text-left">
          <SheetTitle className="min-w-0">{t("filter")}</SheetTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-emerald-600"
                  onClick={() => setServerFilters(DEFAULT_PRODUCTS_SERVER_FILTERS)}
                  aria-label={t("clear")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("clear")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 pr-6">
              <div className="space-y-2">
                <Label>{t("price")}</Label>
                <ToggleGroup
                  type="single"
                  className="justify-start flex-wrap"
                  value={serverFilters.priceOrder ?? ""}
                  onValueChange={(v) =>
                    setServerFilters((prev) => ({ ...prev, priceOrder: v === "asc" || v === "desc" ? v : null }))
                  }
                >
                  <ToggleGroupItem
                    value="asc"
                    variant="outline"
                    size="sm"
                    className="group border-0 shadow-none bg-transparent hover:bg-transparent hover:text-emerald-700 data-[state=on]:bg-transparent data-[state=on]:text-emerald-700"
                  >
                    <ArrowUp className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-active:scale-110 group-data-[state=on]:text-emerald-700" />
                    <span className="transition-colors group-hover:text-emerald-700 group-data-[state=on]:text-emerald-700 group-data-[state=on]:font-semibold">
                      {t("sort_asc")}
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="desc"
                    variant="outline"
                    size="sm"
                    className="group border-0 shadow-none bg-transparent hover:bg-transparent hover:text-emerald-700 data-[state=on]:bg-transparent data-[state=on]:text-emerald-700"
                  >
                    <ArrowDown className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-active:scale-110 group-data-[state=on]:text-emerald-700" />
                    <span className="transition-colors group-hover:text-emerald-700 group-data-[state=on]:text-emerald-700 group-data-[state=on]:font-semibold">
                      {t("sort_desc")}
                    </span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label>{t("stock_quantity")}</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("min")}: {stockSliderValue[0]}</span>
                    <span>{t("max")}: {stockSliderValue[1]}</span>
                  </div>
                  <Slider
                    min={stockBounds.min}
                    max={stockBounds.max}
                    step={1}
                    value={stockSliderValue}
                    disabled={stockBoundsQuery.isPending || stockBounds.max <= stockBounds.min}
                    onValueChange={(vals) => {
                      const a = Array.isArray(vals) && vals.length > 0 ? Number(vals[0]) : stockBounds.min;
                      const b = Array.isArray(vals) && vals.length > 1 ? Number(vals[1]) : stockBounds.max;
                      const nextMin = Math.min(a, b);
                      const nextMax = Math.max(a, b);
                      setServerFilters((prev) => ({
                        ...prev,
                        stockMin: nextMin <= stockBounds.min ? null : Math.round(nextMin),
                        stockMax: nextMax >= stockBounds.max ? null : Math.round(nextMax),
                      }));
                    }}
                  />
                </div>
              </div>

              {storeId ? null : (
                <div className="space-y-2">
                  <Label>{t("stores")}</Label>
                  <div className="rounded-md p-2 max-h-48 overflow-auto">
                    <div className="flex flex-col gap-2">
                      {(stores || []).map((s) => {
                        const id = String(s.id);
                        const checked = (serverFilters.storeIds || []).map(String).includes(id);
                        return (
                          <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setServerFilters((prev) => {
                                  const prevIds = (prev.storeIds || []).map(String);
                                  const withoutNoStore = prevIds.filter((sid) => sid !== NO_STORE_FILTER_ID);
                                  return {
                                    ...prev,
                                    storeIds: toggleInArray(withoutNoStore, id, v === true),
                                  };
                                });
                              }}
                            />
                            <span className="min-w-0 truncate">{s.store_name || id}</span>
                          </label>
                        );
                      })}
                      {showNoStoreOption ? (
                        <label key={NO_STORE_FILTER_ID} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={(serverFilters.storeIds || []).map(String).includes(NO_STORE_FILTER_ID)}
                            onCheckedChange={(v) =>
                              setServerFilters((prev) => ({
                                ...prev,
                                storeIds: v === true ? [NO_STORE_FILTER_ID] : [],
                              }))
                            }
                          />
                          <span className="min-w-0 truncate">{t("without_store")}</span>
                        </label>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("supplier")}</Label>
                <div className="rounded-md p-2 max-h-56 overflow-auto">
                  <div className="flex flex-col gap-2">
                    {suppliers.map((s) => {
                      const idNum = Number(s.id);
                      const checked = Number.isFinite(idNum) && (serverFilters.supplierIds || []).includes(idNum);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (!Number.isFinite(idNum)) return;
                              setServerFilters((prev) => ({
                                ...prev,
                                supplierIds: toggleInArray(prev.supplierIds || [], idNum, v === true),
                              }));
                            }}
                          />
                          <span className="min-w-0 truncate">{s.name || s.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <div className="rounded-md p-2 max-h-56 overflow-auto">
                  <div className="flex flex-col gap-2">
                    {categories.map((c) => {
                      const ids = c.ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
                      const checked = ids.some((id) => (serverFilters.categoryIds || []).includes(id));
                      return (
                        <label key={`${c.name}:${c.ids.join(",")}`} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (ids.length === 0) return;
                              setServerFilters((prev) => ({
                                ...prev,
                                categoryIds: v === true
                                  ? Array.from(new Set([...(prev.categoryIds || []), ...ids]))
                                  : (prev.categoryIds || []).filter((id) => !ids.includes(id)),
                              }));
                            }}
                          />
                          <span className="min-w-0 truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
