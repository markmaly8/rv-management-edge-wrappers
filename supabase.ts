// Service-role Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const serviceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
// Ensure this import exists at the top of the file (only once)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Compatibility export used by Edge Functions ---
export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  // No session persistence in Edge
  return createClient(url, key, { auth: { persistSession: false } });
}

// Back-compat alias (some code may import this name)
export const serviceClient = createServiceClient;
