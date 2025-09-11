// log.ts — tiny logger + masking

/**
 * Masks sensitive values for logs (keeps last 4 chars).
 */
export function mask(value?: string | null): string {
  if (!value || value.length < 4) return "***";
  return `***${value.slice(-4)}`;
}

/**
 * createStepLogger
 * Returns a logger function that prefixes messages with a component tag
 * and optional request_id so logs are easy to trace.
 *
 * Example:
 *   const log = createStepLogger("PODIO-RESERVATION-HOLD", requestId);
 *   log("Creating hold", { site_id, campground_id });
 */
export function createStepLogger(prefix: string, requestId?: string) {
  const tag = requestId ? `[${prefix}] [${requestId}]` : `[${prefix}]`;
  return (step: string, details?: unknown) => {
    const detailsStr = details === undefined ? "" : ` ${JSON.stringify(details)}`;
    console.log(`${tag} ${step}${detailsStr}`);
  };
}
