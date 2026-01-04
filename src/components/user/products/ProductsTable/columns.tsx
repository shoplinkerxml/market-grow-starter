import React from "react";
import type { ColumnDef, FilterFn, Column } from "@tanstack/react-table";
import type { Table as TanTable } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUtils";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { SortToggle } from "./SortToggle";
import { ColumnFilterMenu } from "./ColumnFilterMenu";
import { StoresBadgeCell } from "./StoresBadgeCell";
import { ProductStatusBadge } from "./ProductStatusBadge";
import { Image as ImageIcon } from "lucide-react";
import { useResolvedImageSrc } from "@/hooks/useProductImages";
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
  hasStores,
  onClick,
}: {
  product: ProductRow;
  hasStores: boolean;
  onClick: () => void;
}) => {
  const sizeCls = hasStores
    ? "h-[clamp(2.25rem,4vw,3rem)] w-[clamp(2.25rem,4vw,3rem)]"
    : "h-[clamp(1.75rem,3vw,2.5rem)] w-[clamp(1.75rem,3vw,2.5rem)]";

  const baseUrl = product.mainImageUrl || "";
  const { src, onError } = useResolvedImageSrc({ url: baseUrl, width: IMAGE_SIZES.THUMB, fallbackUrl: baseUrl });

  return (
    <button type="button" onClick={onClick} className="inline-flex">
      <Avatar className={`${sizeCls} rounded-md cursor-pointer bg-white`}>
        <AvatarImage
          src={src}
          alt={product.name_ua || product.name || ""}
          className="object-contain"
          onError={onError}
        />
        <AvatarFallback className="bg-primary/5 text-primary rounded-md flex items-center justify-center">
          <ImageIcon className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
    </button>
  );
});

ProductThumbnail.displayName = "ProductThumbnail";


const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: 'грн',
  USD: '$',
  EUR: '€',
};

function getCurrencySymbol(code?: string | null): string {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code] || code;
}

function formatPrice(price: number | null | undefined, currencyCode?: string | null): string {
  if (price == null) return '—';
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

function renderHeader(
  label: string,
  column: Column<ProductRow, unknown>,
  table: TanTable<ProductRow>,
  extra?: React.ReactNode
) {
  return (
    <div className="flex items-center gap-2">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-0 ml-auto">
        <SortToggle column={column} table={table} />
        {extra ?? <ColumnFilterMenu column={column} />}
      </div>
    </div>
  );
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
    header: ({ table }) => (
      <div className="flex items-center justify-start">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
          aria-label={config.t("select_all")}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-start">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          aria-label={config.t("select_row")}
        />
      </div>
    ),
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
      const hasStores = Array.isArray(product.linkedStoreIds) && product.linkedStoreIds.length > 0;
      
      return (
        <div className="flex items-center justify-start" data-testid="user_products_photo">
          <ProductThumbnail
            product={product}
            hasStores={hasStores}
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
    header: ({ column, table }) => renderHeader(config.t("table_product"), column, table),
    cell: ({ row }) => {
      const name = getProductName(row.original);
      return (
        <div className="min-w-0 max-w-full" data-testid="user_products_name">
          <div className="font-medium break-words line-clamp-2 w-full" title={name}>
            {name}
          </div>
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
    header: ({ column, table }) => renderHeader(config.t(labelKey), column, table),
    cell: ({ row }) => {
      const value = row.original[id];
      const formatted = formatPrice(value, row.original.currency_code);
      const isEmpty = value == null;
      
      return (
        <span 
          className={isEmpty ? "text-muted-foreground" : "tabular-nums"}
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
    header: ({ column, table }) => renderHeader(
      config.t("stores"), 
      column, 
      table, 
      <ColumnFilterMenu column={column} extraOptions={Object.values(config.storeNames)} />
    ),
    size: 96,
    cell: ({ row }) => (
      <StoresBadgeCell
        product={row.original}
        storeNames={config.storeNames}
        storesList={config.stores}
        prefetchStores={config.loadStoresForMenu}
        onRemove={config.handleRemoveStoreLink}
        onStoresUpdate={config.handleStoresUpdate}
      />
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
  const { t, storeId, categoryFilterOptions } = config;

  const columns: ColumnDef<ProductRow>[] = [
    createSelectColumn(config),
    createPhotoColumn(config),
    createNameColumn(config),
    {
      id: "status",
      accessorFn: (row) => row.state ?? "",
      filterFn: stringFilter,
      header: ({ column, table }) => renderHeader(t("table_status"), column, table),
      cell: ({ row }) => <ProductStatusBadge state={row.original.state} />,
      enableHiding: true,
    },
    {
      id: "supplier",
      accessorFn: (row) => row.supplierName ?? "",
      filterFn: stringFilter,
      header: ({ column, table }) => renderHeader(t("supplier"), column, table),
      cell: ({ row }) => {
        const name = row.original.supplierName;
        return name ? (
          <span className="text-sm" data-testid="user_products_supplier">{name}</span>
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
      header: ({ column, table }) => renderHeader(
        t("category"), 
        column, 
        table, 
        <ColumnFilterMenu column={column} extraOptions={storeId ? categoryFilterOptions : []} />
      ),
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
      header: ({ column, table }) => renderHeader(t("table_stock"), column, table),
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
      header: ({ column, table }) => renderHeader(t("table_created"), column, table),
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
      header: ({ column, table }) => renderHeader(t("article"), column, table),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.article || ""}</span>
      ),
      enableHiding: true,
    },
    {
      accessorKey: "vendor",
      filterFn: stringFilter,
      header: ({ column, table }) => renderHeader(t("vendor"), column, table),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.vendor || ""}</span>
      ),
      enableHiding: true,
    },
    {
      accessorKey: "docket_ua",
      filterFn: stringFilter,
      header: ({ column, table }) => renderHeader(t("short_name_ua"), column, table),
      cell: ({ row }) => {
        const shortName = row.original.docket_ua || "";
        return (
          <div
            className="text-sm text-foreground max-w-[clamp(8rem,20vw,16rem)] truncate"
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
      header: ({ column, table }) => renderHeader(t("product_description_ua"), column, table),
      cell: ({ row }) => {
        const desc = row.original.description_ua || "";
        return (
          <div
            className="text-sm text-foreground max-w-[clamp(10rem,22vw,18rem)] line-clamp-2 break-words"
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

  // Добавляем колонку магазинов только для общего списка
  if (!storeId) {
    columns.push(createStoresColumn(config));
  }

  // Добавляем колонку активности только для списка магазина
  if (storeId) {
    columns.push({
      id: "active",
      header: t("table_active"),
      enableSorting: false,
      enableHiding: false,
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
