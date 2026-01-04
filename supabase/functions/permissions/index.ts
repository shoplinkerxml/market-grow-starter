import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Content-Type': 'application/json'
}

async function checkAdminPermission(supabaseClient: any) {
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

  if (!profile || profile?.role !== 'admin') {
    return { error: 'Forbidden - Admin access required', status: 403 }
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

    const adminCheck = await checkAdminPermission(supabaseClient)
    if ('error' in adminCheck) {
      return new Response(
        JSON.stringify({ error: adminCheck.error }),
        { 
          status: adminCheck.status, 
          headers: { ...corsHeaders }
        }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(p => p)
    const userId = pathParts.length > 1 ? pathParts[1] : null
    const menuItemId = pathParts.length > 2 ? pathParts[2] : null

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders }
        }
      )
    }

    // GET /permissions/:userId - получить доступы пользователя
    if (req.method === 'GET' && !menuItemId) {
      const { data: permissions, error } = await supabaseClient
        .from('user_permissions')
        .select(`
          *,
          menu_items:menu_item_id (
            id,
            title,
            path
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.log('Permissions fetch error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch permissions' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ permissions }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // POST /permissions/:userId - назначить доступы пользователю
    if (req.method === 'POST' && !menuItemId) {
      const body = await req.json()
      const { permissions } = body // Array of { menu_item_id, can_view, can_edit }

      if (!Array.isArray(permissions)) {
        return new Response(
          JSON.stringify({ error: 'Permissions must be an array' }),
          { 
            status: 400, 
            headers: { ...corsHeaders }
          }
        )
      }

      // Delete existing permissions for this user
      await supabaseClient
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)

      // Insert new permissions
      const permissionsToInsert = permissions.map(p => ({
        user_id: userId,
        menu_item_id: p.menu_item_id,
        can_view: p.can_view ?? true,
        can_edit: p.can_edit ?? false
      }))

      const { data: newPermissions, error } = await supabaseClient
        .from('user_permissions')
        .insert(permissionsToInsert)
        .select()

      if (error) {
        console.log('Permissions creation error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create permissions' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ permissions: newPermissions }),
        { 
          status: 201,
          headers: { ...corsHeaders }
        }
      )
    }

    // PATCH /permissions/:userId/:menuItemId - изменить конкретный доступ
    if (req.method === 'PATCH' && menuItemId) {
      const body = await req.json()
      const { can_view, can_edit } = body

      const { data: permission, error } = await supabaseClient
        .from('user_permissions')
        .update({ can_view, can_edit })
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)
        .select()
        .maybeSingle()

      if (error) {
        console.log('Permission update error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to update permission' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ permission }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    // DELETE /permissions/:userId/:menuItemId - удалить конкретный доступ
    if (req.method === 'DELETE' && menuItemId) {
      const { error } = await supabaseClient
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)

      if (error) {
        console.log('Permission deletion error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to delete permission' }),
          { 
            status: 500, 
            headers: { ...corsHeaders }
          }
        )
      }

      return new Response(
        JSON.stringify({ message: 'Permission deleted successfully' }),
        { 
          headers: { ...corsHeaders }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
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