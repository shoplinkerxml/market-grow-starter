// This file configures Supabase client.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';


// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
// }

// export const SUPABASE_URL = supabaseUrl;
// export const SUPABASE_PUBLISHABLE_KEY = supabaseKey;



export const SUPABASE_URL = "https://ehznqzaumsnjkrntaiox.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoem5xemF1bXNuamtybnRhaW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTM2MjMsImV4cCI6MjA3MjI4OTYyM30.cwynTMjqTpDbXRlyMsbp6lfLLAOqE00X-ybeLU0pzE0";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Enhanced session recovery
    storageKey: 'supabase.auth.token'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
      // Do not include Authorization or apikey here to avoid conflicts with Edge Functions
    }
  },
  // Enhanced error handling for RLS debugging
  db: {
    schema: 'public'
  }
});
