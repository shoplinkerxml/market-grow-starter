export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attribute_values: {
        Row: {
          attribute_id: number
          created_at: string | null
          display_order: number | null
          display_value: string | null
          id: number
          is_active: boolean | null
          metadata: Json | null
          value: string
          value_lang: Json | null
          valueid: string | null
        }
        Insert: {
          attribute_id: number
          created_at?: string | null
          display_order?: number | null
          display_value?: string | null
          id?: number
          is_active?: boolean | null
          metadata?: Json | null
          value: string
          value_lang?: Json | null
          valueid?: string | null
        }
        Update: {
          attribute_id?: number
          created_at?: string | null
          display_order?: number | null
          display_value?: string | null
          id?: number
          is_active?: boolean | null
          metadata?: Json | null
          value?: string
          value_lang?: Json | null
          valueid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_attribute_values_attribute"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "template_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attribute_values_attribute"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "v_product_params_enriched"
            referencedColumns: ["template_attribute_id"]
          },
          {
            foreignKeyName: "fk_attribute_values_attribute"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "v_template_attributes_full"
            referencedColumns: ["attribute_id"]
          },
        ]
      }
      category_templates: {
        Row: {
          category_id: number
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category_id: number
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category_id?: number
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_category_templates_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_category_templates_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      counters: {
        Row: {
          count: number
          counter_type: string
          entity_id: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          count?: number
          counter_type: string
          entity_id: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          counter_type?: string
          entity_id?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          id: number
          is_base: boolean | null
          name: string
          rate: number
          status: boolean | null
        }
        Insert: {
          code: string
          id?: number
          is_base?: boolean | null
          name: string
          rate: number
          status?: boolean | null
        }
        Update: {
          code?: string
          id?: number
          is_base?: boolean | null
          name?: string
          rate?: number
          status?: boolean | null
        }
        Relationships: []
      }
      limit_templates: {
        Row: {
          code: string
          description: string | null
          id: number
          name: string
          order_index: number | null
          path: string | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          name: string
          order_index?: number | null
          path?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          name?: string
          order_index?: number | null
          path?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          order_index: number
          parent_id: number | null
          path: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          order_index?: number
          parent_id?: number | null
          path: string
          title: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          order_index?: number
          parent_id?: number | null
          path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_menu_items_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_menu_items_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_menu_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_menu_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_jobs: {
        Row: {
          created_at: string
          created_count: number
          error: string | null
          id: string
          payload: Json | null
          processed_rows: number
          skipped_count: number
          status: string
          store_id: string | null
          total_rows: number
          updated_at: string
          updated_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          created_count?: number
          error?: string | null
          id?: string
          payload?: Json | null
          processed_rows?: number
          skipped_count?: number
          status?: string
          store_id?: string | null
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          created_count?: number
          error?: string | null
          id?: string
          payload?: Json | null
          processed_rows?: number
          skipped_count?: number
          status?: string
          store_id?: string | null
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      product_param_templates: {
        Row: {
          attribute_value_id: number | null
          created_at: string | null
          id: number
          product_param_id: number
          template_attribute_id: number
        }
        Insert: {
          attribute_value_id?: number | null
          created_at?: string | null
          id?: number
          product_param_id: number
          template_attribute_id: number
        }
        Update: {
          attribute_value_id?: number | null
          created_at?: string | null
          id?: number
          product_param_id?: number
          template_attribute_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_param_templates_attribute"
            columns: ["template_attribute_id"]
            isOneToOne: false
            referencedRelation: "template_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_attribute"
            columns: ["template_attribute_id"]
            isOneToOne: false
            referencedRelation: "v_product_params_enriched"
            referencedColumns: ["template_attribute_id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_attribute"
            columns: ["template_attribute_id"]
            isOneToOne: false
            referencedRelation: "v_template_attributes_full"
            referencedColumns: ["attribute_id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_param"
            columns: ["product_param_id"]
            isOneToOne: true
            referencedRelation: "store_product_params"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_param"
            columns: ["product_param_id"]
            isOneToOne: true
            referencedRelation: "v_product_params_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_value"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_value"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "v_product_params_enriched"
            referencedColumns: ["template_value_id"]
          },
          {
            foreignKeyName: "fk_product_param_templates_value"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "v_template_attributes_full"
            referencedColumns: ["value_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      store_categories: {
        Row: {
          created_at: string | null
          external_id: string
          id: number
          name: string
          parent_external_id: string | null
          rz_id: string | null
          store_id: string | null
          supplier_id: number
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: number
          name: string
          parent_external_id?: string | null
          rz_id?: string | null
          store_id?: string | null
          supplier_id: number
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: number
          name?: string
          parent_external_id?: string | null
          rz_id?: string | null
          store_id?: string | null
          supplier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_store_categories_parent_external"
            columns: ["supplier_id", "parent_external_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["supplier_id", "external_id"]
          },
          {
            foreignKeyName: "fk_store_categories_parent_external"
            columns: ["supplier_id", "parent_external_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["supplier_id", "external_id"]
          },
          {
            foreignKeyName: "store_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_currencies: {
        Row: {
          code: string
          created_at: string | null
          id: number
          is_base: boolean | null
          rate: number
          store_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: number
          is_base?: boolean | null
          rate?: number
          store_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: number
          is_base?: boolean | null
          rate?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_currencies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_export_links: {
        Row: {
          auto_generate: boolean
          auto_generate_interval_minutes: number
          created_at: string | null
          format: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          object_key: string | null
          store_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          auto_generate?: boolean
          auto_generate_interval_minutes?: number
          created_at?: string | null
          format: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          object_key?: string | null
          store_id: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          auto_generate?: boolean
          auto_generate_interval_minutes?: number
          created_at?: string | null
          format?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          object_key?: string | null
          store_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_export_links_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_images: {
        Row: {
          id: number
          is_main: boolean
          order_index: number
          product_id: string
          r2_key_card: string | null
          r2_key_original: string | null
          r2_key_thumb: string | null
          url: string | null
        }
        Insert: {
          id?: number
          is_main?: boolean
          order_index?: number
          product_id: string
          r2_key_card?: string | null
          r2_key_original?: string | null
          r2_key_thumb?: string | null
          url?: string | null
        }
        Update: {
          id?: number
          is_main?: boolean
          order_index?: number
          product_id?: string
          r2_key_card?: string | null
          r2_key_original?: string | null
          r2_key_thumb?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_links: {
        Row: {
          created_at: string | null
          custom_available: boolean | null
          custom_category_id: string | null
          custom_description: string | null
          custom_name: string | null
          custom_price: number | null
          custom_price_old: number | null
          custom_price_promo: number | null
          custom_stock_quantity: number | null
          id: number
          is_active: boolean
          product_id: string
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_available?: boolean | null
          custom_category_id?: string | null
          custom_description?: string | null
          custom_name?: string | null
          custom_price?: number | null
          custom_price_old?: number | null
          custom_price_promo?: number | null
          custom_stock_quantity?: number | null
          id?: number
          is_active?: boolean
          product_id: string
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_available?: boolean | null
          custom_category_id?: string | null
          custom_description?: string | null
          custom_name?: string | null
          custom_price?: number | null
          custom_price_old?: number | null
          custom_price_promo?: number | null
          custom_stock_quantity?: number | null
          id?: number
          is_active?: boolean
          product_id?: string
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_links_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_params: {
        Row: {
          id: number
          name: string
          order_index: number
          paramid: string | null
          product_id: string
          value: string
          value_lang: Json | null
          valueid: string | null
        }
        Insert: {
          id?: number
          name: string
          order_index?: number
          paramid?: string | null
          product_id: string
          value: string
          value_lang?: Json | null
          valueid?: string | null
        }
        Update: {
          id?: number
          name?: string
          order_index?: number
          paramid?: string | null
          product_id?: string
          value?: string
          value_lang?: Json | null
          valueid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_params_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_params_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          article: string | null
          available: boolean
          category_external_id: string
          category_id: number | null
          created_at: string | null
          currency_code: string
          description: string | null
          description_ua: string | null
          docket: string | null
          docket_ua: string | null
          external_id: string
          id: string
          is_active: boolean
          name: string
          name_ua: string | null
          price: number
          price_old: number | null
          price_promo: number | null
          state: string | null
          stock_quantity: number
          store_id: string | null
          supplier_id: number
          updated_at: string | null
          vendor: string
        }
        Insert: {
          article?: string | null
          available?: boolean
          category_external_id: string
          category_id?: number | null
          created_at?: string | null
          currency_code: string
          description?: string | null
          description_ua?: string | null
          docket?: string | null
          docket_ua?: string | null
          external_id: string
          id?: string
          is_active?: boolean
          name: string
          name_ua?: string | null
          price: number
          price_old?: number | null
          price_promo?: number | null
          state?: string | null
          stock_quantity?: number
          store_id?: string | null
          supplier_id: number
          updated_at?: string | null
          vendor: string
        }
        Update: {
          article?: string | null
          available?: boolean
          category_external_id?: string
          category_id?: number | null
          created_at?: string | null
          currency_code?: string
          description?: string | null
          description_ua?: string | null
          docket?: string | null
          docket_ua?: string | null
          external_id?: string
          id?: string
          is_active?: boolean
          name?: string
          name_ua?: string | null
          price?: number
          price_old?: number | null
          price_promo?: number | null
          state?: string | null
          stock_quantity?: number
          store_id?: string | null
          supplier_id?: number
          updated_at?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_store_products_currency_code"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_store_categories: {
        Row: {
          category_id: number
          created_at: string | null
          custom_name: string | null
          external_id: string | null
          id: number
          is_active: boolean
          rz_id_value: string | null
          store_id: string
        }
        Insert: {
          category_id: number
          created_at?: string | null
          custom_name?: string | null
          external_id?: string | null
          id?: number
          is_active?: boolean
          rz_id_value?: string | null
          store_id: string
        }
        Update: {
          category_id?: number
          created_at?: string | null
          custom_name?: string | null
          external_id?: string | null
          id?: number
          is_active?: boolean
          rz_id_value?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_store_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_store_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_store_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          mapping_rules: Json
          marketplace: string | null
          name: string
          updated_at: string | null
          xml_structure: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mapping_rules: Json
          marketplace?: string | null
          name: string
          updated_at?: string | null
          xml_structure: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mapping_rules?: Json
          marketplace?: string | null
          name?: string
          updated_at?: string | null
          xml_structure?: Json
        }
        Relationships: []
      }
      supplier_import_items: {
        Row: {
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          payload: Json | null
          run_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload?: Json | null
          run_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload?: Json | null
          run_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "supplier_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_runs: {
        Row: {
          created_at: string
          created_count: number
          error: string | null
          failed_count: number
          finished_at: string | null
          id: string
          inngest_run_id: string | null
          processed_rows: number
          skipped_count: number
          started_at: string | null
          status: string
          supplier_id: number
          total_rows: number
          trigger: string
          updated_at: string
          updated_count: number
          user_id: string
          xml_etag: string | null
          xml_last_modified: string | null
          xml_size_bytes: number | null
          xml_url: string | null
        }
        Insert: {
          created_at?: string
          created_count?: number
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inngest_run_id?: string | null
          processed_rows?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          supplier_id: number
          total_rows?: number
          trigger?: string
          updated_at?: string
          updated_count?: number
          user_id: string
          xml_etag?: string | null
          xml_last_modified?: string | null
          xml_size_bytes?: number | null
          xml_url?: string | null
        }
        Update: {
          created_at?: string
          created_count?: number
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inngest_run_id?: string | null
          processed_rows?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          supplier_id?: number
          total_rows?: number
          trigger?: string
          updated_at?: string
          updated_count?: number
          user_id?: string
          xml_etag?: string | null
          xml_last_modified?: string | null
          xml_size_bytes?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_runs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_xml_mappings: {
        Row: {
          category: Json
          created_at: string
          currency: string | null
          fields: Json
          id: string
          images: Json
          is_active: boolean
          params: Json
          supplier_id: number
          updated_at: string
          user_id: string
          version: number
          xpath_item: string
        }
        Insert: {
          category?: Json
          created_at?: string
          currency?: string | null
          fields?: Json
          id?: string
          images?: Json
          is_active?: boolean
          params?: Json
          supplier_id: number
          updated_at?: string
          user_id: string
          version?: number
          xpath_item?: string
        }
        Update: {
          category?: Json
          created_at?: string
          currency?: string | null
          fields?: Json
          id?: string
          images?: Json
          is_active?: boolean
          params?: Json
          supplier_id?: number
          updated_at?: string
          user_id?: string
          version?: number
          xpath_item?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_xml_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_features: {
        Row: {
          feature_name: string
          id: number
          is_active: boolean | null
          tariff_id: number
        }
        Insert: {
          feature_name: string
          id?: number
          is_active?: boolean | null
          tariff_id: number
        }
        Update: {
          feature_name?: string
          id?: number
          is_active?: boolean | null
          tariff_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_tariff_features_tariff"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_features_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_limits: {
        Row: {
          code: string | null
          description: string | null
          id: number
          is_active: boolean | null
          limit_name: string
          path: string | null
          tariff_id: number
          template_id: number | null
          value: number
        }
        Insert: {
          code?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          limit_name: string
          path?: string | null
          tariff_id: number
          template_id?: number | null
          value: number
        }
        Update: {
          code?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          limit_name?: string
          path?: string | null
          tariff_id?: number
          template_id?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_tariff_limits_tariff"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_limits_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_limits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "limit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          created_at: string | null
          currency_code: string
          currency_id: number | null
          description: string | null
          duration_days: number | null
          id: number
          is_active: boolean | null
          is_free: boolean | null
          is_lifetime: boolean | null
          name: string
          new_price: number | null
          old_price: number | null
          popular: boolean
          sort_order: number
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string | null
          currency_code: string
          currency_id?: number | null
          description?: string | null
          duration_days?: number | null
          id?: number
          is_active?: boolean | null
          is_free?: boolean | null
          is_lifetime?: boolean | null
          name: string
          new_price?: number | null
          old_price?: number | null
          popular?: boolean
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string | null
          currency_code?: string
          currency_id?: number | null
          description?: string | null
          duration_days?: number | null
          id?: number
          is_active?: boolean | null
          is_free?: boolean | null
          is_lifetime?: boolean | null
          name?: string
          new_price?: number | null
          old_price?: number | null
          popular?: boolean
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_tariffs_currency"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      template_attributes: {
        Row: {
          attribute_type: string
          created_at: string | null
          default_value: string | null
          display_order: number | null
          help_text: string | null
          id: number
          is_active: boolean | null
          is_filterable: boolean | null
          is_required: boolean | null
          name: string
          paramid: string | null
          template_id: number
          unit: string | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          attribute_type?: string
          created_at?: string | null
          default_value?: string | null
          display_order?: number | null
          help_text?: string | null
          id?: number
          is_active?: boolean | null
          is_filterable?: boolean | null
          is_required?: boolean | null
          name: string
          paramid?: string | null
          template_id: number
          unit?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          attribute_type?: string
          created_at?: string | null
          default_value?: string | null
          display_order?: number | null
          help_text?: string | null
          id?: number
          is_active?: boolean | null
          is_filterable?: boolean | null
          is_required?: boolean | null
          name?: string
          paramid?: string | null
          template_id?: number
          unit?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_template_attributes_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "category_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_menu_items: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          order_index: number
          parent_id: number | null
          path: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          order_index?: number
          parent_id?: number | null
          path: string
          title: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          order_index?: number
          parent_id?: number | null
          path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_menu_items_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stores: {
        Row: {
          created_at: string | null
          custom_mapping: Json | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          store_company: string | null
          store_name: string
          store_url: string | null
          template_id: string | null
          updated_at: string | null
          user_id: string
          xml_config: Json | null
        }
        Insert: {
          created_at?: string | null
          custom_mapping?: Json | null
          id: string
          is_active?: boolean | null
          last_sync?: string | null
          store_company?: string | null
          store_name: string
          store_url?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id: string
          xml_config?: Json | null
        }
        Update: {
          created_at?: string | null
          custom_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          store_company?: string | null
          store_name?: string
          store_url?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
          xml_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "store_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          end_date: string | null
          id: number
          is_active: boolean
          start_date: string
          tariff_id: number
          user_id: string
        }
        Insert: {
          end_date?: string | null
          id?: number
          is_active?: boolean
          start_date?: string
          tariff_id: number
          user_id: string
        }
        Update: {
          end_date?: string | null
          id?: number
          is_active?: boolean
          start_date?: string
          tariff_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          id: number
          import_enabled: boolean
          import_frequency_hours: number
          is_active: boolean | null
          last_import_at: string | null
          last_import_run_id: string | null
          phone: string | null
          supplier_name: string
          updated_at: string | null
          user_id: string
          website_url: string | null
          xml_etag: string | null
          xml_feed_url: string | null
          xml_last_modified: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: number
          import_enabled?: boolean
          import_frequency_hours?: number
          is_active?: boolean | null
          last_import_at?: string | null
          last_import_run_id?: string | null
          phone?: string | null
          supplier_name: string
          updated_at?: string | null
          user_id: string
          website_url?: string | null
          xml_etag?: string | null
          xml_feed_url?: string | null
          xml_last_modified?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: number
          import_enabled?: boolean
          import_frequency_hours?: number
          is_active?: boolean | null
          last_import_at?: string | null
          last_import_run_id?: string | null
          phone?: string | null
          supplier_name?: string
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
          xml_etag?: string | null
          xml_feed_url?: string | null
          xml_last_modified?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_with_details: {
        Row: {
          article: string | null
          available: boolean | null
          category_external_id: string | null
          category_id: number | null
          category_name: string | null
          created_at: string | null
          currency_code: string | null
          description: string | null
          description_ua: string | null
          docket: string | null
          docket_ua: string | null
          external_id: string | null
          id: string | null
          is_active: boolean | null
          main_image_key: string | null
          main_image_url: string | null
          name: string | null
          name_ua: string | null
          owner_user_id: string | null
          price: number | null
          price_old: number | null
          price_promo: number | null
          state: string | null
          stock_quantity: number | null
          store_id: string | null
          supplier_id: number | null
          supplier_name: string | null
          updated_at: string | null
          vendor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_store_products_currency_code"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "user_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stores_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_menu_view: {
        Row: {
          created_at: string | null
          id: number | null
          is_active: boolean | null
          order_index: number | null
          parent_id: number | null
          path: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          order_index?: number | null
          parent_id?: number | null
          path?: string | null
          title?: string | null
          user_id?: never
        }
        Update: {
          created_at?: string | null
          id?: number | null
          is_active?: boolean | null
          order_index?: number | null
          parent_id?: number | null
          path?: string | null
          title?: string | null
          user_id?: never
        }
        Relationships: [
          {
            foreignKeyName: "fk_menu_items_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_menu_items_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_menu_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_menu_view"
            referencedColumns: ["id"]
          },
        ]
      }
      v_categories_with_counts: {
        Row: {
          created_at: string | null
          external_id: string | null
          id: number | null
          name: string | null
          parent_external_id: string | null
          subcategories_count: number | null
          supplier_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_store_categories_parent_external"
            columns: ["supplier_id", "parent_external_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["supplier_id", "external_id"]
          },
          {
            foreignKeyName: "fk_store_categories_parent_external"
            columns: ["supplier_id", "parent_external_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["supplier_id", "external_id"]
          },
          {
            foreignKeyName: "store_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "user_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_product_params_enriched: {
        Row: {
          attribute_type: string | null
          id: number | null
          is_filterable: boolean | null
          is_required: boolean | null
          name: string | null
          order_index: number | null
          paramid: string | null
          product_id: string | null
          template_attribute_id: number | null
          template_display_value: string | null
          template_value_id: number | null
          unit: string | null
          value: string | null
          value_lang: Json | null
          valueid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_params_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_params_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      v_template_attributes_full: {
        Row: {
          attribute_id: number | null
          attribute_name: string | null
          attribute_type: string | null
          category_id: number | null
          display_order: number | null
          display_value: string | null
          is_filterable: boolean | null
          is_required: boolean | null
          paramid: string | null
          template_id: number | null
          unit: string | null
          value: string | null
          value_display_order: number | null
          value_id: number | null
          value_lang: Json | null
          valueid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_category_templates_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_category_templates_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_template_attributes_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "category_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_tariff: {
        Args: { p_tariff_id: number; p_user_id: string }
        Returns: {
          end_date: string | null
          id: number
          is_active: boolean
          start_date: string
          tariff_id: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_template_to_products: {
        Args: { p_category_id: number; p_template_id: number }
        Returns: number
      }
      bulk_delete_store_links: {
        Args: {
          p_include_categories?: boolean
          p_product_ids?: string[]
          p_store_ids: string[]
        }
        Returns: Json
      }
      bulk_insert_product_links: { Args: { input_links: Json }; Returns: Json }
      bulk_upsert_categories: {
        Args: { p_categories: Json }
        Returns: {
          action: string
          external_id: string
          name: string
          parent_external_id: string
        }[]
      }
      cleanup_counters_if_empty: {
        Args: { _user_id: string }
        Returns: undefined
      }
      count_attributes_by_templates: {
        Args: { p_template_ids: number[] }
        Returns: {
          active_count: number
          inactive_count: number
          template_id: number
          total_count: number
        }[]
      }
      dedupe_store_categories: {
        Args: { p_items: Json; p_store_id: string }
        Returns: Json
      }
      delete_category_cascade: {
        Args: { p_external_id: string; p_supplier_id: number }
        Returns: {
          deleted_count: number
        }[]
      }
      duplicate_template_with_attributes: {
        Args: { p_new_name?: string; p_template_id: number }
        Returns: Json
      }
      duplicate_template_with_attrs: {
        Args: { p_new_name: string; p_template_id: number }
        Returns: number
      }
      get_category_path: {
        Args: { p_external_id: string; p_supplier_id: number }
        Returns: {
          external_id: string
          level: number
          name: string
        }[]
      }
      get_category_tree: {
        Args: { p_root_external_id?: string; p_supplier_id: number }
        Returns: {
          external_id: string
          id: number
          level: number
          name: string
          parent_external_id: string
          path: string[]
        }[]
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_structured_menu: { Args: { user_uuid: string }; Returns: Json }
      get_user_product_limit: { Args: { p_user_id: string }; Returns: number }
      infer_counters_user_id: {
        Args: { p_counter_type: string; p_entity_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner_supplier: { Args: { p_supplier_id: number }; Returns: boolean }
      load_demo_data: { Args: { p_user_id: string }; Returns: Json }
      recompute_category_counters_for_store: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      supplier_import_replace_images: {
        Args: { p_pictures: Json; p_product_id: string }
        Returns: undefined
      }
      supplier_import_replace_params: {
        Args: { p_params: Json; p_product_id: string }
        Returns: undefined
      }
      supplier_import_upsert_batch: {
        Args: {
          p_rows: Json
          p_run_id: string
          p_supplier_id: number
          p_user_id: string
        }
        Returns: Json
      }
      update_counter: {
        Args: { p_counter_type: string; p_delta: number; p_entity_id: string }
        Returns: undefined
      }
      upsert_counter_value: {
        Args: { p_count: number; p_counter_type: string; p_entity_id: string }
        Returns: undefined
      }
      user_stats: {
        Args: never
        Returns: {
          active: number
          total: number
        }[]
      }
    }
    Enums: {
      user_role: "admin" | "manager" | "user"
      user_status: "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "manager", "user"],
      user_status: ["active", "inactive"],
    },
  },
} as const
