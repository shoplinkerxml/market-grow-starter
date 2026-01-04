import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Content-Type': 'application/json'
}

async function getUserWithPermissions(supabaseClient: any) {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
  
  if (userError || !user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.log('Profile fetch error:', profileError)
    return { error: 'Failed to fetch profile', status: 500 }
  }

  if (!profile) {
    return { error: 'Profile not found', status: 404 }
  }

  return { user, profile }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Handle both authentication methods per Supabase recommendations
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');

    let supabaseClient;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Authenticated user request
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );
    } else if (apiKey) {
      // Anonymous request
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        apiKey,
        {}
      );
    } else {
      // No authentication provided
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userCheck = await getUserWithPermissions(supabaseClient)
    if ('error' in userCheck) {
      return new Response(
        JSON.stringify({ error: userCheck.error }),
        { 
          status: userCheck.status, 
          headers: { ...corsHeaders }
        }
      )
    }

    const { user, profile } = userCheck
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(p => p)
    const menuId = pathParts.length > 1 ? pathParts[1] : null

    // GET /menu - получить меню для текущего пользователя
    if (req.method === 'GET' && !menuId) {
      let menuQuery = supabaseClient
        .from('menu_items')
        .select('*')
        .eq('is_active', true)
        .order('parent_id', { nullsFirst: true })
        .order('order_index')

      // Если не админ, фильтруем по правам доступа
      if (profile.role !== 'admin') {
        const { data: permissions } = await supabaseClient
          .from('user_permissions')
          .select('menu_item_id')
          .eq('user_id', user.id)
          .eq('can_view', true)

        const allowedMenuIds = permissions?.map(p => p.menu_item_id) || []
        if (allowedMenuIds.length === 0) {
          return new Response(
            JSON.stringify({ menu: [] }),
            { 
              headers: { ...corsHeaders }
            }
          )
        }

        menuQuery = menuQuery.in('id', allowedMenuIds)
      }

      const { data: menu, error } = await menuQuery

      if (error) {
        console.log('Menu fetch error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch menu' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      // Структурируем меню с подменю
      const structuredMenu = menu?.filter(item => !item.parent_id).map(parent => ({
        ...parent,
        children: menu?.filter(child => child.parent_id === parent.id) || []
      })) || []

      return new Response(
        JSON.stringify({ menu: structuredMenu }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // GET /menu/:id/children - получить подменю для конкретного пункта
    if (req.method === 'GET' && menuId) {
      const { data: children, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('parent_id', menuId)
        .eq('is_active', true)
        .order('order_index')

      if (error) {
        console.log('Submenu fetch error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch submenu' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ children }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // Только админы могут управлять меню
    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders }
        }
      )
    }

    // POST /menu - создать пункт меню
    if (req.method === 'POST') {
      const body = await req.json()
      const { title, path, parent_id, order_index } = body

      if (!title || !path) {
        return new Response(
          JSON.stringify({ error: 'Title and path are required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders }
          }
        )
      }

      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .insert({ title, path, parent_id, order_index })
        .select()
        .single()

      if (error) {
        console.log('Menu creation error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create menu item' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ menuItem }),
        { 
          status: 201,
          headers: { ...corsHeaders }
        }
      )
    }

    // PATCH /menu/:id - обновить пункт меню
    if (req.method === 'PATCH' && menuId) {
      const body = await req.json()
      const { title, path, parent_id, order_index, is_active } = body

      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .update({ title, path, parent_id, order_index, is_active })
        .eq('id', menuId)
        .select()
        .single()

      if (error) {
        console.log('Menu update error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to update menu item' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ menuItem }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // DELETE /menu/:id - деактивировать пункт меню
    if (req.method === 'DELETE' && menuId) {
      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .update({ is_active: false })
        .eq('id', menuId)
        .select()
        .single()

      if (error) {
        console.log('Menu deactivation error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to deactivate menu item' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ menuItem }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})