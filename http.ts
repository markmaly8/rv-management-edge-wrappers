// supabase/functions/_wrappers/http.ts

// Standard CORS headers for browser access to edge functions.
// Keep permissive for now; you can narrow origins per-tenant later.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

// Handle OPTIONS preflight. Return a Response to short-circuit, or null to continue.
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// Canonical JSON response with CORS & content-type.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Convenience helpers for consistent shapes across functions.
export function ok<T>(data: T, status = 200): Response {
  return json({ ok: true, ...((data as any) ?? {}) }, status);
}
export function badRequest(code: string, details?: unknown): Response {
  return json({ ok: false, error: code, details }, 400);
}
export function unauthorized(code = "unauthorized"): Response {
  return json({ ok: false, error: code }, 401);
}
export function internal(code = "internal_error", details?: unknown): Response {
  return json({ ok: false, error: code, details }, 500);
}
