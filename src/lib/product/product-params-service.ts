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

    const edit = await ProductAggregatorService.getProductEditData(productId);
    return edit.params || [];
  }
}
