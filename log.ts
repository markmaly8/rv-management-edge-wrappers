// Simple structured logging + secret masking

export function logStep(requestId: string, step: string, details?: unknown) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PODIO-RESERVATION-HOLD] [${requestId}] ${step}${detailsStr}`);
}

export function mask(value?: string | null) {
  if (!value || value.length < 4) return "***";
  return `***${value.slice(-4)}`;
}
