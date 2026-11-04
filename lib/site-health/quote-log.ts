import { prisma } from "@/lib/prisma";
import { summarizeQuoteDays, type QuoteCounts, type QuoteEvent, type QuoteSummary } from "@/lib/quote-log";

/**
 * Remembers how the checkout's shipping-price requests are going, in two Setting rows (no new table):
 *   lulu_quote_log   : { days: {YYYY-MM-DD: {ok, slow, failed}}, events: [recent slow / failed requests] }
 *   lulu_book_flags  : { [bookId]: { kind, message, at } }   books whose print details stopped a price being asked
 * Holds only a country code, a book id, a failure kind and a duration: no name, address, phone, email or key.
 * Never throws (a log must not break checkout).
 */
const LOG_KEY = "lulu_quote_log";
const FLAG_KEY = "lulu_book_flags";
const MAX_EVENTS = 100;
const MAX_DAYS = 30;

interface Log { days: Record<string, QuoteCounts>; events: QuoteEvent[] }

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return (row?.value as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}
async function writeJson(key: string, value: unknown): Promise<void> {
  const v = JSON.parse(JSON.stringify(value));
  await prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } }).catch(() => undefined);
}

export async function recordQuote(event: QuoteEvent): Promise<void> {
  const log = await readJson<Log>(LOG_KEY, { days: {}, events: [] });
  const day = event.at.slice(0, 10);
  const c = log.days[day] ?? { ok: 0, slow: 0, failed: 0 };
  // A slow answer is also a good answer; it is counted as "slow" only.
  c[event.outcome] += 1;
  log.days[day] = c;
  const keep = Object.keys(log.days).sort().slice(-MAX_DAYS);
  log.days = Object.fromEntries(keep.map((k) => [k, log.days[k]]));
  if (event.outcome !== "ok") log.events = [event, ...(log.events ?? [])].slice(0, MAX_EVENTS);
  await writeJson(LOG_KEY, log);
}

export async function readQuoteStats(): Promise<{ summary: QuoteSummary; recent: QuoteEvent[] }> {
  const log = await readJson<Log>(LOG_KEY, { days: {}, events: [] });
  return { summary: summarizeQuoteDays(log.days ?? {}, log.events ?? [], new Date().toISOString()), recent: (log.events ?? []).slice(0, 10) };
}

export interface BookFlag { kind: string; message: string; at: string }

export async function flagBook(bookId: string, flag: BookFlag): Promise<void> {
  const flags = await readJson<Record<string, BookFlag>>(FLAG_KEY, {});
  flags[bookId] = flag;
  await writeJson(FLAG_KEY, flags);
}
export async function clearBookFlag(bookId: string): Promise<void> {
  const flags = await readJson<Record<string, BookFlag>>(FLAG_KEY, {});
  if (!flags[bookId]) return;
  delete flags[bookId];
  await writeJson(FLAG_KEY, flags);
}
export async function readBookFlags(): Promise<Record<string, BookFlag>> {
  return readJson<Record<string, BookFlag>>(FLAG_KEY, {});
}
