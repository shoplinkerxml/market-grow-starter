import React, { useMemo } from "react";
import type { Row as TanRow } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUtils";
import { useResolvedImageSrc } from "@/hooks/useProductImages";
import { useProductsTableContext } from "./context";
import { Image as ImageIcon } from "lucide-react";
import type { ProductRow } from "./columns";
import type { ShopAggregated } from "@/lib/shop-service";

const ProductActionsDropdownLazy = React.lazy(() =>
  import("./RowActionsDropdown").then((m) => ({ default: m.ProductActionsDropdown })),
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: "₴",
  USD: "$",
  EUR: "€",
};

function formatPrice(price: number | null | undefined, currencyCode?: string | null): string {
  if (price == null) return "—";
  const code = currencyCode ? String(currencyCode) : "";
  const symbol = code ? (CURRENCY_SYMBOLS[code] || code) : "";
  return `${price} ${symbol}`.trim();
}

function getProductName(product: ProductRow): string {
  return product.name_ua || product.name || "—";
}

function getStoresForCard(product: ProductRow, storeNames: Record<string, string>) {
  const ids = (product.linkedStoreIds || []).map(String);
  const labels = ids.map((id) => storeNames[id] || id).filter(Boolean);
  return { ids, labels };
}

function normalizePrice(price: number | null | undefined): number | null {
  if (price == null) return null;
  if (!Number.isFinite(price)) return null;
  if (price <= 0) return null;
  return price;
}

