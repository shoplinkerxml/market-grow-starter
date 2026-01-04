export interface PostgresInsertPayload {
  new: {
    store_id: string;
    is_active: boolean;
    [key: string]: unknown;
  };
}

export interface PostgresUpdatePayload {
  old: {
    store_id: string;
    is_active: boolean;
    [key: string]: unknown;
  };
  new: {
    store_id: string;
    is_active: boolean;
    [key: string]: unknown;
  };
}

export interface PostgresDeletePayload {
  old: {
    store_id: string;
    is_active: boolean;
    [key: string]: unknown;
  };
}

export type ShopCounts = {
  productsCount: number;
  categoriesCount: number;
};

