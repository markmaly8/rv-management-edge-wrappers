// Minimal env checker
export function requireEnvKeys(keys: string[]): string[] {
  const missing: string[] = [];
  for (const k of keys) {
    const v = Deno.env.get(k)?.trim();
    if (!v) missing.push(k);
  }
  return missing;
}
