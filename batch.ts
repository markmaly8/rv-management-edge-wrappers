/**
 * batch.ts — Run async work over a list with limited parallelism.
 *
 * Why:
 *   - Prevents hammering external APIs (Podio, Stripe) or your DB.
 *   - Keeps memory/cpu under control when a list is large.
 *
 * Usage:
 *   await processInBatches(items, async (item) => { ... }, 5);
 *   // 5 workers max; each calls your handler(item). Errors are logged and skipped.
 */

export async function processInBatches<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  concurrency = 5
) {
  const queue = [...items];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(worker(queue, handler));
  }
  await Promise.all(workers);
}

async function worker<T>(queue: T[], handler: (item: T) => Promise<void>) {
  while (true) {
    const item = queue.shift();
    if (!item) break;
    try {
      await handler(item);
    } catch (err) {
      console.warn("[batch] handler error:", err);
    }
    // tiny jitter to avoid thundering herd on the same upstream
    await sleep(Math.floor(Math.random() * 50));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
