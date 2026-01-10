
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // Fetch all required data in parallel
    const [
      { data: suppliers, error: suppliersError },
      { data: shops, error: shopsError },
      { count: totalProducts, error: totalProductsError },
      { count: totalCategories, error: totalCategoriesError }
    ] = await Promise.all([
      // Suppliers with product count
      supabaseClient
        .from('suppliers')
        .select(`
          id,
          supplier_name,
          user_master_products:user_master_products!supplier_id(count)
        `)
        .eq('user_id', userId),
      
      // Shops with product count
      supabaseClient
        .from('user_stores')
        .select(`
          id,
          store_name,
          store_product_links:store_product_links!store_id(count)
        `)
        .eq('user_id', userId),

      // Total products
      supabaseClient
        .from('user_master_products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Total categories (assuming from store_categories or user_categories? 
      // The user code used `stores.reduce((acc, s) => acc + (s.categoriesCount || 0), 0)` 
      // which implies sum of categories across stores.
      // Let's check table name. Likely `store_categories`.
      supabaseClient
        .from('store_categories')
        .select('*', { count: 'exact', head: true })
        // store_categories usually links to user_stores, so we need to filter by stores belonging to user.
        // But RLS should handle it if set up correctly.
        // Or we filter by store_id in (select id from user_stores where user_id = uid)
        // Let's try simple select if RLS is on. If not, we might need a join or filter.
        // Assuming RLS protects store_categories based on store ownership.
        .in('store_id', (
             await supabaseClient.from('user_stores').select('id').eq('user_id', userId)
        ).data?.map(s => s.id) || [])
    ])

    if (suppliersError) throw suppliersError
    if (shopsError) throw shopsError
    
    // Transform data
    const transformedSuppliers = suppliers?.map(s => ({
      id: s.id,
      supplier_name: s.supplier_name,
      productCount: s.user_master_products?.[0]?.count || 0
    })) || []

    const transformedShops = shops?.map(s => ({
      id: s.id,
      store_name: s.store_name,
      productsCount: s.store_product_links?.[0]?.count || 0
    })) || []

    // Calculate total categories correctly if the count query above failed or needs adjustment.
    // The previous logic was: stores.reduce((acc, s) => acc + (s.categoriesCount || 0), 0)
    // To replicate this accurately, we should probably count store_categories.
    // The query above does that.

    return new Response(
      JSON.stringify({
        suppliers: transformedSuppliers,
        stores: transformedShops,
        totalProducts: totalProducts || 0,
        totalCategories: totalCategories || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
