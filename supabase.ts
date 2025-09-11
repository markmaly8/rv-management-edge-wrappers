// supabase.ts — service-role Supabase client for Edge Functions
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ServiceClient = SupabaseClient;

/**
 * createServiceClient
 * Returns a Supabase service-role client using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Throws a clear error if either env var is missing.
 */
export function createServiceClient(): ServiceClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("missing_supabase_env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: { "X-Client-Info": "rv-management-edge-wrappers/v1.0.2" },
    },
  });
}

/**
 * serviceClient (compat alias)
 * Kept for older functions that call serviceClient() directly.
 */
export const serviceClient = createServiceClient;
