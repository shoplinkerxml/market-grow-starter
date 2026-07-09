import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_YML_MAPPING,
  type XmlMapping,
} from "./xml-mapping-defaults";

export interface SupplierXmlMappingRow {
  id: string;
  user_id: string;
  supplier_id: number;
  version: number;
  is_active: boolean;
  xpath_item: string;
  fields: XmlMapping["fields"];
  images: XmlMapping["images"];
  params: XmlMapping["params"];
  category: XmlMapping["category"];
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export const XmlMappingService = {
  async getActive(
    supplierId: number,
  ): Promise<SupplierXmlMappingRow | null> {
    const { data, error } = await supabase
      .from("supplier_xml_mappings")
      .select("*")
      .eq("supplier_id", supplierId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as SupplierXmlMappingRow) ?? null;
  },

  async saveMapping(
    supplierId: number,
    mapping: XmlMapping,
  ): Promise<SupplierXmlMappingRow> {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) throw new Error("Not authenticated");

    // Deactivate previous active mapping (keep as history via version).
    const { data: prev } = await supabase
      .from("supplier_xml_mappings")
      .select("id, version")
      .eq("supplier_id", supplierId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (prev?.version ?? 0) + 1;

    if (prev?.id) {
      await supabase
        .from("supplier_xml_mappings")
        .update({ is_active: false })
        .eq("supplier_id", supplierId)
        .eq("is_active", true);
    }

    const { data, error } = await supabase
      .from("supplier_xml_mappings")
      .insert({
        user_id: uid,
        supplier_id: supplierId,
        version: nextVersion,
        is_active: true,
        xpath_item: mapping.xpath_item || DEFAULT_YML_MAPPING.xpath_item,
        fields: mapping.fields ?? DEFAULT_YML_MAPPING.fields,
        images: mapping.images ?? DEFAULT_YML_MAPPING.images,
        params: mapping.params ?? DEFAULT_YML_MAPPING.params,
        category: mapping.category ?? {},
        currency: mapping.currency ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as SupplierXmlMappingRow;
  },

  toMapping(row: SupplierXmlMappingRow | null): XmlMapping {
    if (!row) return DEFAULT_YML_MAPPING;
    return {
      xpath_item: row.xpath_item || DEFAULT_YML_MAPPING.xpath_item,
      fields: (row.fields as XmlMapping["fields"]) || DEFAULT_YML_MAPPING.fields,
      images: (row.images as XmlMapping["images"]) || DEFAULT_YML_MAPPING.images,
      params: (row.params as XmlMapping["params"]) || DEFAULT_YML_MAPPING.params,
      category: (row.category as XmlMapping["category"]) || {},
      currency: row.currency ?? null,
    };
  },
};
