// mod.ts — Single public entrypoint for all wrappers
// Pin this file by tag from your Edge Functions, e.g.:
//   import * as W from "https://raw.githubusercontent.com/markmaly8/rv-management-edge-wrappers/v1.0.1/mod.ts";
//
// Only export the stable, intended surface area. If you add new helpers,
// export them here explicitly so downstream Edge Functions always find the
// named symbols even as the internal files evolve.

export { preflight, json, CORS } from "./cors.ts";

export { fetchWithTimeout } from "./http.ts";

export { createServiceClient } from "./supabase.ts";

export { createStepLogger, mask } from "./log.ts";

export {
  getPodioToken,
  getPodioAppMeta,
  resolveStatusOptionId,
  buildDateValue,
  toYMD,
} from "./podio.ts";

export { isExpiredWithBuffer } from "./time.ts";

export { processInBatches } from "./batch.ts";

export { requireEnvKeys } from "./env.ts";

export { getIdemp, setIdemp } from "./idempotency.ts";

export { verifyAvailabilityServerSide } from "./availability.ts";

// Sentry: make sure sentry.ts defines these names
export { initSentry, captureError, addCrumb, tagRequest } from "./sentry.ts";

// Optional: update this string to match the release tag you cut.
export const WRAPPERS_API_VERSION = "v1.0.1";

