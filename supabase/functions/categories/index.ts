import { createClient } from "npm:@supabase/supabase-js"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Content-Type": "application/json",
}

type CreateCategoryInput = {
  supplier_id: number | string
  external_id: string
  name: string
  parent_external_id?: string | null
}

// Валидация входных данных
function validateCreateInput(data: any): { valid: boolean; error?: string } {
  if (!data?.external_id || typeof data.external_id !== 'string') {
    return { valid: false, error: "external_id обязателен" }
  }
  if (!data?.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { valid: false, error: "name обязателен и не может быть пустым" }
  }
  if (!data?.supplier_id || isNaN(Number(data.supplier_id))) {
    return { valid: false, error: "supplier_id обязателен и должен быть числом" }
  }
  return { valid: true }
}

// Нормализация данных
function normalizeInput(payload: CreateCategoryInput) {
  return {
    supplier_id: Number(payload.supplier_id),
    external_id: String(payload.external_id).trim(),
    name: String(payload.name).trim(),
    parent_external_id: payload.parent_external_id?.trim() || null,
  }
}

// Улучшенная обработка ошибок
function handleError(error: any, defaultMessage: string) {
  const errorCode = error?.code
  const errorMessage = error?.message || defaultMessage
  
  // Специфичные ошибки PostgreSQL
  if (errorCode === '23505') {
    return { error: "duplicate_entry", message: "Категория с таким external_id уже существует" }
  }
  if (errorCode === '23503') {
    return { error: "foreign_key_violation", message: "Неверная ссылка на родительскую категорию" }
  }
  
  return { error: "db_error", message: errorMessage }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "", 
      apiKey, 
      { 
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
        db: { schema: 'public' }
      }
    )

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "list")

    // ============ GET BY ID ============
    if (action === "get_by_id") {
      const id = Number(body?.id ?? NaN)
      if (isNaN(id)) {
        return new Response(
          JSON.stringify({ error: "invalid_id" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const { data, error } = await supabase
        .from("store_categories")
        .select("id,external_id,name,parent_external_id,supplier_id")
        .eq("id", id)
        .maybeSingle()
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка получения категории")), 
          { status: 500, headers: corsHeaders }
        )
      }
      return new Response(JSON.stringify({ item: data || null }), { headers: corsHeaders })
    }

    // ============ GET NAME BY ID ============
    if (action === "get_name_by_id") {
      const id = Number(body?.id ?? NaN)
      if (isNaN(id)) {
        return new Response(JSON.stringify({ name: null }), { headers: corsHeaders })
      }
      
      const { data, error } = await supabase
        .from("store_categories")
        .select("name")
        .eq("id", id)
        .maybeSingle()
        
      if (error) return new Response(JSON.stringify({ name: null }), { headers: corsHeaders })
      return new Response(JSON.stringify({ name: data?.name ?? null }), { headers: corsHeaders })
    }

    // ============ LIST ============
    if (action === "list") {
      const supplier_id = body?.supplier_id
      let q = supabase
        .from("store_categories")
        .select("external_id,name,parent_external_id", { count: 'exact' })
        
      if (supplier_id != null) {
        q = q.eq("supplier_id", Number(supplier_id))
      }
      
      const { data, error, count } = await q.order("name")
      
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка получения списка")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ rows: data || [], count: count || 0 }), 
        { headers: corsHeaders }
      )
    }

    // ============ CREATE (оптимизированная) ============
    if (action === "create") {
      const payload = body?.data as CreateCategoryInput
      
      // Валидация
      const validation = validateCreateInput(payload)
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "validation_error", message: validation.error }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const insertData = normalizeInput(payload)
      
      // Использование upsert для избежания дубликатов (опционально)
      const { data, error } = await supabase
        .from("store_categories")
        .insert([insertData])
        .select("external_id,name,parent_external_id")
        .maybeSingle()
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка создания категории")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ item: data }), 
        { status: 201, headers: corsHeaders }
      )
    }

    // ============ BULK CREATE (оптимизированная) ============
    if (action === "bulk_create") {
      const items = (body?.items || []) as CreateCategoryInput[]
      
      if (items.length === 0) {
        return new Response(JSON.stringify({ rows: [] }), { headers: corsHeaders })
      }
      
      // Валидация всех элементов
      const validatedItems = []
      const errors = []
      
      for (let i = 0; i < items.length; i++) {
        const validation = validateCreateInput(items[i])
        if (!validation.valid) {
          errors.push({ index: i, error: validation.error })
        } else {
          validatedItems.push(normalizeInput(items[i]))
        }
      }
      
      if (errors.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: "validation_errors", 
            details: errors,
            valid_count: validatedItems.length 
          }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      // Использование upsert для игнорирования дубликатов (опционально)
      // .upsert(validatedItems, { onConflict: 'external_id,supplier_id', ignoreDuplicates: true })
      
      const { data, error } = await supabase
        .from("store_categories")
        .insert(validatedItems)
        .select("external_id,name,parent_external_id")
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка массового создания")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(
        JSON.stringify({ rows: data || [], count: data?.length || 0 }), 
        { status: 201, headers: corsHeaders }
      )
    }

    // ============ GET SUPPLIER CATEGORIES ============
    if (action === "get_supplier_categories") {
      const supplier_id = Number(body?.supplier_id)
      if (isNaN(supplier_id)) {
        return new Response(
          JSON.stringify({ error: "invalid_supplier_id" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const { data, error } = await supabase
        .from("store_categories")
        .select("id,external_id,name,parent_external_id,supplier_id")
        .eq("supplier_id", supplier_id)
        .order("name")
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка получения категорий")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ rows: data || [] }), { headers: corsHeaders })
    }

    // ============ GET SUBCATEGORIES ============
    if (action === "get_subcategories") {
      const supplier_id = body?.supplier_id
      const parent_external_id = String(body?.parent_external_id || "")
      
      let q = supabase
        .from("store_categories")
        .select("id,external_id,name,parent_external_id,supplier_id")
        .eq("parent_external_id", parent_external_id)
        .order("name")
        
      if (supplier_id != null) {
        q = q.eq("supplier_id", Number(supplier_id))
      }
      
      const { data, error } = await q
      
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка получения подкатегорий")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ rows: data || [] }), { headers: corsHeaders })
    }

    // ============ GET BY EXTERNAL ID ============
    if (action === "get_by_external_id") {
      const supplier_id = Number(body?.supplier_id)
      const external_id = String(body?.external_id || "")
      
      if (isNaN(supplier_id) || !external_id) {
        return new Response(
          JSON.stringify({ error: "invalid_parameters" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const { data, error } = await supabase
        .from("store_categories")
        .select("id,external_id,name,parent_external_id,supplier_id")
        .eq("external_id", external_id)
        .eq("supplier_id", supplier_id)
        .maybeSingle()
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка получения категории")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ item: data || null }), { headers: corsHeaders })
    }

    // ============ UPDATE NAME ============
    if (action === "update_name") {
      const supplier_id = Number(body?.supplier_id)
      const external_id = String(body?.external_id || "")
      const name = String(body?.name || "").trim()
      
      if (isNaN(supplier_id) || !external_id || !name) {
        return new Response(
          JSON.stringify({ error: "invalid_parameters" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const { data, error } = await supabase
        .from("store_categories")
        .update({ name })
        .eq("external_id", external_id)
        .eq("supplier_id", supplier_id)
        .select("external_id,name,parent_external_id")
        .maybeSingle()
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка обновления категории")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ item: data }), { headers: corsHeaders })
    }

    // ============ DELETE ============
    if (action === "delete") {
      const supplier_id = Number(body?.supplier_id)
      const external_id = String(body?.external_id || "")
      
      if (isNaN(supplier_id) || !external_id) {
        return new Response(
          JSON.stringify({ error: "invalid_parameters" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      const { error } = await supabase
        .from("store_categories")
        .delete()
        .eq("external_id", external_id)
        .eq("supplier_id", supplier_id)
        
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка удаления категории")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // ============ DELETE CASCADE (ОПТИМИЗИРОВАННАЯ!) ============
    if (action === "delete_cascade") {
      const supplier_id = Number(body?.supplier_id)
      const external_id = String(body?.external_id || "")
      
      if (isNaN(supplier_id) || !external_id) {
        return new Response(
          JSON.stringify({ error: "invalid_parameters" }), 
          { status: 400, headers: corsHeaders }
        )
      }
      
      // Используем рекурсивный SQL запрос через RPC функцию
      // Альтернатива: создать SQL функцию в БД
      const { error } = await supabase.rpc('delete_category_cascade', {
        p_supplier_id: supplier_id,
        p_external_id: external_id
      })
      
      // Если RPC функции нет, используем оптимизированный подход
      if (error?.code === '42883') { // функция не существует
        // Используем один запрос с фильтрацией на стороне клиента (лучше, чем было)
        const { data: allCategories, error: fetchError } = await supabase
          .from("store_categories")
          .select("external_id,parent_external_id")
          .eq("supplier_id", supplier_id)
          
        if (fetchError) {
          return new Response(
            JSON.stringify(handleError(fetchError, "Ошибка каскадного удаления")), 
            { status: 500, headers: corsHeaders }
          )
        }
        
        // Построение дерева для быстрого поиска
        const categoryMap = new Map<string, string[]>()
        for (const cat of allCategories || []) {
          const parent = cat.parent_external_id || 'root'
          if (!categoryMap.has(parent)) categoryMap.set(parent, [])
          categoryMap.get(parent)!.push(cat.external_id)
        }
        
        // Рекурсивный обход для сбора ID
        const toDelete = new Set<string>([external_id])
        const collectChildren = (parentId: string) => {
          const children = categoryMap.get(parentId) || []
          for (const childId of children) {
            toDelete.add(childId)
            collectChildren(childId)
          }
        }
        collectChildren(external_id)
        
        const ids = Array.from(toDelete)
        if (ids.length > 0) {
          const { error: delError } = await supabase
            .from("store_categories")
            .delete()
            .eq("supplier_id", supplier_id)
            .in("external_id", ids)
            
          if (delError) {
            return new Response(
              JSON.stringify(handleError(delError, "Ошибка каскадного удаления")), 
              { status: 500, headers: corsHeaders }
            )
          }
        }
        
        return new Response(
          JSON.stringify({ ok: true, deleted_count: ids.length }), 
          { headers: corsHeaders }
        )
      }
      
      if (error) {
        return new Response(
          JSON.stringify(handleError(error, "Ошибка каскадного удаления")), 
          { status: 500, headers: corsHeaders }
        )
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ error: "unknown_action", available_actions: [
        "list", "get_by_id", "get_name_by_id", "get_by_external_id",
        "get_supplier_categories", "get_subcategories", "create", 
        "bulk_create", "update_name", "delete", "delete_cascade"
      ]}), 
      { status: 400, headers: corsHeaders }
    )
    
  } catch (e) {
    console.error("Error:", e)
    return new Response(
      JSON.stringify({ 
        error: "internal_error", 
        message: (e as Error).message || "Произошла внутренняя ошибка" 
      }), 
      { status: 500, headers: corsHeaders }
    )
  }
})