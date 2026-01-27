import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from './config';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client instance (singleton)
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const config = getConfig();
    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Reset the Supabase client (for testing)
 */
export function resetSupabase(): void {
  supabaseClient = null;
}
