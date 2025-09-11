// sentry.ts — minimal Sentry helpers for Supabase Edge (Deno)
// - Safe no-op when SENTRY_DSN isn't set
// - If DSN is set, posts a minimal event to Sentry Store API
// - Exports: initSentry, addCrumb, tagRequest, captureError, flush

import { fetchWithTimeout } from "./http.ts";

type Breadcrumb = { category?: string; level?: "info" | "warning" | "error"; message: string; data?: unknown; timestamp?: string };
type Tags = Record<string, string | number | boolean>;
type Extra = Record<string, unknown>;

const state = {
  dsn: "",
  projectId: "",
  publicKey: "",
  endpoint: "",
  initialized: false,
  // keep a small rolling buffer per runtime instance
  breadcrumbs: [] as Breadcrumb[],
};

function parseDSN(dsn: string) {
  // Format: https://<PUBLIC_KEY>@<HOST>/<PROJECT_ID>
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const host = u.host; // includes domain and port if any
    const projectId = u.pathname.replace(/^\/+/, "");
    const endpoint = `${u.protocol}//${host}/api/${projectId}/store/`;
    if (!publicKey || !projectId) throw new Error("invalid_dsn");
    return { publicKey, projectId, endpoint };
  } catch {
    throw new Error("invalid_sentry_dsn");
  }
}

/** Initialize Sentry once per runtime. Safe to call multiple times. */
export function initSentry(): void {
  if (state.initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN") ?? "";
  if (!dsn) {
    state.initialized = true;
    return; // no-op mode
  }
  const { publicKey, projectId, endpoint } = parseDSN(dsn);
  state.dsn = dsn;
  state.publicKey = publicKey;
  state.projectId = projectId;
  state.endpoint = endpoint;
  state.initialized = true;
}

/** Add a breadcrumb to help trace what happened before an error. */
export function addCrumb(categoryOrMessage: string, data?: unknown, level: Breadcrumb["level"] = "info"): void {
  const crumb: Breadcrumb = {
    category: typeof categoryOrMessage === "string" ? categoryOrMessage : "log",
    level,
    message: typeof categoryOrMessage === "string" ? categoryOrMessage : JSON.stringify(categoryOrMessage),
    data,
    timestamp: new Date().toISOString(),
  };
  // keep last 50 crumbs
  state.breadcrumbs.push(crumb);
  if (state.breadcrumbs.length > 50) state.breadcrumbs.shift();
  // Always console for local diagnosis
  // deno-lint-ignore no-console
  console.debug("[SENTRY crumb]", crumb.category, crumb.message, crumb.data ?? "");
}

/** Convenience: tag the request (function name + request_id + basic req info). */
export function tagRequest(fnName: string, requestId: string, req: Request): void {
  addCrumb("request", { fn: fnName, request_id: requestId, url: req.url, method: req.method });
}

/** Send an error to Sentry (or console if DSN is not set). */
export async function captureError(error: unknown, tags: Tags = {}, extra: Extra = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  // Always log to console for visibility
  // deno-lint-ignore no-console
  console.error("[SENTRY error]", err.message, { tags, extra });

  if (!state.initialized) initSentry();
  if (!state.dsn) return; // no-op when DSN missing

  // Minimal Sentry Store API payload
  const payload = {
    level: "error",
    message: err.message,
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message,
          stacktrace: err.stack ? { frames: (err.stack || "").split("\n").map((l) => ({ function: l.trim() })).slice(0, 100) } : undefined,
        },
      ],
    },
    tags,
    extra,
    breadcrumbs: state.breadcrumbs,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    sdk: { name: "rv-management-edge-wrappers", version: "1.0.2" },
    environment: Deno.env.get("SENTRY_ENV") || Deno.env.get("ENVIRONMENT") || "production",
    release: Deno.env.get("SENTRY_RELEASE") || "rv-management@unknown",
  };

  const authHeader =
    `Sentry sentry_version=7, sentry_client=rv-management-edge-wrappers/1.0.2, sentry_key=${state.publicKey}`;

  try {
    await fetchWithTimeout(state.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": authHeader,
      },
      body: JSON.stringify(payload),
      timeoutMs: 5000,
    });
  } catch (postErr) {
    // deno-lint-ignore no-console
    console.warn("[SENTRY warn] Failed to post to Sentry Store API", (postErr as Error)?.message ?? postErr);
  }
}

/** Small wait to allow async transport to flush (best-effort). */
export async function flush(ms = 500): Promise<void> {
  await new Promise((r) => setTimeout(r, Math.max(0, Math.min(ms, 2000))));
}

