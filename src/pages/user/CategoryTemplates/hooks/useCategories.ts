import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CategoryRow } from "../types";

export function useCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await (supabase as any).from("store_categories").select("id,name,external_id").order("name");
    if (error) throw new Error(error.message);
    setCategories((data || []) as CategoryRow[]);
  }, []);

  return { categories, setCategories, loadCategories };
}
