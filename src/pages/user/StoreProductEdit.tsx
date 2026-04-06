import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { ProductService, type Product, type ProductParam } from "@/lib/product-service";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ProductFormTabs } from "@/components/ProductFormTabs";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, ArrowLeft, Package, Save } from "lucide-react";
import { ShopService } from "@/lib/shop-service";
import { ProgressiveLoader, FullPageLoader } from "@/components/LoadingSkeletons";
import { ShopCountsService } from "@/lib/shop-counts";
import { useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

type StoreProductLinkForm = {
  is_active: boolean;
  custom_price: string;
  custom_price_old: string;
  custom_price_promo: string;
  custom_stock_quantity: string;
  custom_available: boolean;
};

type StoreProductLinkPatch = {
  is_active: boolean;
  custom_price: number | null;
  custom_price_old: number | null;
  custom_price_promo: number | null;
  custom_stock_quantity: number | null;
  custom_available: boolean | null;
  custom_category_id: string | null;
};

type FormImage = {
  id?: string;
  url: string;
  order_index: number;
  is_main: boolean;
  alt_text?: string;
};

type StoreCategory = {
  store_category_id: number;
  category_id: number;
  name: string;
  store_external_id: string | null;
  is_active: boolean;
};

type ProductEditData = {
  product: Product | null;
  images: FormImage[];
  params: ProductParam[];
  shopName: string;
  categoryName: string;
  storeCategories: StoreCategory[];
  suppliers?: Array<{ id: string; supplier_name: string }>;
  currencies?: Array<{ id: number; name: string; code: string; status: boolean | null }>;
  categories?: Array<{ id: string; name: string; external_id: string; supplier_id: string; parent_external_id: string | null }>;
  supplierCategoriesMap?: Record<string, Array<{ id: string; name: string; external_id: string; supplier_id: string; parent_external_id: string | null }>>;
};

// Extended type for form changes that includes category_name
type ProductFormChange = Partial<Product> & {
  category_name?: string;
};

// ============================================================================
// Utility Functions
// ============================================================================

const parseNumericValue = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

const sanitizeParams = (params: ProductParam[]): ProductParam[] => {
  return params.map((p, idx) => ({
    name: p.name,
    value: p.value,
    order_index: typeof p.order_index === "number" ? p.order_index : idx,
    paramid: p.paramid?.trim() || null,
    valueid: p.valueid?.trim() || null,
  })) as ProductParam[];
};

const normalizeImages = (images: any[]): FormImage[] => {
  return images.map((img, index) => ({
    id: img.id ? String(img.id) : undefined,
    url: String(img.images?.original || img.url || ''),
    order_index: typeof img.order_index === 'number' ? img.order_index : index,
    is_main: !!img.is_main,
    alt_text: img.alt_text ?? undefined,
  }));
};

const getInitialFormState = (link: any, product: Product | null): StoreProductLinkForm => {
  if (!link) {
    return {
      is_active: true,
      custom_price: "",
      custom_price_old: "",
      custom_price_promo: "",
      custom_stock_quantity: "",
      custom_available: true,
    };
  }

  return {
    is_active: !!link.is_active,
    custom_price: link.custom_price == null ? "" : String(link.custom_price),
    custom_price_old: link.custom_price_old == null ? "" : String(link.custom_price_old),
    custom_price_promo: link.custom_price_promo == null ? "" : String(link.custom_price_promo),
    custom_stock_quantity: link.custom_stock_quantity == null ? "" : String(link.custom_stock_quantity),
    custom_available: link.custom_available == null ? (product ? !!product.available : true) : !!link.custom_available,
  };
};

// ============================================================================
// Main Component
// ============================================================================

export const StoreProductEdit = () => {
  const { id, productId } = useParams();
  const storeId = String(id || "");
  const pid = String(productId || "");
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";

  // Consolidated state
  const [form, setForm] = useState<StoreProductLinkForm>({
    is_active: true,
    custom_price: "",
    custom_price_old: "",
    custom_price_promo: "",
    custom_stock_quantity: "",
    custom_available: true,
  });

  const [productData, setProductData] = useState<ProductEditData>({
    product: null,
    images: [],
    params: [],
    shopName: "",
    categoryName: "",
    storeCategories: [],
  });

  const [uiState, setUiState] = useState({
    loading: true,
    saving: false,
    imagesLoading: false,
  });

  const [lastCategoryId, setLastCategoryId] = useState<string | null>(null);

  const patchStoreProductsCached = useCallback((productId: string, patch: Record<string, unknown>) => {
    const targetId = String(productId);
    queryClient.setQueriesData({ queryKey: ["user", uid, "products", storeId], exact: false }, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return (old as any[]).map((p) => (String((p as any)?.id) === targetId ? { ...(p as any), ...patch } : p));
      }
      if (typeof old === "object" && Array.isArray((old as any).pages)) {
        const prev = old as any;
        return {
          ...prev,
          pages: prev.pages.map((page: any) => {
            const products = Array.isArray(page?.products) ? (page.products as any[]) : null;
            if (!products) return page;
            return {
              ...page,
              products: products.map((p) => (String((p as any)?.id) === targetId ? { ...(p as any), ...patch } : p)),
            };
          }),
        };
      }
      return old;
    });
  }, [queryClient, storeId, uid]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadProductData = useCallback(async () => {
    setUiState(prev => ({ ...prev, loading: true }));
    
    try {
      const agg = await ProductService.getProductEditData(pid, storeId);
      if (agg.product?.is_active === false) {
        toast.error(t('inactive_product_cannot_be_edited'));
        navigate(`/user/shops/${storeId}/products`);
        return;
      }
      const sid = agg.product?.supplier_id != null ? String(agg.product.supplier_id) : "";
      
      setProductData({
        product: agg.product,
        images: normalizeImages(agg.images || []),
        params: agg.params || [],
        shopName: agg.shop?.store_name || "",
        categoryName: agg.categoryName || "",
        storeCategories: (agg.storeCategories || []).map(r => ({
          store_category_id: r.store_category_id,
          category_id: r.category_id,
          name: r.name,
          store_external_id: r.store_external_id,
          is_active: r.is_active,
        })),
        suppliers: agg.suppliers,
        currencies: agg.currencies,
        categories: sid ? (agg.supplierCategoriesMap?.[sid] || []) : [],
        supplierCategoriesMap: agg.supplierCategoriesMap,
      });

      setForm(getInitialFormState(agg.link, agg.product));
    } catch (error) {
      console.error("Failed to load product data:", error);
      toast.error(t('failed_load_products'));
    } finally {
      setUiState(prev => ({ ...prev, loading: false }));
    }
  }, [navigate, pid, storeId, t]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const updateField = useCallback(<K extends keyof StoreProductLinkForm>(
    key: K,
    value: StoreProductLinkForm[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleFormChange = useCallback((partial: ProductFormChange) => {
    if (typeof partial.price === "number") {
      updateField("custom_price", String(partial.price));
    }
    if (typeof partial.price_old === "number") {
      updateField("custom_price_old", String(partial.price_old));
    }
    if (typeof partial.price_promo === "number") {
      updateField("custom_price_promo", String(partial.price_promo));
    }
    if (typeof partial.stock_quantity === "number") {
      updateField("custom_stock_quantity", String(partial.stock_quantity));
    }
    if (typeof partial.available === "boolean") {
      updateField("custom_available", partial.available);
    }
    
    // Handle category_id as either string or number
    const categoryIdStr = typeof partial.category_id === "string" 
      ? partial.category_id 
      : typeof partial.category_id === "number" 
        ? String(partial.category_id) 
        : null;
    
    if (categoryIdStr && categoryIdStr.trim()) {
      const cid = categoryIdStr.trim();
      if (cid !== lastCategoryId) {
        setLastCategoryId(cid);
        if (partial.category_name) {
          setProductData(prev => ({ ...prev, categoryName: partial.category_name! }));
        }
      }
    }
  }, [updateField, lastCategoryId]);

  // ============================================================================
  // Save Logic
  // ============================================================================

  const buildPatchData = useCallback((): StoreProductLinkPatch => {
    return {
      is_active: !!form.is_active,
      custom_price: parseNumericValue(form.custom_price),
      custom_price_old: parseNumericValue(form.custom_price_old),
      custom_price_promo: parseNumericValue(form.custom_price_promo),
      custom_stock_quantity: parseNumericValue(form.custom_stock_quantity),
      custom_available: form.custom_available,
      custom_category_id: null,
    };
  }, [form]);

  const handleSave = useCallback(async () => {
    setUiState(prev => ({ ...prev, saving: true }));

    try {
      const productPayload: { params?: ProductParam[]; category_id?: number } = {};
      productPayload.params = sanitizeParams(productData.params || []);

      const patch = buildPatchData();

      // Handle category
      let freshName: string | undefined = undefined;
      if (lastCategoryId) {
        const categoryId = Number(lastCategoryId);
        if (Number.isFinite(categoryId)) {
          const categoryRow = productData.categories?.find(c => String(c.id) === String(categoryId));
          if (!categoryRow) {
            toast.error("Обрана категорія більше не існує");
            return;
          }

          productPayload.category_id = categoryId;
          
          const storeCategory = productData.storeCategories.find(
            r => r.category_id === categoryId
          );
          patch.custom_category_id = storeCategory?.store_external_id ?? null;
          
          freshName = storeCategory?.name || categoryRow.name || '';
        }
      }

      // Save to backend
      await ProductService.saveStoreProductEdit(pid, storeId, {
        ...productPayload,
        linkPatch: patch,
      });

      patchStoreProductsCached(pid, {
        price: patch.custom_price,
        price_old: patch.custom_price_old,
        price_promo: patch.custom_price_promo,
        stock_quantity: patch.custom_stock_quantity ?? undefined,
        available: patch.custom_available,
        ...(productPayload.category_id != null
          ? {
              category_id: productPayload.category_id,
              category_external_id: patch.custom_category_id,
              categoryName: freshName,
            }
          : {}),
      });

      toast.success(t("product_updated"));
      navigate(`/user/shops/${storeId}`);
    } catch (error) {
      console.error("Failed to save product:", error);
      toast.error(t("failed_save_product"));
    } finally {
      setUiState(prev => ({ ...prev, saving: false }));
    }
  }, [
    productData.params,
    productData.storeCategories,
    productData.categories,
    buildPatchData,
    lastCategoryId,
    pid,
    storeId,
    t,
    navigate,
    patchStoreProductsCached,
  ]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const formOverrides = useMemo(() => ({
    price: form.custom_price ? parseFloat(form.custom_price) || 0 : productData.product?.price || 0,
    price_old: form.custom_price_old ? parseFloat(form.custom_price_old) || 0 : productData.product?.price_old || 0,
    price_promo: form.custom_price_promo ? parseFloat(form.custom_price_promo) || 0 : productData.product?.price_promo || 0,
    stock_quantity: form.custom_stock_quantity ? parseInt(form.custom_stock_quantity) || 0 : productData.product?.stock_quantity || 0,
  }), [form, productData.product]);

  const supplierCategoriesMapNormalized = useMemo(() => {
    if (!productData.supplierCategoriesMap) return {};

    return Object.fromEntries(
      Object.entries(productData.supplierCategoriesMap).map(([key, arr]) => [
        key,
        (arr || []).map(c => ({
          id: String(c.id),
          name: String(c.name || ''),
          external_id: String(c.external_id || ''),
          supplier_id: String(c.supplier_id || ''),
          parent_external_id: c.parent_external_id == null ? null : String(c.parent_external_id),
        }))
      ])
    );
  }, [productData.supplierCategoriesMap]);

  const storeCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sc of productData.storeCategories || []) {
      ids.add(String(sc.category_id));
    }
    return ids;
  }, [productData.storeCategories]);

  const categoriesForStore = useMemo(() => {
    const base = productData.categories || [];
    if (storeCategoryIds.size === 0) return base;
    return base.filter(c => storeCategoryIds.has(String(c.id)));
  }, [productData.categories, storeCategoryIds]);

  const supplierCategoriesMapForStore = useMemo(() => {
    if (storeCategoryIds.size === 0) return supplierCategoriesMapNormalized;
    return Object.fromEntries(
      Object.entries(supplierCategoriesMapNormalized).map(([sid, list]) => [
        sid,
        (list || []).filter(c => storeCategoryIds.has(String(c.id))),
      ])
    );
  }, [supplierCategoriesMapNormalized, storeCategoryIds]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="px-2 sm:px-6 py-3 sm:py-6 space-y-6">
      <PageHeader
        title={t("edit_product")}
        titleIcon={<Package className="h-5 w-5" />}
        description={t("edit_product_description")}
        breadcrumbItems={[
          { label: t("breadcrumb_home"), href: "/user/dashboard" },
          { label: t("shops_title"), href: "/user/shops" },
          { label: productData.shopName || (uiState.loading ? "..." : storeId), href: `/user/shops/${storeId}` },
          { label: productData.categoryName || "—", current: true },
        ]}
        mobileActionsInline
        actions={
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              onClick={() => navigate(`/user/shops/${storeId}`)}
              className="shrink-0 group inline-flex items-center p-0 hover:bg-transparent focus-visible:bg-transparent active:bg-transparent"
              data-testid="store_product_edit_back"
              title={t("back_to_shops")}
            >
              <span className="inline-flex items-center justify-center rounded-full bg-transparent border border-border text-foreground w-7 h-7 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600 group-active:scale-95 group-active:shadow-inner">
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Button>
          </div>
        }
      />

      <ProgressiveLoader
        isLoading={uiState.loading}
        delay={150}
        fallback={
          <FullPageLoader
            title="Завантаження товару…"
            subtitle="Готуємо форму редагування, дані та зображення"
            icon={Loader2}
          />
        }
      >
        <div className="relative min-h-[clamp(12rem,50vh,24rem)]" aria-busy={uiState.loading}>
          {productData.product && (
            <ProductFormTabs
              product={productData.product}
              readOnly
              editableKeys={["price", "price_old", "price_promo", "stock_quantity", "available"]}
              overrides={formOverrides}
              cardHeaderClassName="hidden sm:flex"
              preloadedImages={productData.images}
              preloadedParams={productData.params}
              preloadedSuppliers={productData.suppliers}
              preloadedCurrencies={productData.currencies}
              preloadedCategories={categoriesForStore}
              preloadedSupplierCategoriesMap={supplierCategoriesMapForStore}
              onChange={handleFormChange as any}
              forceParamsEditable
              onParamsChange={(p) => setProductData(prev => ({ ...prev, params: p }))}
              onImagesLoadingChange={(loading) => setUiState(prev => ({ ...prev, imagesLoading: loading }))}
            />
          )}
        </div>
      </ProgressiveLoader>

      <div className="mt-4 sm:mt-6 pt-1 px-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Button
            onClick={handleSave}
            disabled={uiState.saving}
            aria-disabled={uiState.saving}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {uiState.saving ? t("saving") : t("save_changes")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoreProductEdit;
