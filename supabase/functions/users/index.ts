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

    // ---------------- GET /users ----------------
    if (req.method === 'GET' && !userId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = (page - 1) * limit;
      const sortBy = url.searchParams.get('sortBy') || 'created_at';
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
    // Check admin permission for POST, PATCH, DELETE operations
    const adminCheck: any = await checkAdminPermission(serviceClient, authHeader);
    if ('error' in adminCheck) {
      return new Response(JSON.stringify({ 
        error: adminCheck.error,
        debug: adminCheck.debug || {}
      }), { 
        status: adminCheck.status, 
        headers: corsHeaders 
      });
    }

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
        authorizationHeader: req.headers.get('Authorization') ? 'present' : 'missing',
        allHeaders: Object.fromEntries(req.headers.entries())
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
        // Удаление из Auth
        const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
        if (!authError) {
          deletedAuth = true;
          console.log(`Successfully deleted user from auth: ${userId}`);
        } else {
          console.warn("Auth delete error:", authError.message);
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
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: "User not found in auth and profiles"
          }), { headers: corsHeaders, status: 500 });
        }

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
