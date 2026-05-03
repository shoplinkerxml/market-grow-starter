import { createClient, SupabaseClient } from '@supabase/supabase-js'



// Заголовки CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Проверка админа для POST/PATCH/DELETE
async function checkAdminPermission(serviceClient: SupabaseClient, authHeader: string) {
  // Debug information for header analysis
  const hasAuthHeader = !!authHeader;
  const tokenLength = authHeader ? authHeader.length : 0;
  const isBearerToken = authHeader && authHeader.startsWith('Bearer ');
  
  if (!authHeader) {
    return { 
      error: 'Unauthorized - no token', 
      status: 401,
      debug: {
        hasAuthHeader,
        tokenLength,
        isBearerToken
      }
    };
  }

  // Extract the token from the Authorization header (Bearer token)
  const token = authHeader.replace('Bearer ', '');
  
  // Validate that we have a proper token
  if (!token || token.length < 10) {
    return { 
      error: 'Unauthorized - invalid token format', 
      status: 401,
      debug: {
        hasAuthHeader,
        tokenLength,
        isBearerToken,
        extractedTokenLength: token ? token.length : 0
      }
    };
  }
  
  const client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    }
  );

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { 
      error: 'Unauthorized - invalid token', 
      status: 401,
      debug: {
        hasAuthHeader,
        tokenLength,
        isBearerToken,
        userError: userError?.message || 'No user found'
      }
    };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) return { 
    error: 'Failed to fetch profile', 
    status: 500,
    debug: {
      hasAuthHeader,
      tokenLength,
      isBearerToken,
      profileError: profileError.message
    }
  };
  
  if (!profile) return { 
    error: 'User profile not found', 
    status: 404,
    debug: {
      hasAuthHeader,
      tokenLength,
      isBearerToken,
      userId: user.id
    }
  };
  
  if (profile.role !== 'admin') return { 
    error: 'Forbidden - Admin access required', 
    status: 403,
    debug: {
      hasAuthHeader,
      tokenLength,
      isBearerToken,
      userRole: profile.role
    }
  };

  return { user, profile };
}

