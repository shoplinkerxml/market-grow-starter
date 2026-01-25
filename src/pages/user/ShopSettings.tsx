import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { ShopService } from "@/lib/shop-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DialogNoOverlay, DialogNoOverlayContent, DialogNoOverlayDescription, DialogNoOverlayHeader, DialogNoOverlayTitle } from "@/components/ui/dialog-no-overlay";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { Columns as ColumnsIcon, ChevronDown, Plus, Trash2, MoreHorizontal, Pencil, Tag, Hash, Link, CheckCircle, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShopSettingsAggregated } from "@/lib/shop-service";
import { useMarketplaces } from "@/hooks/useMarketplaces";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProgressiveLoader, FullPageLoader } from "@/components/LoadingSkeletons";
import { toast } from "sonner";
import { ShopCountsService } from "@/lib/shop-counts";
import { EdgeClient } from "@/lib/request-handler";
type StoreCategoryRow = {
  store_category_id: number;
  store_id: string;
  category_id: number;
  name: string;
  base_external_id: string | null;
  store_external_id: string | null;
  store_rz_id_value: string | null;
  is_active: boolean;
};
export default function ShopSettings() {
  const {
    t
  } = useI18n();
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [shopName, setShopName] = useState<string>("");
  const [storeCompany, setStoreCompany] = useState<string>("");
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'info' | 'currencies' | 'categories'>('categories');
  const [productsCount, setProductsCount] = useState(0);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const { templatesMap } = useMarketplaces(true);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [editRow, setEditRow] = useState<StoreCategoryRow | null>(null);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const cleanupDialogArtifacts = () => {
    try {
      document.querySelectorAll('[inert]').forEach(el => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
      document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        el.removeAttribute('aria-hidden');
      });
    } catch { void 0; }
  };
  const [editExternalId, setEditExternalId] = useState<string>("");
  const [editRzIdValue, setEditRzIdValue] = useState<string>("");
  const [editActive, setEditActive] = useState<boolean>(true);
  const { data: aggData, isLoading: aggLoading } = useQuery<ShopSettingsAggregated | null>({
    queryKey: ["user", uid, "shopSettingsAgg", id!],
    queryFn: async () => {
      if (!id) return null;
      const payload = await ShopService.getShopSettingsAggregated(id!);
      return payload;
    },
    enabled: !!id,
    staleTime: 900_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as ShopSettingsAggregated | null | undefined,
  });
  useEffect(() => {
    if (!id) {
      navigate('/user/shops');
      return;
    }
    if (aggData?.shop) {
      setShopName(aggData.shop.store_name);
      setStoreCompany(String(aggData.shop.store_company || ''));
      setStoreUrl(String(aggData.shop.store_url || ''));
      if (aggData.shop.marketplace) setSelectedMarketplace(String(aggData.shop.marketplace));
      setProductsCount(Number(aggData.productsCount || 0));
      setAvailableCurrencies(aggData.availableCurrencies || []);
      setStoreCurrencies(aggData.storeCurrencies || []);
    }
  }, [id, aggData, navigate]);
  const rows: StoreCategoryRow[] = useMemo(() => {
    const src = aggData?.categories ?? [];
    return src.map((r) => ({
      store_category_id: r.store_category_id,
      store_id: r.store_id,
      category_id: r.category_id,
      name: r.name,
      base_external_id: r.base_external_id,
      store_external_id: r.store_external_id,
      store_rz_id_value: r.store_rz_id_value,
      is_active: r.is_active,
    }));
  }, [aggData]);
  
  const filtered = useMemo(() => rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  const [showNameCol, setShowNameCol] = useState(true);
  const [showCodeCol, setShowCodeCol] = useState(true);
  const [showRozetkaCol, setShowRozetkaCol] = useState(true);
  const [showActiveCol, setShowActiveCol] = useState(true);
  const [showActionsCol, setShowActionsCol] = useState(true);
  const shopBreadcrumbs = [{
    label: t('breadcrumb_home'),
    href: '/user/dashboard'
  }, {
    label: t('shops_title'),
    href: '/user/shops'
  }, {
    label: shopName || '...',
    href: `/user/shops/${id}`
  }, {
    label: t('breadcrumb_settings'),
    current: true
  }];
  const updateCategoryField = async (rowId: number, patch: Partial<{
    rz_id_value: string | null;
    is_active: boolean;
  }>) => {
    try {
      await ShopService.updateStoreCategory({
        id: rowId,
        ...patch
      });
      queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
      toast.success(t('category_updated_success'));
    } catch (e) {
      console.error('Failed to update category field', e);
      toast.error(t('unknown_error'));
    }
  };
  const [availableCurrencies, setAvailableCurrencies] = useState<Array<{
    code: string;
    rate?: number;
  }>>([]);
  const [storeCurrencies, setStoreCurrencies] = useState<Array<{
    code: string;
    rate: number;
    is_base: boolean;
  }>>([]);
  const [savingShop, setSavingShop] = useState(false);
  const [addCurrencyCode, setAddCurrencyCode] = useState<string>('');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const handleAddCurrency = async () => {
    if (!addCurrencyCode) {
      toast.info(t('select_currency'));
      return;
    }
    setIsAddingCurrency(true);
    try {
      const sys = availableCurrencies.find(c => c.code === addCurrencyCode);
      const defaultRate = sys?.rate != null ? Number(sys.rate) : 1;
      await ShopService.addStoreCurrency(id!, addCurrencyCode, defaultRate);
      setAddCurrencyCode('');
      queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
    } finally {
      setIsAddingCurrency(false);
    }
  };
  const handleUpdateRate = async (code: string, rate: number) => {
    await ShopService.updateStoreCurrencyRate(id!, code, rate);
    queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
  };
  const handleSetBase = async (code: string) => {
    await ShopService.setBaseStoreCurrency(id!, code);
    queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
  };
  const handleDeleteCurrency = async (code: string) => {
    setDeletingCurrency(true);
    try {
      await ShopService.deleteStoreCurrency(id!, code);
      queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
    } finally {
      setDeletingCurrency(false);
    }
  };
  const [deletingCurrency, setDeletingCurrency] = useState(false);
  const [deletingCategories, setDeletingCategories] = useState(false);
  return <ProgressiveLoader
    isLoading={aggLoading || !aggData}
    delay={200}
    fallback={<FullPageLoader title="Завантаження налаштувань…" subtitle="Готуємо категорії, валюту та конфігурацію магазину" icon={SettingsIcon} />}
  >
    <div className="p-6 space-y-6" data-testid="shop_settings_page">
      <PageHeader title={shopName} description={t('breadcrumb_settings')} breadcrumbItems={shopBreadcrumbs} />

      <Card>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'info' | 'currencies' | 'categories')} className="w-full">
          <CardHeader className="pb-0">
            <TabsList className="flex w-full gap-2 h-9 overflow-x-auto whitespace-nowrap bg-transparent p-0 text-foreground rounded-none border-b border-border justify-start">
              <TabsTrigger value="info" className="px-3 text-sm rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary">{t('product_tab_main') || 'Основні дані'}</TabsTrigger>
              <TabsTrigger value="currencies" className="px-3 text-sm rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary">{t('shop_currencies')}</TabsTrigger>
              <TabsTrigger value="categories" className="px-3 text-sm rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary">{t('shop_categories')}</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="info" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">{t('shop_name')}</Label>
                <Input id="store_name" value={shopName} onChange={e => setShopName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_company">{t('company')}</Label>
                <Input id="store_company" value={storeCompany} onChange={e => setStoreCompany(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_url">{t('store_url')}</Label>
                <Input id="store_url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketplace">Формат магазина</Label>
                <Select value={selectedMarketplace} onValueChange={async marketplace => {
                setSelectedMarketplace(marketplace);
                if (productsCount > 0) return;
                try {
                  const key = marketplace.toLowerCase().trim();
                  let template = templatesMap?.[key];
                  if (!template) {
                    const payload = await EdgeClient.invoke<{ template?: any }>('store-templates-marketplaces', { marketplace });
                    template = payload?.template;
                  }
                  if (template) {
                    await ShopService.updateShop(id!, {
                      template_id: template.id,
                      xml_config: (template as any).xml_structure,
                      custom_mapping: (template as any).mapping_rules
                    });
                  }
                } catch (e) {
                  console.error('Error loading template:', e);
                  toast.error('Не вдалося отримати шаблон для формату');
                }
              }} disabled={productsCount > 0}>
                  <SelectTrigger id="marketplace">
                    <SelectValue placeholder="Оберіть формат магазину" />
                  </SelectTrigger>
                  <SelectContent>
                    {(aggData?.marketplaces ?? []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{productsCount > 0 ? 'Формат можна змінити тільки якщо не додано жодного товару' : 'Зміна формату скопіює новий шаблон'}</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => navigate(`/user/shops/${id}`)} disabled={savingShop}>{t('btn_cancel')}</Button>
                <Button onClick={async () => {
                setSavingShop(true);
                try {
                  await ShopService.updateShop(id!, {
                    store_name: shopName.trim(),
                    store_company: storeCompany,
                    store_url: storeUrl
                  });
                  setTimeout(() => navigate(`/user/shops/${id}/products`), 500);
                } catch (_) {
                  toast.error(t('unknown_error'));
                } finally {
                  setSavingShop(false);
                }
              }} aria-busy={savingShop} className="active:scale-[0.98]">{t('save_changes') || 'Зберегти зміни'}</Button>
              </div>
            </TabsContent>

            <TabsContent value="currencies" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{t('shop_currencies')}</div>
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const base = storeCurrencies.find(c => c.is_base)?.code || '—';
                      const total = storeCurrencies.length;
                      return `Базова валюта: ${base} • Доступно: ${total}`;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={addCurrencyCode} onValueChange={setAddCurrencyCode}>
                    <SelectTrigger className="h-9 w-[clamp(10rem,30vw,12rem)]" data-testid="shop_settings_addCurrency_select">
                      <SelectValue placeholder={t('select_currency')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCurrencies.filter(c => !storeCurrencies.some(sc => sc.code === c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleAddCurrency}
                    disabled={!addCurrencyCode || isAddingCurrency}
                    aria-busy={isAddingCurrency}
                    className="h-9 bg-transparent text-foreground cursor-pointer hover:bg-primary/10 active:bg-primary/15 hover:shadow-sm active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200"
                    aria-label={t('add_currency')}
                    data-testid="shop_settings_addCurrency_btn"
                  >
                    {isAddingCurrency ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} {t('add_currency')}
                  </Button>
                </div>
              </div>
              {storeCurrencies.length === 0 ? (
                <div className="rounded-lg border bg-card/50 p-6 text-center dark:bg-neutral-900/60 dark:border-emerald-500/40">
                  <div className="text-sm font-medium mb-1">{t('no_currencies_found')}</div>
                  <div className="text-xs text-muted-foreground">Додайте валюту та задайте курс відносно базової</div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="relative w-full overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted dark:bg-neutral-900/70">
                        <tr className="border-b">
                          <th className="h-10 px-3 text-left font-medium text-muted-foreground">Валюта</th>
                          <th className="h-10 px-3 text-left font-medium text-muted-foreground">Курс</th>
                          <th className="h-10 px-3 text-left font-medium text-muted-foreground">Основна</th>
                          <th className="h-10 px-3 text-right font-medium text-muted-foreground">Дії</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeCurrencies.map(cur => (
                          <tr key={cur.code} className="border-b hover:bg-muted/50 dark:hover:bg-emerald-900/30">
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="px-2 py-0.5 text-sm border-0">{cur.code}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  defaultValue={cur.rate}
                                  onBlur={e => handleUpdateRate(cur.code, parseFloat(e.target.value) || 0)}
                                  className="h-8 w-[clamp(6rem,12vw,8rem)] text-sm border-0 shadow-none focus-visible:ring-0"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Switch checked={cur.is_base} onCheckedChange={checked => checked ? handleSetBase(cur.code) : null} className="transition-all duration-200 data-[state=checked]:ring-2 data-[state=checked]:ring-emerald-400" />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCurrency(cur.code)} disabled={cur.is_base} className="h-8 w-8 transition-all duration-200 hover:bg-muted dark:hover:bg-emerald-900/30 active:scale-[0.98]" aria-disabled={cur.is_base}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
            
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="relative w-[clamp(12rem,40vw,22rem)]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPageIndex(0);
                    }}
                    className="pl-9 h-8 py-1"
                    data-testid="shop_settings_filter"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={selectedRowIds.length !== 1} onClick={() => {
                    const cat = rows.find(r => r.store_category_id === selectedRowIds[0]);
                    if (cat) {
                      setEditRow(cat);
                      setEditExternalId(String(cat.store_external_id ?? cat.base_external_id ?? ''));
                      setEditRzIdValue(String(cat.store_rz_id_value ?? ''));
                      setEditActive(!!cat.is_active);
                      setEditOpen(true);
                    }
                  }} data-testid="shop_settings_edit_btn">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={selectedRowIds.length === 0} onClick={async () => {
                    setDeletingCategories(true);
                    try {
                      for (const catId of selectedRowIds) {
                        const cat = rows.find(r => r.store_category_id === catId);
                        if (cat) {
                          await ShopService.deleteStoreCategoryWithProducts(id!, cat.category_id);
                        }
                      }
                      queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
                      setSelectedRowIds([]);
                    } finally {
                      setDeletingCategories(false);
                    }
                  }} data-testid="shop_settings_delete_btn">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('view_options')} data-testid="shop_settings_viewOptions">
                        <ColumnsIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white border border-emerald-300/40 dark:bg-neutral-900/80 dark:border-emerald-500/40">
                    <DropdownMenuCheckboxItem checked={showNameCol} onCheckedChange={v => setShowNameCol(!!v)}>{t('category_name')}</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showCodeCol} onCheckedChange={v => setShowCodeCol(!!v)}>{t('code')}</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showRozetkaCol} onCheckedChange={v => setShowRozetkaCol(!!v)}>{t('rozetka_category')}</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showActiveCol} onCheckedChange={v => setShowActiveCol(!!v)}>{t('active')}</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showActionsCol} onCheckedChange={v => setShowActionsCol(!!v)}>{t('actions')}</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&>tr]:border-b sticky top-0 z-10 bg-muted dark:bg-neutral-900/70">
                  <tr className="border-b transition-colors hover:bg-muted/50 dark:hover:bg-emerald-900/30">
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground"> 
                      <div className="flex items-center justify-center">
                        <Checkbox checked={selectedRowIds.length === pageRows.length && pageRows.length > 0 ? true : selectedRowIds.length > 0 ? "indeterminate" : false} onCheckedChange={value => {
                          if (value) setSelectedRowIds(pageRows.map(r => r.store_category_id));else setSelectedRowIds([]);
                        }} aria-label={t('select_all') || 'Вибрати все'} />
                      </div>
                    </th>
                    {showNameCol && <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">{t('category_name')}</th>}
                    {showCodeCol && <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">{t('code')}</th>}
                    {showRozetkaCol && <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">{t('rozetka_category')}</th>}
                    {showActiveCol && <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">{t('active')}</th>}
                    {showActionsCol && <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child]:border-0">
                  {pageRows.length === 0 ? <tr>
                      <td colSpan={6} className="p-3 text-center text-sm text-muted-foreground" data-testid="shop_settings_empty">{t('no_categories_found')}</td>
                    </tr> : pageRows.map(cat => <tr key={cat.store_category_id} className="border-b transition-colors hover:bg-muted/50 dark:hover:bg-emerald-900/30" data-testid={`shop_settings_row_${cat.store_category_id}`}>
                        <td className="p-2 align-middle">
                          <div className="flex items-center justify-center">
                            <Checkbox checked={selectedRowIds.includes(cat.store_category_id)} onCheckedChange={value => {
                              setSelectedRowIds(prev => value ? [...prev, cat.store_category_id] : prev.filter(id => id !== cat.store_category_id));
                            }} aria-label={t('select_row') || 'Вибрати рядок'} />
                          </div>
                        </td>
                        {showNameCol && <td className="p-2 align-middle"><span className="text-sm font-medium truncate block max-w-[30rem]">{cat.name}</span></td>}
                        {showCodeCol && <td className="p-2 align-middle"><Badge variant="outline" className="px-1.5 py-0 text-xs border-0">{(cat.store_external_id ?? cat.base_external_id) || '-'}</Badge></td>}
                        {showRozetkaCol && <td className="p-2 align-middle">
                          <Input
                            id={`rzv_${cat.store_category_id}`}
                            value={cat.store_rz_id_value || ''}
                            readOnly
                            aria-readonly="true"
                            className="h-8 w-[10rem] text-sm border-0 focus-visible:ring-0 focus-visible:outline-none shadow-none cursor-not-allowed bg-muted/40 dark:bg-neutral-900/60 dark:border dark:border-emerald-500/40"
                            data-testid={`shop_settings_rzid_${cat.store_category_id}`}
                          />
                        </td>}
                        {showActiveCol && <td className="p-2 align-middle">
                          <Switch checked={cat.is_active} onCheckedChange={checked => updateCategoryField(cat.store_category_id, {
                            is_active: checked
                          })} data-testid={`shop_settings_active_${cat.store_category_id}`} />
                        </td>}
                        {showActionsCol && <td className="p-2 align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`shop_settings_rowActions_${cat.store_category_id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-white border border-emerald-300/40 dark:bg-neutral-900/80 dark:border-emerald-500/40">
                              <DropdownMenuItem onClick={() => {
                                setEditRow(cat);
                                setEditExternalId(String(cat.store_external_id ?? cat.base_external_id ?? ''));
                                setEditRzIdValue(String(cat.store_rz_id_value ?? ''));
                                setEditActive(!!cat.is_active);
                                setEditOpen(true);
                              }}>
                                <Pencil className="mr-2 h-4 w-4" />{t('edit') || 'Редагувати'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                await ShopService.deleteStoreCategoryWithProducts(id!, cat.category_id);
                                queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
                                try {
                                  const sid = String(id!);
                                  ShopCountsService.invalidate(queryClient, uid, sid, "category_deleted");
                                } catch { void 0; }
                                setSelectedRowIds(prev => prev.filter(pid => pid !== cat.store_category_id));
                              }}>
                                <Trash2 className="mr-2 h-4 w-4" />{t('delete') || 'Видалити'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>}
                      </tr>)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit modal */}
          <Dialog open={editOpen} onOpenChange={open => {
                setEditOpen(open);
                if (!open) {
                  setEditRow(null);
                  cleanupDialogArtifacts();
                }
              }}>
            <DialogContent className="max-w-[clamp(22rem,60vw,32rem)]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  {t('edit') || 'Редагувати'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('edit') || 'Редагувати'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    <Label htmlFor="edit-category-name">{t('category_name')}</Label>
                  </div>
                  <div id="edit-category-name" className="text-sm font-medium text-foreground break-words">{editRow?.name || '-'}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <Label htmlFor="edit-category-code">{t('code')}</Label>
                  </div>
                  <div className="text-sm font-medium text-foreground break-all">{editExternalId || '-'}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Link className="h-4 w-4" />
                    <Label htmlFor="edit-rozetka-category">{t('rozetka_category')}</Label>
                  </div>
                  <Input id="edit-rozetka-category" value={editRzIdValue} onChange={e => setEditRzIdValue(e.target.value)} placeholder="ID Rozetka" inputMode="numeric" className="h-9 w-full text-sm font-medium border-0 bg-muted/30 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none shadow-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                      <CheckCircle className="h-4 w-4" />
                      <Label htmlFor="edit-active" className="truncate">{t('active')}</Label>
                    </div>
                    <Switch id="edit-active" checked={editActive} onCheckedChange={setEditActive} className="flex-shrink-0 data-[state=checked]:ring-2 data-[state=checked]:ring-emerald-400" />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 justify-center">
                <Button onClick={async () => {
                      if (editRow) {
                        try {
                          await ShopService.updateStoreCategory({
                            id: editRow.store_category_id,
                            rz_id_value: editRzIdValue || null,
                            is_active: editActive
                          });
                          queryClient.invalidateQueries({ queryKey: ["user", uid, "shopSettingsAgg", id] });
                          toast.success(t('category_updated_success'));
                          setEditOpen(false);
                          setEditRow(null);
                          cleanupDialogArtifacts();
                        } catch (e) {
                          console.error('Failed to update category in modal', e);
                          toast.error(t('unknown_error'));
                        }
                      }
                    }} className="active:scale-[0.98] px-6">{t('save_changes') || 'Зберегти зміни'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2" data-testid="shop_settings_footer">
            <div className="text-xs text-muted-foreground" data-testid="shop_settings_selectionStatus">
              {(() => {
                    const selected = selectedRowIds.length;
                    const total = filtered.length || 0;
                    return t('rows_selected') === 'Вибрано' ? `Вибрано ${selected} з ${total} рядків.` : `${selected} of ${total} row(s) selected.`;
                  })()}
            </div>
            <div className="flex items-center gap-2"></div>
            <div className="flex items-center gap-2">
              <div className="text-sm" data-testid="parametersDataTable_rowsPerPageLabel">{t('page_size')}</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8" data-testid="shop_settings_pageSize">
                    {pageSize}
                    <ChevronDown className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {[5, 10, 20, 50].map(size => <DropdownMenuCheckboxItem key={size} checked={pageSize === size} onCheckedChange={() => {
                        setPageSize(size);
                        setPageIndex(0);
                      }} data-testid={`shop_settings_pageSize_${size}`}>
                      {size}
                    </DropdownMenuCheckboxItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2" data-testid="shop_settings_pagination">
              <Button variant="outline" size="sm" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>&lt;</Button>
              <span className="text-sm">{pageIndex + 1} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPageIndex(p => Math.min(pageCount - 1, p + 1))} disabled={pageIndex >= pageCount - 1}>&gt;</Button>
            </div>
          </div>
            </CardContent>
            </TabsContent>
          </CardContent>
        </Tabs>
        <Dialog open={savingShop} onOpenChange={() => void 0}>
          <DialogContent className="max-w-[clamp(16rem,40vw,20rem)]">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                {t('save_changes') || 'Зберегти зміни'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Збереження налаштувань…
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="mt-2 text-sm text-muted-foreground">Збереження налаштувань…</div>
            </div>
          </DialogContent>
        </Dialog>
        <DialogNoOverlay open={deletingCurrency} onOpenChange={() => void 0} modal={false}>
          <DialogNoOverlayContent position="top-right" variant="info" className="p-4 w-[min(18rem,92vw)]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogNoOverlayHeader>
              <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
                <Loader2 className="h-[1rem] w-[1rem] animate-spin text-emerald-600" />
                {t('shop_deleting_currency')}
              </DialogNoOverlayTitle>
              <DialogNoOverlayDescription className="sr-only">
                {t('shop_deleting_currency')}
              </DialogNoOverlayDescription>
            </DialogNoOverlayHeader>
          </DialogNoOverlayContent>
        </DialogNoOverlay>
        <DialogNoOverlay open={deletingCategories} onOpenChange={() => void 0} modal={false}>
          <DialogNoOverlayContent position="top-right" variant="info" className="p-4 w-[min(18rem,92vw)]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogNoOverlayHeader>
              <DialogNoOverlayTitle className="text-sm flex items-center gap-2">
                <Loader2 className="h-[1rem] w-[1rem] animate-spin text-emerald-600" />
                {t('shop_deleting_categories')}
              </DialogNoOverlayTitle>
              <DialogNoOverlayDescription className="sr-only">
                {t('shop_deleting_categories')}
              </DialogNoOverlayDescription>
            </DialogNoOverlayHeader>
          </DialogNoOverlayContent>
        </DialogNoOverlay>
      </Card>
    </div>
  </ProgressiveLoader>;
}
