// Simple per-isolate idempotency cache (best-effort)
type CachedResult = { reservation_id: number; hold_expiration: string; created_at: number };
const CACHE = new Map<string, CachedResult>();
const TTL_MS = 5 * 60 * 1000;

export function getIdemp(key?: string): CachedResult | null {
  if (!key) return null;
  const v = CACHE.get(key);
  if (!v) return null;
  if (Date.now() - v.created_at > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return v;
}

export function setIdemp(key: string, value: CachedResult) {
  CACHE.set(key, value);
}
