import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { LuluShippingLevel } from "@/lib/lulu-order";

/**
 * The exact shipping quote a customer was shown, sealed so it can be trusted when the order is created.
 *
 * When the checkout asks for shipping prices, each price comes back with a token: a small signed note saying
 * "for THESE books, THIS address and THIS method, Lulu quoted THIS amount at THIS time". When the order is placed
 * the server accepts a valid, unexpired token and charges that exact amount (and saves the quote on the order),
 * so what the customer saw is what is charged. A token is useless for any other books, address or method, cannot
 * be edited (it is signed with the server-only AUTH_SECRET) and stops working after 30 minutes.
 */

export const QUOTE_TOKEN_MINUTES = 30;

export interface SealedQuote {
  level: LuluShippingLevel;
  amount: number;
  minDays?: number;
  maxDays?: number;
  /** Fingerprint of the books, copies, country and address the quote is for. */
  fp: string;
  /** Quote time, unix seconds. */
  at: number;
  /** Expiry, unix seconds. */
  exp: number;
}

function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.SETTINGS_ENCRYPTION_KEY || null;
}

/** A short fingerprint of exactly what was priced: the printed copies, the country and the full address. */
export function quoteFingerprint(opts: { items: { bookId: string; qty: number; format: string }[]; countryIso: string; address: string | null | undefined }): string {
  const items = opts.items.map((i) => [i.bookId, i.qty, i.format]).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])));
  const norm = JSON.stringify([items, opts.countryIso.toUpperCase(), (opts.address ?? "").replace(/\s+/g, " ").trim().toLowerCase()]);
  return createHash("sha256").update(norm).digest("base64url").slice(0, 22);
}

function mac(body: string, key: string): string {
  return createHmac("sha256", key).update(`shipping-quote:v1:${body}`).digest("base64url");
}

export function sealQuote(q: Omit<SealedQuote, "at" | "exp">, nowMs: number = Date.now()): string {
  const key = secret();
  if (!key) return "";
  const full: SealedQuote = { ...q, at: Math.floor(nowMs / 1000), exp: Math.floor(nowMs / 1000) + QUOTE_TOKEN_MINUTES * 60 };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

/** The quote inside a token, when it is genuine, unexpired, for this method and for exactly these books and address. */
export function openQuote(token: string | null | undefined, expect: { level: string; fp: string }, nowMs: number = Date.now()): SealedQuote | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = mac(body, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const q = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SealedQuote;
    if (typeof q.amount !== "number" || !(q.amount >= 0) || typeof q.exp !== "number" || q.exp * 1000 < nowMs) return null;
    if (q.level !== expect.level || q.fp !== expect.fp) return null;
    return q;
  } catch {
    return null;
  }
}
