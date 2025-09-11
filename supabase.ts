// supabase.ts — service-role client (singleton) for Edge Functions
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;

/**
 * createServiceClient
 * Returns a singleton Supabase client initialized with
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env.
 * Throws a clear error if either env var is missing.
 */
export function createServiceClient(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("missing_supabase_env: require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * serviceClient
 * Alias for createServiceClient to match older imports.
 */
export const serviceClient = createServiceClient;

