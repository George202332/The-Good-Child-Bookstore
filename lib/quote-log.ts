/**
 * Pure rules for the shipping-price (quote) log: what counts as slow, how events are counted, which delivery field a Lulu complaint
 * is about, and what the customer is told while waiting. No database, no network, no secrets, so it is all tested.
 */

/** A price answer slower than this is "slow" (the customer is told it is taking longer than usual). */
export const SLOW_QUOTE_MS = 6000;
/** The whole price request is given up after this long on the server, so the customer is never left waiting for a minute. */
export const QUOTE_BUDGET_MS = 18000;

export type QuoteOutcome = "ok" | "slow" | "failed";

export interface QuoteEvent {
  at: string;
  outcome: QuoteOutcome;
  /** Failure kind (auth, address, rejected, unavailable, unreadable, pages, not-configured, timeout, error) when failed. */
  kind?: string;
  ms: number;
  /** Country code only (never a name, street, phone or email). */
  country: string;
  bookId?: string;
}

export function classifyDuration(ok: boolean, ms: number): QuoteOutcome {
  if (!ok) return "failed";
  return ms >= SLOW_QUOTE_MS ? "slow" : "ok";
}

export interface QuoteCounts { ok: number; slow: number; failed: number }
export interface QuoteSummary { today: QuoteCounts; last7d: QuoteCounts; byKind: Record<string, number> }

/** Counts per UTC day (the log keeps one small counter per day) and the failure kinds seen in the last 7 days. */
export function summarizeQuoteDays(days: Record<string, QuoteCounts>, events: QuoteEvent[], nowIso: string): QuoteSummary {
  const now = Date.parse(nowIso);
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const since = now - 7 * 86400_000;
  const last7d: QuoteCounts = { ok: 0, slow: 0, failed: 0 };
  for (const [day, c] of Object.entries(days)) {
    if (Date.parse(`${day}T23:59:59Z`) >= since) { last7d.ok += c.ok; last7d.slow += c.slow; last7d.failed += c.failed; }
  }
  const byKind: Record<string, number> = {};
  for (const e of events) {
    if (e.outcome === "failed" && Date.parse(e.at) >= since) byKind[e.kind ?? "error"] = (byKind[e.kind ?? "error"] ?? 0) + 1;
  }
  return { today: { ...(days[todayKey] ?? { ok: 0, slow: 0, failed: 0 }) }, last7d, byKind };
}

/** Which delivery field a Lulu "address" complaint is about, so the message can be shown beside that field. */
export function fieldForAddressDetail(detail: string | undefined): "postcode" | "phone" | "state" | "city" | "address" | "country" | null {
  const d = (detail ?? "").toLowerCase();
  if (/post(al)?\s*code|postcode|zip/.test(d)) return "postcode";
  if (/phone/.test(d)) return "phone";
  if (/state|province|region/.test(d)) return "state";
  if (/city|town/.test(d)) return "city";
  if (/street|address line|line1|street1/.test(d)) return "address";
  if (/country/.test(d)) return "country";
  return null;
}

export type QuotePhase = "idle" | "loading" | "slow" | "ok" | "failed";

/** What the checkout shows for the shipping price, from what is happening right now. */
export function quotePhase(opts: { busy: boolean; elapsedMs: number; stateOk: boolean; hasProblem: boolean }): QuotePhase {
  if (opts.busy) return opts.elapsedMs >= 5000 ? "slow" : "loading";
  if (opts.hasProblem) return "failed";
  return opts.stateOk ? "ok" : "idle";
}

export const QUOTE_MESSAGES = {
  loading: "Getting your shipping price…",
  slow: "This is taking longer than usual, please wait. Your details are safe and nothing has been charged.",
  retrying: "That did not work the first time, trying once more…",
} as const;

export interface FieldBlocker { fieldId: string; message: string }

/** The fields that stop the customer moving on, each with a plain-words reason (shown right beside the field). */
export function deliveryBlockers(d: { fullName: string; email: string; country: string; phone: string; address: string; city: string; state: string; postcode: string }, printing: boolean): FieldBlocker[] {
  const out: FieldBlocker[] = [];
  const need = (id: string, value: string, message: string) => { if (!value.trim()) out.push({ fieldId: id, message }); };
  need("co-name", d.fullName, "Enter your full name.");
  if (!d.email.trim()) out.push({ fieldId: "co-email", message: "Enter your email address." });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) out.push({ fieldId: "co-email", message: "This email address does not look right (for example name@example.com)." });
  need("co-country", d.country, "Choose your country.");
  need("co-address", d.address, printing ? "Enter your street address." : "Enter your billing address.");
  if (printing) {
    const digits = d.phone.replace(/\D/g, "");
    if (!d.phone.trim()) out.push({ fieldId: "co-phone", message: "Enter a phone number so the courier can reach you." });
    else if (digits.length < 7 || digits.length > 15) out.push({ fieldId: "co-phone", message: "This phone number looks incomplete. Enter the digits only, 7 to 15 of them, without the country code." });
    need("co-city", d.city, "Enter your city or town.");
    if (["United States", "Canada", "Australia", "Mexico"].includes(d.country)) need("co-state", d.state, "Enter your state, province or region.");
    need("co-postcode", d.postcode, "Enter your postal or ZIP code.");
    if (d.country === "United States" && d.postcode.trim() && !/^\d{5}(-\d{4})?$/.test(d.postcode.trim())) out.push({ fieldId: "co-postcode", message: "A US ZIP code is 5 digits (for example 10001)." });
  }
  return out;
}
