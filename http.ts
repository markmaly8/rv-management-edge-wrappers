// fetchWithTimeout with a single retry on 429/5xx

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; retry?: boolean } = {},
): Promise<Response> {
  const { timeoutMs = 10000, retry = true, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    if (retry && (res.status === 429 || (res.status >= 500 && res.status <= 599))) {
      await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));
      return await fetch(url, { ...rest, signal: controller.signal });
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}