// Основная функция
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const userId = pathParts.length > 1 ? pathParts[1] : null;

    // Extract the token from the Authorization header (Bearer token)
    const token = authHeader.replace('Bearer ', '');
    
    const anonClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: authHeader ? { Authorization: `Bearer ${token}` } : {} } }
    );

    const serviceClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // All operations now require admin permission (incl. GET to avoid leaking profiles)
    const adminCheckEarly: any = await checkAdminPermission(serviceClient, authHeader);
    if ('error' in adminCheckEarly) {
      return new Response(JSON.stringify({
        error: adminCheckEarly.error,
        debug: adminCheckEarly.debug || {}
      }), {
        status: adminCheckEarly.status,
        headers: corsHeaders
      });
    }

    // ---------------- GET /users ----------------
    if (req.method === 'GET' && !userId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = (page - 1) * limit;
      const ALLOWED_SORT = new Set(['created_at','name','email','role','status','updated_at']);
      const rawSort = url.searchParams.get('sortBy') || 'created_at';
      const sortBy = ALLOWED_SORT.has(rawSort) ? rawSort : 'created_at';
      const sortOrder = url.searchParams.get('sortOrder') || 'desc';
      const search = url.searchParams.get('search') || undefined;
      const roleParam = url.searchParams.get('role') || undefined;

      let query = anonClient.from('profiles').select('*', { count: 'exact' });
      if (roleParam && roleParam !== 'all') query = query.eq('role', roleParam);
      if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(offset, offset + limit - 1);

      const { data: users, error, count } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

      // Оптимизированный запрос подписок - ОДИН запрос вместо N запросов
      if (users && users.length > 0) {
        const userIds = users.map(u => u.id);
        
        // Получаем все активные подписки одним запросом
        const { data: subscriptions } = await serviceClient
          .from('user_subscriptions')
          .select(`
            user_id,
            tariff_id,
            is_active,
            tariffs (
              name
            )
          `)
          .in('user_id', userIds)
          .eq('is_active', true);
        
        // Создаем Map для быстрого поиска
        const subscriptionMap = new Map();
        if (subscriptions) {
          subscriptions.forEach(sub => {
            subscriptionMap.set(sub.user_id, {
              tariff_name: sub.tariffs ? (sub.tariffs as any).name : null,
              is_active: sub.is_active
            });
          });
        }
        
        // Добавляем подписки к пользователям
        const usersWithSubscriptions = users.map(user => ({
          ...user,
          subscription: subscriptionMap.get(user.id) || null
        }));
        
        return new Response(JSON.stringify({ users: usersWithSubscriptions, total: count ?? 0, page, limit }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ users: users || [], total: count ?? 0, page, limit }), { headers: corsHeaders });
    }

    // ---------------- GET /users/:id ----------------
    if (req.method === 'GET' && userId) {
      const { data: user, error } = await anonClient.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders });
      return new Response(JSON.stringify({ user }), { headers: corsHeaders });
    }

    // ---------------- ALL OTHER OPERATIONS REQUIRE ADMIN PERMISSIONS ----------------
    const adminCheck: any = adminCheckEarly;

    // ---------------- POST /users ----------------
    if (req.method === 'POST') {
      try {
        const { email, password, name, phone, role = 'user' }: { email: string; password: string; name: string; phone?: string; role?: string } = await req.json();
        if (!email || !password || !name) {
          return new Response(JSON.stringify({ error: 'Email, password, and name are required' }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Validate role
        const validRoles = ['admin', 'manager', 'user'];
        if (!validRoles.includes(role)) {
          return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Create user with Supabase auth
        const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({ 
          email, 
          password, 
          email_confirm: true, 
          user_metadata: { name, role }  // Pass role in metadata so trigger function can use it
        });
        
        if (authError) {
          console.error('Auth error:', authError);
          // Check if it's a duplicate email error
          if (authError.message.includes('duplicate') || authError.message.includes('already exists')) {
            return new Response(JSON.stringify({ error: 'A user with this email already exists' }), { 
              status: 409, 
              headers: corsHeaders 
            });
          }
          return new Response(JSON.stringify({ error: `Authentication error: ${authError.message}` }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Wait for the trigger function to create the profile
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to get the created profile
        const { data: profile, error: profileError } = await serviceClient
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
          
        if (profileError || !profile) {
          console.warn('Warning: Could not retrieve created profile:', profileError?.message || 'Profile not found');
          // Return basic user info
          return new Response(JSON.stringify({ 
            user: { 
              id: authData.user.id,
              email,
              name,
              phone: phone || null,
              role,
              status: 'active'
            }
          }), { 
            status: 201, 
            headers: corsHeaders 
          });
        }

        // Try to update the profile with additional information
        const { data: updatedProfile, error: updateError } = await serviceClient
          .from('profiles')
          .update({ 
            name, 
            phone: phone || null
          })
          .eq('id', authData.user.id)
          .select()
          .maybeSingle();
          
        if (updateError) {
          console.warn('Warning: Could not update profile with additional info:', updateError.message);
          // Return the original profile data
          return new Response(JSON.stringify({ user: profile }), { 
            status: 201, 
            headers: corsHeaders 
          });
        }
        
        return new Response(JSON.stringify({ user: updatedProfile || profile }), { 
          status: 201, 
          headers: corsHeaders 
        });
      } catch (err) {
        console.error('Unexpected error in POST /users:', err);
        const error = err instanceof Error ? err : new Error(String(err))
        return new Response(JSON.stringify({ error: `Unexpected error: ${error.message || 'Unknown error'}` }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // ---------------- PATCH /users/:id ----------------
    if (req.method === 'PATCH' && userId) {
      // Add detailed logging for debugging
      console.log('PATCH /users/:id called with:', {
        userId,
        method: req.method,
        contentType: req.headers.get('Content-Type'),
        contentLength: req.headers.get('Content-Length'),
        hasAuth: !!req.headers.get('Authorization')
      });

      const contentType = req.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Check if Content-Length header is present and valid
      const contentLength = req.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength, 10) === 0) {
        console.log('Empty request body detected via Content-Length header');
        return new Response(JSON.stringify({ error: 'Request body is required and cannot be empty' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      let body: { name?: string; phone?: string; role?: string; status?: string };
      try { 
        body = await req.json();
        console.log('Request body parsed successfully:', { body, bodyKeys: Object.keys(body) });
      } catch (err) {
        console.error('Failed to parse request body:', err);
        // Check if body is empty or malformed
        const bodyText = await req.text().catch(() => '');
        console.log('Raw body text:', { bodyText, bodyLength: bodyText.length });
        return new Response(JSON.stringify({ error: 'Request body must be valid JSON' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Additional validation for edge cases
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        console.log('Invalid body type detected:', { body, bodyType: typeof body, isArray: Array.isArray(body) });
        return new Response(JSON.stringify({ error: 'Request body must be a JSON object' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      if (Object.keys(body).length === 0) {
        console.log('Empty body detected:', { body, bodyLength: Object.keys(body).length });
        return new Response(JSON.stringify({ error: 'No fields provided for update' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      const { name, phone, role, status } = body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;

      // Validate that we have at least one field to update
      if (Object.keys(updateData).length === 0) {
        console.log('No valid fields to update after filtering:', { body, updateData });
        return new Response(JSON.stringify({ error: 'No valid fields provided for update' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      console.log('Update data prepared:', { updateData, userId });

      const { data: user, error } = await serviceClient
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .maybeSingle();
        
      if (error) {
        console.error('Update error:', error);
        return new Response(JSON.stringify({ error: `Update error: ${error.message}` }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404, 
          headers: corsHeaders 
        });
      }

      console.log('User updated successfully:', { userId, updateData });
      return new Response(JSON.stringify({ user }), { headers: corsHeaders });
    }

    // ---------------- DELETE /users/:id ----------------
    if (req.method === 'DELETE' && userId) {
      let deletedAuth = false;
      let deletedProfile = false;

      try {
        const { data: storeRows, error: storesError } = await serviceClient
          .from('user_stores')
          .select('id')
          .eq('user_id', userId);
        if (storesError) {
          console.warn("User stores fetch error:", storesError.message);
        }

        const { data: supplierRows, error: suppliersError } = await serviceClient
          .from('user_suppliers')
          .select('id')
          .eq('user_id', userId);
        if (suppliersError) {
          console.warn("User suppliers fetch error:", suppliersError.message);
        }

        const storeIdSet = new Set<string>(
          (storeRows || [])
            .map((row: any) => String(row?.id || '').trim())
            .filter(Boolean)
        );
        const supplierIds = (supplierRows || [])
          .map((row: any) => String(row?.id || '').trim())
          .filter(Boolean);

        const { data: importJobRows, error: importJobsStoreError } = await serviceClient
          .from('product_import_jobs')
          .select('store_id')
          .eq('user_id', userId)
          .not('store_id', 'is', null);
        if (importJobsStoreError) {
          console.warn("Product import jobs store fetch error:", importJobsStoreError.message);
        }
        for (const row of importJobRows || []) {
          const storeId = String((row as any)?.store_id || '').trim();
          if (storeId) storeIdSet.add(storeId);
        }

        const storeIds = Array.from(storeIdSet);
        const categoryIds = new Set<number>();
        if (storeIds.length > 0) {
          const { data: categoriesByStore, error: categoriesStoreError } = await serviceClient
            .from('store_categories')
            .select('id')
            .in('store_id', storeIds);
          if (categoriesStoreError) {
            console.warn("Store categories fetch error:", categoriesStoreError.message);
          }
          for (const row of categoriesByStore || []) {
            if ((row as any)?.id != null) categoryIds.add(Number((row as any).id));
          }
        }
        if (supplierIds.length > 0) {
          const { data: categoriesBySupplier, error: categoriesSupplierError } = await serviceClient
            .from('store_categories')
            .select('id')
            .in('supplier_id', supplierIds);
          if (categoriesSupplierError) {
            console.warn("Supplier categories fetch error:", categoriesSupplierError.message);
          }
          for (const row of categoriesBySupplier || []) {
            if ((row as any)?.id != null) categoryIds.add(Number((row as any).id));
          }
        }

        const productIds = new Set<string>();
        if (storeIds.length > 0) {
          const { data: productsByStore, error: productsStoreError } = await serviceClient
            .from('store_products')
            .select('id')
            .in('store_id', storeIds);
          if (productsStoreError) {
            console.warn("Store products fetch error:", productsStoreError.message);
          }
          for (const row of productsByStore || []) {
            const pid = String((row as any)?.id || '').trim();
            if (pid) productIds.add(pid);
          }
        }
        if (supplierIds.length > 0) {
          const { data: productsBySupplier, error: productsSupplierError } = await serviceClient
            .from('store_products')
            .select('id')
            .in('supplier_id', supplierIds);
          if (productsSupplierError) {
            console.warn("Supplier products fetch error:", productsSupplierError.message);
          }
          for (const row of productsBySupplier || []) {
            const pid = String((row as any)?.id || '').trim();
            if (pid) productIds.add(pid);
          }
        }

        const templateIds = new Set<number>();
        if (categoryIds.size > 0) {
          const { data: templatesRows, error: templatesError } = await serviceClient
            .from('category_templates')
            .select('id')
            .in('category_id', Array.from(categoryIds));
          if (templatesError) {
            console.warn("Category templates fetch error:", templatesError.message);
          }
          for (const row of templatesRows || []) {
            if ((row as any)?.id != null) templateIds.add(Number((row as any).id));
          }
        }

        const attributeIds = new Set<number>();
        if (templateIds.size > 0) {
          const { data: attributeRows, error: attributesError } = await serviceClient
            .from('template_attributes')
            .select('id')
            .in('template_id', Array.from(templateIds));
          if (attributesError) {
            console.warn("Template attributes fetch error:", attributesError.message);
          }
          for (const row of attributeRows || []) {
            if ((row as any)?.id != null) attributeIds.add(Number((row as any).id));
          }
        }

        const paramIds = new Set<number>();
        if (productIds.size > 0) {
          const { data: paramsRows, error: paramsError } = await serviceClient
            .from('store_product_params')
            .select('id')
            .in('product_id', Array.from(productIds));
          if (paramsError) {
            console.warn("Store product params fetch error:", paramsError.message);
          }
          for (const row of paramsRows || []) {
            if ((row as any)?.id != null) paramIds.add(Number((row as any).id));
          }
        }

        if (attributeIds.size > 0) {
          const { error: deleteAttributeValuesError } = await serviceClient
            .from('attribute_values')
            .delete()
            .in('attribute_id', Array.from(attributeIds));
          if (deleteAttributeValuesError) {
            console.warn("Attribute values delete error:", deleteAttributeValuesError.message);
          }
        }

        if (templateIds.size > 0) {
          const { error: deleteTemplateAttributesError } = await serviceClient
            .from('template_attributes')
            .delete()
            .in('template_id', Array.from(templateIds));
          if (deleteTemplateAttributesError) {
            console.warn("Template attributes delete error:", deleteTemplateAttributesError.message);
          }
        }

        if (categoryIds.size > 0) {
          const { error: deleteCategoryTemplatesError } = await serviceClient
            .from('category_templates')
            .delete()
            .in('category_id', Array.from(categoryIds));
          if (deleteCategoryTemplatesError) {
            console.warn("Category templates delete error:", deleteCategoryTemplatesError.message);
          }
        }

        if (storeIds.length > 0) {
          const { error: deleteStoreCategoriesLinksError } = await serviceClient
            .from('store_store_categories')
            .delete()
            .in('store_id', storeIds);
          if (deleteStoreCategoriesLinksError) {
            console.warn("Store categories links delete error:", deleteStoreCategoriesLinksError.message);
          }
        }
        if (categoryIds.size > 0) {
          const { error: deleteCategoryLinksError } = await serviceClient
            .from('store_store_categories')
            .delete()
            .in('category_id', Array.from(categoryIds));
          if (deleteCategoryLinksError) {
            console.warn("Category links delete error:", deleteCategoryLinksError.message);
          }
        }

        if (paramIds.size > 0) {
          const { error: deleteParamTemplatesError } = await serviceClient
            .from('product_param_templates')
            .delete()
            .in('product_param_id', Array.from(paramIds));
          if (deleteParamTemplatesError) {
            console.warn("Product param templates delete error:", deleteParamTemplatesError.message);
          }
        }

        if (productIds.size > 0) {
          const { error: deleteImagesError } = await serviceClient
            .from('store_product_images')
            .delete()
            .in('product_id', Array.from(productIds));
          if (deleteImagesError) {
            console.warn("Store product images delete error:", deleteImagesError.message);
          }

          const { error: deleteParamsError } = await serviceClient
            .from('store_product_params')
            .delete()
            .in('product_id', Array.from(productIds));
          if (deleteParamsError) {
            console.warn("Store product params delete error:", deleteParamsError.message);
          }

          const { error: deleteLinksError } = await serviceClient
            .from('store_product_links')
            .delete()
            .in('product_id', Array.from(productIds));
          if (deleteLinksError) {
            console.warn("Store product links delete error:", deleteLinksError.message);
          }
        }

        if (storeIds.length > 0) {
          const { error: deleteLinksByStoreError } = await serviceClient
            .from('store_product_links')
            .delete()
            .in('store_id', storeIds);
          if (deleteLinksByStoreError) {
            console.warn("Store product links by store delete error:", deleteLinksByStoreError.message);
          }
        }

        if (storeIds.length > 0) {
          const { error: deleteStoreProductsError } = await serviceClient
            .from('store_products')
            .delete()
            .in('store_id', storeIds);
          if (deleteStoreProductsError) {
            console.warn("Store products delete error:", deleteStoreProductsError.message);
          }
        }
        if (supplierIds.length > 0) {
          const { error: deleteSupplierProductsError } = await serviceClient
            .from('store_products')
            .delete()
            .in('supplier_id', supplierIds);
          if (deleteSupplierProductsError) {
            console.warn("Supplier products delete error:", deleteSupplierProductsError.message);
          }
        }

        if (categoryIds.size > 0) {
          const { error: deleteCategoriesByIdError } = await serviceClient
            .from('store_categories')
            .delete()
            .in('id', Array.from(categoryIds));
          if (deleteCategoriesByIdError) {
            console.warn("Store categories delete error:", deleteCategoriesByIdError.message);
          }
        }
        if (storeIds.length > 0) {
          const { error: deleteCategoriesByStoreError } = await serviceClient
            .from('store_categories')
            .delete()
            .in('store_id', storeIds);
          if (deleteCategoriesByStoreError) {
            console.warn("Store categories by store delete error:", deleteCategoriesByStoreError.message);
          }
        }
        if (supplierIds.length > 0) {
          const { error: deleteCategoriesBySupplierError } = await serviceClient
            .from('store_categories')
            .delete()
            .in('supplier_id', supplierIds);
          if (deleteCategoriesBySupplierError) {
            console.warn("Store categories by supplier delete error:", deleteCategoriesBySupplierError.message);
          }
        }

        if (storeIds.length > 0) {
          const { error: deleteCurrenciesError } = await serviceClient
            .from('store_currencies')
            .delete()
            .in('store_id', storeIds);
          if (deleteCurrenciesError) {
            console.warn("Store currencies delete error:", deleteCurrenciesError.message);
          }

          const { error: deleteExportLinksError } = await serviceClient
            .from('store_export_links')
            .delete()
            .in('store_id', storeIds);
          if (deleteExportLinksError) {
            console.warn("Store export links delete error:", deleteExportLinksError.message);
          }
        }

        const { error: deleteImportJobsError } = await serviceClient
          .from('product_import_jobs')
          .delete()
          .eq('user_id', userId);
        if (deleteImportJobsError) {
          console.warn("Product import jobs delete error:", deleteImportJobsError.message);
        }
        if (storeIds.length > 0) {
          const { error: deleteImportJobsByStoreError } = await serviceClient
            .from('product_import_jobs')
            .delete()
            .in('store_id', storeIds);
          if (deleteImportJobsByStoreError) {
            console.warn("Product import jobs by store delete error:", deleteImportJobsByStoreError.message);
          }
        }

        const { error: deleteMenuItemsError } = await serviceClient
          .from('user_menu_items')
          .delete()
          .eq('user_id', userId);
        if (deleteMenuItemsError) {
          console.warn("User menu items delete error:", deleteMenuItemsError.message);
        }

        const { error: deletePermissionsError } = await serviceClient
          .from('user_permissions')
          .delete()
          .eq('user_id', userId);
        if (deletePermissionsError) {
          console.warn("User permissions delete error:", deletePermissionsError.message);
        }

        const { error: deleteSubscriptionsError } = await serviceClient
          .from('user_subscriptions')
          .delete()
          .eq('user_id', userId);
        if (deleteSubscriptionsError) {
          console.warn("User subscriptions delete error:", deleteSubscriptionsError.message);
        }

        const { error: deleteUserSuppliersError } = await serviceClient
          .from('user_suppliers')
          .delete()
          .eq('user_id', userId);
        if (deleteUserSuppliersError) {
          console.warn("User suppliers delete error:", deleteUserSuppliersError.message);
        }

        const { error: deleteUserStoresError } = await serviceClient
          .from('user_stores')
          .delete()
          .eq('user_id', userId);
        if (deleteUserStoresError) {
          console.warn("User stores delete error:", deleteUserStoresError.message);
        }

        const { error: deleteCountersByUserError } = await serviceClient
          .from('counters')
          .delete()
          .eq('user_id', userId);
        if (deleteCountersByUserError) {
          console.warn("Counters delete by user error:", deleteCountersByUserError.message);
        }

        const entityIds = new Set<string>();
        entityIds.add(String(userId));
        for (const storeId of storeIds) {
          entityIds.add(storeId);
          entityIds.add(`store:${storeId}:products`);
          entityIds.add(`store:${storeId}:categories`);
        }
        for (const supplierId of supplierIds) {
          entityIds.add(supplierId);
        }

        if (entityIds.size > 0) {
          const ids = Array.from(entityIds);
          const { error: countersError } = await serviceClient
            .from('counters')
            .delete()
            .in('entity_id', ids);
          if (countersError) {
            console.warn("Counters cleanup error:", countersError.message);
          }
        }

        // Удаление из Auth
        const { data: authUserBefore, error: authUserBeforeError } = await serviceClient.auth.admin.getUserById(userId);
        if (authUserBeforeError) {
          console.warn("Auth get user error:", authUserBeforeError.message);
        }
        const authUserExistsBefore = !!authUserBefore?.user;

        const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
        if (!authError) {
          deletedAuth = true;
          console.log(`Successfully deleted user from auth: ${userId}`);
        } else {
          console.warn("Auth delete error:", authError.message);
        }

        const { data: authUserAfter, error: authUserAfterError } = await serviceClient.auth.admin.getUserById(userId);
        if (authUserAfterError) {
          console.warn("Auth get user after error:", authUserAfterError.message);
        }
        const authUserExistsAfter = !!authUserAfter?.user;
        if (authUserExistsBefore && (authError || authUserExistsAfter)) {
          throw new Error("Failed to delete user from auth");
        }
        if (!authUserExistsAfter) {
          deletedAuth = true;
        }

        // Удаление из profiles
        const { error: profileError } = await serviceClient
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (!profileError) {
          deletedProfile = true;
          console.log(`Successfully deleted user profile: ${userId}`);
        } else {
          console.warn("Profile delete error:", profileError.message);
        }

        // Формируем ответ
        if (deletedAuth || deletedProfile) {
          return new Response(JSON.stringify({
            success: true,
            deletedAuth,
            deletedProfile
          }), { headers: corsHeaders, status: 200 });
        }

        return new Response(JSON.stringify({
          success: true,
          deletedAuth,
          deletedProfile,
          alreadyDeleted: true
        }), { headers: corsHeaders, status: 200 });

      } catch (err) {
        console.error("Unexpected error in DELETE /users:", err);
        const error = err instanceof Error ? err : new Error(String(err))
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), { headers: corsHeaders, status: 500 });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Unexpected error in main function:', error);
    const err = error instanceof Error ? error : new Error(String(error))
    return new Response(JSON.stringify({ error: `Internal server error: ${err.message || 'Unknown error'}` }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
