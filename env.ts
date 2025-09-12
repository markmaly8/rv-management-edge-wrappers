// supabase/functions/_wrappers/env.ts

// Returns list of missing env var keys. Empty array means all present.
export function requireEnvKeys(keys: string[]): string[] {
  const missing: string[] = [];
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (!v || v.length === 0) missing.push(k);
  }
  return missing;
}

// Simple getter that throws if env missing (nice for critical secrets).
export function mustGetEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}