function ProductCard({
  row,
  t,
  storeId,
  onEdit,
  canCreate,
  hideDuplicate,
  stores,
  loadStoresForMenu,
  setDeleteDialog,
  handleDuplicate,
  onStoresUpdate,
  storeNames,
  duplicating,
  loading,
}: {
  row: TanRow<ProductRow>;
  t: (k: string) => string;
  storeId?: string;
  onEdit?: (p: ProductRow) => void;
  canCreate?: boolean;
  hideDuplicate?: boolean;
  stores: ShopAggregated[];
  loadStoresForMenu: () => Promise<void>;
  setDeleteDialog: (v: { open: boolean; product: ProductRow | null }) => void;
  handleDuplicate: (p: ProductRow) => Promise<void>;
  onStoresUpdate: (productId: string, ids: string[]) => void;
  storeNames: Record<string, string>;
  duplicating: boolean;
  loading: boolean;
}) {
  const product = row.original as ProductRow;
  const name = getProductName(product);
  const baseUrl = product.mainImageUrl || "";
  const imgUrl = baseUrl ? getImageUrl(baseUrl, IMAGE_SIZES.CARD) : "";
  const { src, onError } = useResolvedImageSrc({ url: imgUrl, width: IMAGE_SIZES.CARD, fallbackUrl: imgUrl });
  const { labels: storeLabels } = getStoresForCard(product, storeNames);
  const promoPrice = normalizePrice(product.price_promo);
  const regularPrice = normalizePrice(product.price);
  const oldPrice = normalizePrice(product.price_old);
  const displayPrice = promoPrice ?? regularPrice;
  const showOldPrice = promoPrice != null && oldPrice != null && promoPrice < oldPrice;

  return (
    <Card
      className={`@container/card overflow-hidden border shadow-sm transition-shadow hover:shadow-md ${row.getIsSelected() ? "border-emerald-400" : "border-border"}`}
      data-testid={`user_products_card_${product.id}`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-2">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v === true)}
          aria-label={t("select_row")}
          disabled={loading || duplicating}
          aria-disabled={loading || duplicating}
        />

        <React.Suspense fallback={null}>
          <ProductActionsDropdownLazy
            product={product}
            onEdit={() => onEdit?.(product)}
            onDelete={() => setDeleteDialog({ open: true, product })}
            onDuplicate={() => handleDuplicate(product)}
            onTrigger={() => void 0}
            canCreate={canCreate}
            hideDuplicate={hideDuplicate}
            storeId={storeId}
            onStoresUpdate={onStoresUpdate}
            storesList={stores}
            storeNames={storeNames}
            prefetchStores={loadStoresForMenu}
            duplicating={duplicating}
          />
        </React.Suspense>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          className="relative mt-2 block w-full aspect-[4/3] bg-muted/40 rounded-md overflow-hidden dark:bg-neutral-900/60 dark:border dark:border-emerald-500/40"
          onClick={() => onEdit?.(product)}
        >
          {src ? (
            <img
              src={src}
              alt={name}
              className="h-full w-full object-contain bg-white dark:bg-white"
              loading="lazy"
              onError={onError}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground bg-white dark:bg-white">
              <ImageIcon className="h-10 w-10 opacity-60" />
            </div>
          )}
        </button>
      </div>

      <CardContent className="p-4">
        <div className="text-[11px] text-muted-foreground truncate">{product.article || "—"}</div>
        <button
          type="button"
          className="mt-1 text-left font-semibold leading-snug break-words line-clamp-2 w-full transition-colors hover:text-emerald-600"
          title={name}
          onClick={() => onEdit?.(product)}
        >
          {name}
        </button>

        <div className="mt-2 flex flex-wrap gap-1">
          {(storeLabels.length > 0 ? storeLabels.slice(0, 4) : ["—"]).map((label, idx) => (
            <Badge
              key={`${product.id}:store:${idx}`}
              variant="secondary"
              className="rounded-md px-2 py-0.5 text-[11px] h-5 max-w-[10rem] truncate dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
              title={label}
            >
              {label}
            </Badge>
          ))}
          {storeLabels.length > 4 ? (
            <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[11px] h-5 dark:border-emerald-500/60 dark:text-emerald-200">
              +{storeLabels.length - 4}
            </Badge>
          ) : null}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground truncate">{product.supplierName || "—"}</div>
            <div className="flex items-baseline gap-2">
              <div className="font-semibold text-[18px] leading-none tabular-nums">
                {formatPrice(displayPrice, product.currency_code)}
              </div>
              {showOldPrice ? (
                <div className="text-[12px] text-muted-foreground line-through tabular-nums">
                  {formatPrice(oldPrice, product.currency_code)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">{t("table_stock")}</div>
            <div className="font-medium tabular-nums">{product.stock_quantity != null ? product.stock_quantity : "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductsCardsView() {
  const {
    t,
    table,
    storeId,
    onEdit,
    canCreate,
    hideDuplicate,
    stores,
    loadStoresForMenu,
    setDeleteDialog,
    handleDuplicate,
    setProductsCached,
    duplicating,
    loading,
  } = useProductsTableContext();

  const storeNames = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        (stores || [])
          .map((s: ShopAggregated) => [String(s.id), String(s.store_name || s.store_url || "")])
          .filter(([, name]) => !!name),
      ),
    [stores],
  );

  const onStoresUpdate = React.useCallback(
    (productId: string, ids: string[]) => {
      setProductsCached((prev) => prev.map((p) => (String(p.id) === String(productId) ? { ...p, linkedStoreIds: ids } : p)));
    },
    [setProductsCached],
  );

  const rows = table.getRowModel().rows;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" data-testid="user_products_cards">
      {rows.map((row) => (
        <ProductCard
          key={String((row.original as ProductRow).id)}
          row={row as TanRow<ProductRow>}
          t={t}
          storeId={storeId}
          onEdit={onEdit}
          canCreate={canCreate}
          hideDuplicate={hideDuplicate}
          stores={stores}
          loadStoresForMenu={loadStoresForMenu}
          setDeleteDialog={setDeleteDialog}
          handleDuplicate={handleDuplicate as any}
          onStoresUpdate={onStoresUpdate}
          storeNames={storeNames}
          duplicating={!!duplicating}
          loading={!!loading}
        />
      ))}
    </div>
  );
}
