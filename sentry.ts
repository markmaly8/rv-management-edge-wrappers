// sentry.ts — backward-compatible Sentry wrapper for Supabase Edge (Deno)
// - Keeps existing exports: initSentry, addCrumb, tagRequest, captureError, flush
// - If SENTRY_DSN is set, uses official @sentry/deno SDK
// - If SDK unavailable or DSN parsing fails, falls back to minimal Store API POST
// - Preserves breadcrumb buffer behavior and adds crumbs to SDK scope when active

import * as Sentry from "https://esm.sh/@sentry/deno@7.120.0";
import { fetchWithTimeout } from "./http.ts";

type Breadcrumb = {
  category?: string;
  level?: "info" | "warning" | "error";
  message: string;
  data?: unknown;
  timestamp?: string;
};
type Tags = Record<string, string | number | boolean>;
type Extra = Record<string, unknown>;

const state = {
  dsn: "",
  projectId: "",
  publicKey: "",
  endpoint: "",
  initialized: false,
  sdkActive: false, // true when SDK init succeeded
  breadcrumbs: [] as Breadcrumb[], // keep last 50
} as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const mstate = { ...(state as unknown as Mutable<typeof state>) };

function parseDSN(dsn: string) {
  // Format: https://<PUBLIC_KEY>@<HOST>/<PROJECT_ID>
  const u = new URL(dsn);
  const publicKey = u.username;
  const host = u.host;
  const projectId = u.pathname.replace(/^\/+/, "");
  const endpoint = `${u.protocol}//${host}/api/${projectId}/store/`;
  if (!publicKey || !projectId) throw new Error("invalid_sentry_dsn");
  return { publicKey, projectId, endpoint };
}

/** Initialize Sentry once per runtime. Safe to call multiple times. */
export function initSentry(): void {
  if (mstate.initialized) return;

  const dsn = Deno.env.get("SENTRY_DSN") ?? "";
  if (!dsn) {
    // no-op mode
    mstate.initialized = true;
    mstate.sdkActive = false;
    return;
  }

  try {
    // Initialize official SDK
    Sentry.init({
      dsn,
      release: Deno.env.get("SENTRY_RELEASE") ?? "rv-management@unknown",
      environment: Deno.env.get("SENTRY_ENV") || Deno.env.get("ENVIRONMENT") || "production",
      tracesSampleRate: 0.0, // perf traces off by default
    });
    mstate.sdkActive = true;
  } catch (_e) {
    // If SDK init fails, we will fallback to Store API posting below
    mstate.sdkActive = false;
  }

  // Parse DSN for Store API fallback path
  try {
    const { publicKey, projectId, endpoint } = parseDSN(dsn);
    mstate.dsn = dsn;
    mstate.publicKey = publicKey;
    mstate.projectId = projectId;
    mstate.endpoint = endpoint;
  } catch (_e) {
    // If DSN is malformed, we still consider initialized but only console-log
    mstate.dsn = "";
    mstate.publicKey = "";
    mstate.projectId = "";
    mstate.endpoint = "";
  }

  mstate.initialized = true;
}

/** Add a breadcrumb to help trace what happened before an error. */
export function addCrumb(
  categoryOrMessage: string,
  data?: unknown,
  level: Breadcrumb["level"] = "info",
): void {
  const crumb: Breadcrumb = {
    category: typeof categoryOrMessage === "string" ? categoryOrMessage : "log",
    level,
    message: typeof categoryOrMessage === "string"
      ? categoryOrMessage
      : JSON.stringify(categoryOrMessage),
    data,
    timestamp: new Date().toISOString(),
  };

  mstate.breadcrumbs.push(crumb);
  if (mstate.breadcrumbs.length > 50) mstate.breadcrumbs.shift();

  // Mirror into SDK breadcrumb pipeline if active
  if (mstate.sdkActive) {
    Sentry.addBreadcrumb({
      category: crumb.category,
      level: crumb.level as any,
      message: crumb.message,
      data: crumb.data as any,
      timestamp: crumb.timestamp ? new Date(crumb.timestamp).getTime() / 1000 : undefined,
    });
  }

  // Always console for local diagnosis
  // deno-lint-ignore no-console
  console.debug("[SENTRY crumb]", crumb.category, crumb.message, crumb.data ?? "");
}

/** Convenience: tag the request (function name + request_id + basic req info). */
export function tagRequest(fnName: string, requestId: string, req: Request): void {
  addCrumb("request", { fn: fnName, request_id: requestId, url: req.url, method: req.method });
  if (mstate.sdkActive) {
    Sentry.configureScope((scope) => {
      scope.setTag("function", fnName);
      scope.setTag("request_id", requestId);
      // Avoid PII; we do not set full URL as a tag, crumb already holds it
    });
  }
}

/** Send an error to Sentry (or console/Store API if SDK not available). */
export async function captureError(
  error: unknown,
  tags: Tags = {},
  extra: Extra = {},
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log to console for visibility
  // deno-lint-ignore no-console
  console.error("[SENTRY error]", err.message, { tags, extra });

  if (!mstate.initialized) initSentry();

  // Preferred path: official SDK
  if (mstate.sdkActive) {
    try {
      Sentry.withScope((scope) => {
        Object.entries(tags).forEach(([k, v]) => scope.setTag(k, String(v)));
        scope.setExtras(extra);
        // Breadcrumbs already added via addCrumb, SDK collects them internally
        Sentry.captureException(err);
      });
      return;
    } catch (_e) {
      // If SDK capture fails, fallthrough to Store API as a backup
    }
  }

  // Fallback path: minimal Store API POST (same behavior as previous version)
  if (!mstate.dsn || !mstate.endpoint || !mstate.publicKey) return;

  const payload = {
    level: "error",
    message: err.message,
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: (err.stack || "")
                  .split("\n")
                  .map((l) => ({ function: l.trim() }))
                  .slice(0, 100),
              }
            : undefined,
        },
      ],
    },
    tags,
    extra,
    breadcrumbs: mstate.breadcrumbs,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    sdk: { name: "rv-management-edge-wrappers", version: "1.0.3" },
    environment:
      Deno.env.get("SENTRY_ENV") || Deno.env.get("ENVIRONMENT") || "production",
    release: Deno.env.get("SENTRY_RELEASE") || "rv-management@unknown",
  };

  const authHeader =
    `Sentry sentry_version=7, sentry_client=rv-management-edge-wrappers/1.0.3, sentry_key=${mstate.publicKey}`;

  try {
    await fetchWithTimeout(mstate.endpoint, {
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
    console.warn(
      "[SENTRY warn] Failed to post to Sentry Store API",
      (postErr as Error)?.message ?? postErr,
    );
  }
}

/** Small wait to allow async transport to flush (best-effort). */
export async function flush(ms = 500): Promise<void> {
  if (!mstate.initialized) return;
  if (mstate.sdkActive) {
    try {
      // Sentry.flush resolves when queued events are sent or timeout elapses
      await Sentry.flush(Math.max(0, Math.min(ms, 5000)));
      return;
    } catch {
      // fall through to sleep as best-effort
    }
  }
  // Best-effort sleep (for fallback transport)
  await new Promise((r) => setTimeout(r, Math.max(0, Math.min(ms, 2000))));
}

