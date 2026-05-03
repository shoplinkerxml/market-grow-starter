import React from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUtils";
import { Switch } from "@/components/ui/switch";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { format } from "date-fns";
import { StoresBadgeCell } from "./StoresBadgeCell";
import { ProductStatusBadge } from "./ProductStatusBadge";
import { Image as ImageIcon } from "lucide-react";
import { useResolvedImageSrc } from "@/hooks/useProductImages";
import { inactiveProductBadgeClassName, inactiveProductCheckboxClassName } from "./inactiveProductStyles";
const ProductActionsDropdownLazy = React.lazy(() =>
  import("./RowActionsDropdown").then((m) => ({ default: m.ProductActionsDropdown }))
);
import type { Product } from "@/lib/product-service";
import type { ShopAggregated } from "@/lib/shop-service";

export type ProductRow = Product & {
  linkedStoreIds?: string[];
  category_id?: number | null;
  category_external_id?: string | null;
  stock_quantity?: number | null;
  available?: boolean;
  supplierName?: string | null;
  categoryName?: string | null;
  mainImageUrl?: string | null;
  currency_code?: string | null;
};

const ProductThumbnail = React.memo(({
  product,
  onClick,
  disabled = false,
}: {
  product: ProductRow;
  onClick: () => void;
  disabled?: boolean;
}) => {
  const sizeCls = "h-[clamp(2.25rem,4vw,3rem)] w-[clamp(2.25rem,4vw,3rem)]";

  const baseUrl = product.mainImageUrl || "";
  const { src, onError } = useResolvedImageSrc({ url: baseUrl, width: IMAGE_SIZES.THUMB, fallbackUrl: baseUrl });
  const largeSrc = baseUrl ? getImageUrl(baseUrl, IMAGE_SIZES.LARGE) : "";

  const triggerButton = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className="inline-flex disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Avatar className={`${sizeCls} rounded-md ${disabled ? "cursor-not-allowed" : "cursor-pointer"} bg-white dark:bg-white`}>
        <AvatarImage
          src={src}
          alt={product.name_ua || product.name || ""}
          className="object-contain"
          onError={onError}
        />
        <AvatarFallback className="bg-primary/5 text-primary rounded-md flex items-center justify-center dark:bg-emerald-900/40 dark:text-emerald-100">
          <ImageIcon className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
    </button>
  );

  // Не показуємо великий прев'ю для неактивних товарів
  if (disabled) {
    return triggerButton;
  }

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{triggerButton}</HoverCardTrigger>
      <HoverCardContent className="w-[min(22rem,85vw)] p-2" sideOffset={8}>
        <div className="rounded-md overflow-hidden bg-white dark:bg-white dark:border dark:border-emerald-500/40">
          {largeSrc ? (
            <img
              src={largeSrc}
              alt={product.name_ua || product.name || ""}
              className="w-full max-h-[18rem] object-contain"
              loading="lazy"
            />
          ) : (
            <div className="h-[10rem] w-full flex items-center justify-center text-muted-foreground">
              —
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

ProductThumbnail.displayName = "ProductThumbnail";


const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

function getCurrencySymbol(code?: string | null): string {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code] || code;
}

function formatPrice(price: number | null | undefined, currencyCode?: string | null): string {
  if (price == null) return "—";
  const symbol = getCurrencySymbol(currencyCode);
  return `${price} ${symbol}`.trim();
}

function getProductName(product: ProductRow): string {
  return product.name_ua || product.name || "—";
}

const stringFilter: FilterFn<ProductRow> = (row, id, value) => {
  const rowValue = row.getValue(id);
  const str = rowValue == null ? "" : String(rowValue);
  
  if (value == null) return true;
  
  if (Array.isArray(value)) {
    return value.map(v => String(v)).includes(str);
  }
  
  return str.toLowerCase().includes(String(value).toLowerCase());
};

function renderHeader(label: string) {
  return <span className="truncate">{label}</span>;
}

export type ColumnConfig = {
  t: (k: string) => string;
  storeId?: string;
  categoryFilterOptions: string[];
  storeNames: Record<string, string>;
  stores: ShopAggregated[];
  loadStoresForMenu: () => Promise<void>;
  handleRemoveStoreLink: (productId: string, storeIdToRemove: string) => Promise<boolean> | boolean;
  handleStoresUpdate: (productId: string, ids: string[], opts?: { 
    storeIdChanged?: string | number; 
    categoryKey?: string | null; 
    added?: boolean 
  }) => void;
  onEdit?: (p: ProductRow) => void;
  setDeleteDialog: (v: { open: boolean; product: ProductRow | null }) => void;
  handleDuplicate: (p: Product) => Promise<void>;
  canCreate?: boolean;
  hideDuplicate?: boolean;
  handleToggleAvailable: (productId: string, checked: boolean) => void;
  duplicating?: boolean;
};

function createSelectColumn(config: ColumnConfig): ColumnDef<ProductRow> {
  return {
    id: "select",
    header: ({ table }) => {
      const allRows = table.getRowModel().rows;
      const selectableRows = allRows.filter((r) => r.getCanSelect());
      const allActiveSelected = selectableRows.length > 0 && selectableRows.every((r) => r.getIsSelected());
      const someSelected = selectableRows.some((r) => r.getIsSelected());
      return (
        <div className="flex items-center justify-start">
          <Checkbox
            checked={allActiveSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(value) => {
                const next: Record<string, boolean> = {};
                if (value === true) {
                  for (const r of selectableRows) next[r.id] = true;
                }
                table.setRowSelection(next);
            }}
            aria-label={config.t("select_all")}
          />
        </div>
      );
    },
    cell: ({ row }) => {
      const isInactive = row.original.is_active === false;
      return (
        <div className="flex items-center justify-start">
          <Checkbox
            checked={isInactive ? false : row.getIsSelected()}
            onCheckedChange={(value) => {
              if (isInactive) return;
              row.toggleSelected(value === true);
            }}
            disabled={isInactive}
            aria-label={config.t("select_row")}
            className={isInactive ? inactiveProductCheckboxClassName : ""}
          />
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 48,
  };
}

function createPhotoColumn(config: ColumnConfig): ColumnDef<ProductRow> {
  return {
    id: "photo",
    header: config.t("photo"),
    enableSorting: false,
    enableColumnFilter: false,
    size: 56,
    cell: ({ row }) => {
      const product = row.original;
      const isInactive = product.is_active === false;
      
      return (
        <div className="flex items-center justify-start" data-testid="user_products_photo">
          <ProductThumbnail
            product={product}
            disabled={isInactive}
            onClick={() => config.onEdit?.(product)}
          />
        </div>
      );
    },
  };
}

function createNameColumn(config: ColumnConfig): ColumnDef<ProductRow> {
  return {
    id: "name_ua",
    accessorFn: (row) => row.name_ua ?? row.name ?? "",
    filterFn: stringFilter,
    header: () => renderHeader(config.t("table_product")),
    cell: ({ row }) => {
      const name = getProductName(row.original);
      const product = row.original;
      const isInactive = product.is_active === false;
      return (
        <div className="min-w-0 max-w-[clamp(10rem,26vw,18rem)]" data-testid="user_products_name">
          <button
            type="button"
            disabled={isInactive}
            aria-disabled={isInactive}
            className={`text-left font-medium break-words line-clamp-2 w-full transition-colors disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:font-medium ${isInactive ? 'text-muted-foreground' : 'hover:text-emerald-600 hover:font-semibold'}`}
            title={name}
            onClick={() => config.onEdit?.(product)}
          >
            {name}
          </button>
          {isInactive && (
            <span className={`inline-flex mt-1 text-[10px] px-2 py-0.5 rounded-md border font-medium uppercase tracking-[0.08em] ${inactiveProductBadgeClassName}`}>
              {config.t('product_inactive_badge')}
            </span>
          )}
        </div>
      );
    },
  };
}

function createPriceColumn(
  id: 'price' | 'price_old' | 'price_promo',
  labelKey: string,
  config: ColumnConfig
): ColumnDef<ProductRow> {
  const testIdMap = {
    price: 'user_products_price',
    price_old: 'user_products_priceOld',
    price_promo: 'user_products_pricePromo',
  };

  return {
    id,
    accessorFn: (row) => {
      const value = row[id];
      return typeof value === "number" ? value : Number.NEGATIVE_INFINITY;
    },
    filterFn: stringFilter,
    header: () => renderHeader(config.t(labelKey)),
    cell: ({ row }) => {
      const value = row.original[id];
      const formatted = formatPrice(value, row.original.currency_code);
      const isEmpty = value == null;
      
      return (
        <span
          className={isEmpty ? "text-muted-foreground whitespace-nowrap" : "tabular-nums whitespace-nowrap"}
          data-testid={isEmpty ? `${testIdMap[id]}_empty` : testIdMap[id]}
        >
          {formatted}
        </span>
      );
    },
    enableHiding: true,
  };
}

function createStoresColumn(config: ColumnConfig): ColumnDef<ProductRow> {
  return {
    id: "stores",
    enableSorting: true,
    enableHiding: false,
    enableColumnFilter: true,
    sortingFn: (rowA, rowB) => {
      const a = (rowA.original.linkedStoreIds || []).length > 0 ? 1 : 0;
      const b = (rowB.original.linkedStoreIds || []).length > 0 ? 1 : 0;
      return a - b;
    },
    filterFn: ((row, id, value) => {
      const selected = Array.isArray(value) 
        ? value.map(v => String(v)) 
        : value == null ? [] : [String(value)];
      
      if (selected.length === 0) return true;
      
      const storeIds = (row.original.linkedStoreIds || []).map(String);
      const storeNamesForProduct = storeIds.map(sid => config.storeNames[sid] || sid);
      
      return selected.some(name => storeNamesForProduct.includes(name));
    }) as FilterFn<ProductRow>,
    header: () => <div className="flex justify-center w-full">{renderHeader(config.t("stores"))}</div>,
    size: 96,
    cell: ({ row }) => (
      <div className="flex justify-center w-full">
        <StoresBadgeCell
          product={row.original}
          storeNames={config.storeNames}
          storesList={config.stores}
          prefetchStores={config.loadStoresForMenu}
          onRemove={config.handleRemoveStoreLink}
          onStoresUpdate={config.handleStoresUpdate}
        />
      </div>
    ),
  };
}

function createActionsColumn(config: ColumnConfig): ColumnDef<ProductRow> {
  return {
    id: "actions",
    header: config.t("actions"),
    enableSorting: false,
    enableHiding: false,
    size: 96,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <React.Suspense fallback={null}>
          <ProductActionsDropdownLazy
            product={row.original}
            onEdit={() => config.onEdit?.(row.original)}
            onDelete={() => config.setDeleteDialog({ open: true, product: row.original })}
            onDuplicate={() => config.handleDuplicate(row.original)}
            onTrigger={() => void 0}
            canCreate={config.canCreate}
            hideDuplicate={config.hideDuplicate}
            storeId={config.storeId}
            onStoresUpdate={config.handleStoresUpdate}
            storesList={config.stores}
            storeNames={config.storeNames}
            prefetchStores={config.loadStoresForMenu}
            duplicating={config.duplicating}
          />
        </React.Suspense>
      </div>
    ),
  };
}

export function useProductColumns(config: ColumnConfig): ColumnDef<ProductRow>[] {
  const {
    t,
    storeId,
    categoryFilterOptions,
    storeNames,
    stores,
    loadStoresForMenu,
    handleRemoveStoreLink,
    handleStoresUpdate,
    onEdit,
    setDeleteDialog,
    handleDuplicate,
    canCreate,
    hideDuplicate,
    handleToggleAvailable,
    duplicating,
  } = config;

  return React.useMemo(
    () =>
      createColumns({
        t,
        storeId,
        categoryFilterOptions,
        storeNames,
        stores,
        loadStoresForMenu,
        handleRemoveStoreLink,
        handleStoresUpdate,
        onEdit,
        setDeleteDialog,
        handleDuplicate,
        canCreate,
        hideDuplicate,
        handleToggleAvailable,
        duplicating,
      }),
    [
      t,
      storeId,
      categoryFilterOptions,
      storeNames,
      stores,
      loadStoresForMenu,
      handleRemoveStoreLink,
      handleStoresUpdate,
      onEdit,
      setDeleteDialog,
      handleDuplicate,
      canCreate,
      hideDuplicate,
      handleToggleAvailable,
      duplicating,
    ],
  );
}

export function createColumns(config: ColumnConfig): ColumnDef<ProductRow>[] {
  const { t, storeId } = config;

  const columns: ColumnDef<ProductRow>[] = [
    createSelectColumn(config),
    createPhotoColumn(config),
    createNameColumn(config),
    {
      id: "status",
      accessorFn: (row) => row.state ?? "",
      filterFn: stringFilter,
      header: () => renderHeader(t("table_status")),
      cell: ({ row }) => <ProductStatusBadge state={row.original.state} inactive={row.original.is_active === false} />,
      enableHiding: true,
    },
    {
      id: "supplier",
      accessorFn: (row) => row.supplierName ?? "",
      filterFn: stringFilter,
      header: () => renderHeader(t("supplier")),
      cell: ({ row }) => {
        const name = row.original.supplierName;
        const isInactive = row.original.is_active === false;
        return name ? (
          <span className={isInactive ? "text-sm text-muted-foreground" : "text-sm"} data-testid="user_products_supplier">{name}</span>
        ) : (
          <span className="text-muted-foreground" data-testid="user_products_supplier_empty">—</span>
        );
      },
      enableHiding: true,
    },
    createPriceColumn('price', 'table_price', config),
    createPriceColumn('price_old', 'old_price', config),
    createPriceColumn('price_promo', 'promo_price', config),
    {
      id: "category",
      accessorFn: (row) => row.categoryName ?? "",
      filterFn: stringFilter,
      header: () => renderHeader(t("category")),
      cell: ({ row }) => {
        const name = row.original.categoryName;
        return name ? (
          <span className="text-sm">{name}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "stock_quantity",
      accessorFn: (row) => typeof row.stock_quantity === "number" ? row.stock_quantity : Number.NEGATIVE_INFINITY,
      filterFn: stringFilter,
      header: () => renderHeader(t("table_stock")),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          {row.original.stock_quantity != null ? (
            <span className="tabular-nums">{row.original.stock_quantity}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
      enableHiding: true,
    },
    {
      id: "created_at",
      accessorFn: (row) => {
        try {
          return row.created_at ? new Date(row.created_at).getTime() : 0;
        } catch {
          return 0;
        }
      },
      filterFn: stringFilter,
      header: () => renderHeader(t("table_created")),
      cell: ({ row }) => (
        row.original.created_at ? (
          <div className="flex flex-col">
            <span className="tabular-nums">
              {format(new Date(row.original.created_at), "yyyy-MM-dd")}
            </span>
            <span className="text-muted-foreground hidden sm:block tabular-nums">
              {format(new Date(row.original.created_at), "HH:mm")}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
      enableHiding: true,
    },
    {
      accessorKey: "article",
      filterFn: stringFilter,
      header: () => renderHeader(t("article")),
      cell: ({ row }) => (
        <span className={`product-text-strong text-sm ${row.original.is_active === false ? "text-muted-foreground" : "text-foreground"}`}>{row.original.article || ""}</span>
      ),
      enableHiding: true,
    },
    {
      accessorKey: "vendor",
      filterFn: stringFilter,
      header: () => renderHeader(t("vendor")),
      cell: ({ row }) => (
        <span className={`product-text-strong text-sm ${row.original.is_active === false ? "text-muted-foreground" : "text-foreground"}`}>{row.original.vendor || ""}</span>
      ),
      enableHiding: true,
    },
    {
      accessorKey: "docket_ua",
      filterFn: stringFilter,
      header: () => renderHeader(t("short_name_ua")),
      cell: ({ row }) => {
        const shortName = row.original.docket_ua || "";
        const isInactive = row.original.is_active === false;
        return (
          <div
            className={`product-text-strong text-sm max-w-[clamp(8rem,20vw,16rem)] truncate ${isInactive ? "text-muted-foreground" : "text-foreground"}`}
            title={shortName}
            data-testid="user_products_docketUa"
          >
            {shortName}
          </div>
        );
      },
      enableHiding: true,
    },
    {
      accessorKey: "description_ua",
      filterFn: stringFilter,
      header: () => renderHeader(t("product_description_ua")),
      cell: ({ row }) => {
        const desc = row.original.description_ua || "";
        const isInactive = row.original.is_active === false;
        return (
          <div
            className={`product-text-strong text-sm max-w-[clamp(10rem,22vw,18rem)] line-clamp-2 break-words ${isInactive ? "text-muted-foreground" : "text-foreground"}`}
            title={desc}
            data-testid="user_products_descriptionUa"
          >
            {desc}
          </div>
        );
      },
      enableHiding: true,
    },
  ];

  if (!storeId) {
    columns.push(createStoresColumn(config));
  }

  // Добавляем колонку активности только для списка магазина
  if (storeId) {
    columns.push({
      id: "active",
      header: t("table_active"),
      enableSorting: false,
      enableHiding: true,
      size: 64,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Switch
            checked={!!row.original.available}
            onCheckedChange={(checked) => config.handleToggleAvailable(row.original.id, checked)}
            aria-label={t("table_active")}
            data-testid={`user_store_products_active_${row.original.id}`}
          />
        </div>
      ),
    });
  }

  columns.push(createActionsColumn(config));

  return columns;
}
