/**
 * fetch with a time limit and (for safe calls only) a few retries.
 *
 * Use it for READS and for calls that are safe to repeat (looking up a payment, getting a sign-in token, checking a signature).
 * Do NOT use the retry for calls that create something (a payment, a print job): repeating those after a timeout could create
 * a second one. Those keep a single try and are repeated, safely, by the scheduled order-retry job instead.
 */
export interface TimedFetchOptions { timeoutMs?: number; retries?: number; backoffMs?: number }

export const shouldRetryStatus = (status: number): boolean => status === 408 || status === 425 || status === 429 || status >= 500;
export const backoffDelay = (attempt: number, baseMs: number, rand: () => number = Math.random): number => Math.round(baseMs * 2 ** attempt * (0.75 + rand() * 0.5));

export async function timedFetch(url: string | URL, init: RequestInit = {}, opts: TimedFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, retries = 2, backoffMs = 300 } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
      if (!shouldRetryStatus(res.status) || attempt === retries) return res;
    } catch (e) {
      lastError = e;
      if (attempt === retries) throw e;
    }
    await new Promise((r) => setTimeout(r, backoffDelay(attempt, backoffMs)));
  }
  throw lastError ?? new Error("Request failed.");
}
