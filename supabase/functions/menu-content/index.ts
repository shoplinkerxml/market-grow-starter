import { createClient } from '@supabase/supabase-js'
import type { Database } from '../_shared/database-types.ts'

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
      supabaseClient = createClient<Database>(
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
      supabaseClient = createClient<Database>(
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
    const endpoint = pathParts[1] // 'content', 'item', etc.
    const param = pathParts[2] // ID or path

    // GET /menu-content/by-path?path=/dashboard - get menu item by path
    if (req.method === 'GET' && endpoint === 'by-path') {
      const menuPath = url.searchParams.get('path')
      
      if (!menuPath) {
        return new Response(
          JSON.stringify({ error: 'Path parameter is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders }
          }
        )
      }

      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('path', menuPath)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('Menu item fetch error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch menu item' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      if (!menuItem) {
        return new Response(
          JSON.stringify({ error: 'Menu item not found', path: menuPath }),
          { 
            status: 404, 
            headers: { ...corsHeaders }
          }
        )
      }

      // Check permissions for non-admin users
      if (profile.role !== 'admin') {
        const { data: permission } = await supabaseClient
          .from('user_permissions')
          .select('can_view')
          .eq('user_id', user.id)
          .eq('menu_item_id', menuItem.id)
          .maybeSingle()

        if (!permission?.can_view) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { 
              status: 403, 
              headers: { ...corsHeaders }
            }
          )
        }
      }

      return new Response(
        JSON.stringify({ menuItem }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // GET /menu-content/item/:id - get specific menu item content by ID
    if (req.method === 'GET' && endpoint === 'item' && param) {
      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('id', param)
        .maybeSingle()

      if (error) {
        console.error('Menu item fetch error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch menu item' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      if (!menuItem) {
        return new Response(
          JSON.stringify({ error: 'Menu item not found' }),
          { 
            status: 404, 
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

    // Only admins can manage menu content beyond viewing
    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders }
        }
      )
    }

    // PUT /menu-content/item/:id - update menu item content
    if (req.method === 'PUT' && endpoint === 'item' && param) {
      const body = await req.json()
      const { 
        title, 
        path, 
        page_type, 
        content_data, 
        template_name, 
        meta_data,
        parent_id,
        order_index,
        is_active
      } = body

      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (path !== undefined) updateData.path = path
      if (page_type !== undefined) updateData.page_type = page_type
      if (content_data !== undefined) updateData.content_data = content_data
      if (template_name !== undefined) updateData.template_name = template_name
      if (meta_data !== undefined) updateData.meta_data = meta_data
      if (parent_id !== undefined) updateData.parent_id = parent_id
      if (order_index !== undefined) updateData.order_index = order_index
      if (is_active !== undefined) updateData.is_active = is_active

      const { data: menuItem, error } = await supabaseClient
        .from('menu_items')
        .update(updateData)
        .eq('id', param)
        .select()
        .single()

      if (error) {
        console.error('Menu item update error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to update menu item content' }),
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

    // POST /menu-content/item - create new menu item with content
    if (req.method === 'POST' && endpoint === 'item') {
      const body = await req.json()
      const { 
        title, 
        path, 
        page_type = 'content',
        content_data = {},
        template_name,
        meta_data = {},
        parent_id,
        order_index = 0
      } = body

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
        .insert({ 
          title, 
          path, 
          page_type,
          content_data,
          template_name,
          meta_data,
          parent_id, 
          order_index 
        })
        .select()
        .single()

      if (error) {
        console.error('Menu item creation error:', error)
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

    // GET /menu-content/templates - get available page templates
    if (req.method === 'GET' && endpoint === 'templates') {
      const templates = {
        content: ['default', 'article', 'landing'],
        form: ['contact', 'survey', 'registration', 'custom'],
        dashboard: ['analytics', 'overview', 'reports'],
        list: ['table', 'cards', 'timeline'],
        custom: ['custom-component']
      }

      return new Response(
        JSON.stringify({ templates }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders }
      }
    )
  }
})