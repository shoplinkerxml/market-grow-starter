import { supabase } from "@/integrations/supabase/client";
import { SessionValidator } from "@/lib/session-validation";
import { ProductAggregatorService } from "./product-aggregator-service";
import { ProductParam } from "./types";

export class ProductParamsService {
  /** Параметры товара: через product-edit-data */
  static async getProductParams(productId: string): Promise<ProductParam[]> {
    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new Error("Invalid session: " + (sessionValidation.error || "Session expired"));
    }

    try {
      const { data, error } = await supabase
        .from("store_product_params")
        .select("id,name,value,order_index,paramid,valueid")
        .eq("product_id", String(productId))
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []).map((p) => ({
        id: String(p.id),
        product_id: String(productId),
        name: String(p.name || ""),
        value: String(p.value || ""),
        order_index: Number(p.order_index || 0),
        paramid: p.paramid == null ? undefined : String(p.paramid),
        valueid: p.valueid == null ? undefined : String(p.valueid),
      }));
    } catch {
      const edit = await ProductAggregatorService.getProductEditData(productId);
      return edit.params || [];
    }
  }
}
