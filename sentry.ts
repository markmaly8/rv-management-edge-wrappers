// Shared Sentry init + export (safe if DSN missing)
import * as SentryNs from "npm:@sentry/deno@8";

export const Sentry = SentryNs;

export function initSentry() {
  Sentry.init({
    dsn: Deno.env.get("SENTRY_DSN") || undefined,
    environment: Deno.env.get("SENTRY_ENV") || "production",
    release: Deno.env.get("SENTRY_RELEASE") || undefined,
    tracesSampleRate: 0.0,
  });
}
