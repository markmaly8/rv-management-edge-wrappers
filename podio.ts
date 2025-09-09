// Podio helpers: token/meta micro-cache + field/date utils
import { fetchWithTimeout } from "./http.ts";

type TokenCache = { access_token: string; expires_at: number } | null;
let tokenCache: TokenCache = null;

let metaCache: { appId: string; fetchedAt: number; meta: any } | null = null;

export async function getPodioToken(envs: {
  clientId: string;
  clientSecret: string;
  appId: string;
  appToken: string;
}): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expires_at > now + 5000) {
    return tokenCache.access_token;
  }
  const r = await fetchWithTimeout("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "app",
      client_id: envs.clientId,
      client_secret: envs.clientSecret,
      app_id: envs.appId,
      app_token: envs.appToken,
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`podio_auth_failed: ${txt}`);
  const t = JSON.parse(txt);
  tokenCache = {
    access_token: t.access_token,
    expires_at: now + ((t.expires_in ?? 3600) * 1000),
  };
  return tokenCache.access_token;
}

export async function getPodioAppMeta(appId: string, token: string): Promise<any> {
  const STALE_MS = 5 * 60 * 1000;
  if (metaCache && metaCache.appId === appId && Date.now() - metaCache.fetchedAt < STALE_MS) {
    return metaCache.meta;
  }
  const res = await fetchWithTimeout(`https://api.podio.com/app/${appId}`, {
    headers: { Authorization: `OAuth2 ${token}` },
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`podio_meta_failed: ${txt}`);
  const meta = JSON.parse(txt);
  metaCache = { appId, fetchedAt: Date.now(), meta };
  return meta;
}

export function resolveStatusOptionId(meta: any, text: string): number | null {
  const STATUS_FIELD_FALLBACK_ID = 272287010; // legacy fallback
  const statusField = (meta?.fields || []).find(
    (f: any) => f.external_id === "status" || f.field_id === STATUS_FIELD_FALLBACK_ID,
  );
  const options = statusField?.config?.settings?.options || statusField?.config?.options || [];
  const opt = options?.find(
    (o: any) => (o.text || o.value || "").toLowerCase() === text.toLowerCase(),
  );
  return opt?.id ?? null;
}

// ----- Date helpers -----
export function toYMD(input: string | number | Date) {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function toHMSLocal(input: Date) {
  const hh = String(input.getHours()).padStart(2, "0");
  const mm = String(input.getMinutes()).padStart(2, "0");
  const ss = String(input.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function findField(metaFields: any[], key: number | string) {
  return (metaFields || []).find((f) => f.external_id === key || f.field_id === key);
}
export function buildDateValue(
  metaFields: any[],
  externalId: number | string,
  value: string | Date,
  role: "start" | "end" | "expiry" = "start",
) {
  const fld = findField(metaFields, externalId);
  const timeEnabled = !!(fld?.config?.settings?.time ?? fld?.config?.time);
  const d = typeof value === "string" ? new Date(value) : value;
  const datePart = toYMD(d);
  if (timeEnabled) {
    let hms: string;
    if (role === "start") hms = "00:00:00";
    else if (role === "end") hms = "23:59:59";
    else hms = toHMSLocal(d);
    return { start: `${datePart} ${hms}` };
  }
  return { start: datePart };
}
