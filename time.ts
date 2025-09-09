/**
 * time.ts — Small, reusable time helpers for Edge Functions.
 *
 * isExpiredWithBuffer(iso, bufferSeconds)
 *   - Returns true if `iso` time is in the past, allowing a small buffer (default 5s)
 *     to avoid off-by-a-few-seconds issues between systems.
 *
 * Safe to use anywhere. No external dependencies.
 */
export function isExpiredWithBuffer(isoString: string, bufferSeconds = 5): boolean {
  const t = new Date(isoString).getTime();
  if (!Number.isFinite(t)) return false; // bad or missing date -> treat as not expired
  const now = Date.now() - bufferSeconds * 1000;
  return t <= now;
}
