/**
 * Customer-paid shipping for printed books.
 *
 * Postage is paid by the customer, on top of the book prices: the checkout
 * quotes it (live from Lulu when possible), the order total includes it, and
 * it never enters the author/affiliate/company revenue split (that is worked
 * out from the book prices only). The rules that need no network live here
 * so they can be tested.
 */

import type { LuluShippingLevel } from "@/lib/lulu-order";

export interface ShippingQuote {
  level: LuluShippingLevel;
  /** What the customer pays for this method, in US dollars. */
  amount: number;
  /** "lulu" = a live quote from Lulu for exactly this order; "estimate" =
   * the store's built-in rate table, used only when Lulu's quote is not
   * available. */
  source: "lulu" | "estimate";
  minDays?: number;
  maxDays?: number;
}

const LEVELS: readonly string[] = ["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"];

function toAmount(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.\-]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function daysFrom(v: unknown, now: Date): number | undefined {
  if (typeof v !== "string") return undefined;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return undefined;
  return Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000));
}

/** Reads Lulu's shipping-options reply (a list of options, each with a
 * `level` and a cost) into quotes. Tolerant of the list being wrapped in
 * `results`, and of the cost field being named with or without tax.
 * Options it cannot read are skipped. */
export function parseLuluShippingOptions(json: unknown, now: Date = new Date()): ShippingQuote[] {
  const list: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { results?: unknown }).results)
    ? ((json as { results: unknown[] }).results)
    : [];
  const out: ShippingQuote[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const level = String(o.level ?? o.shipping_level ?? "").toUpperCase();
    if (!LEVELS.includes(level)) continue;
    const amount = toAmount(o.total_cost_incl_tax) ?? toAmount(o.total_cost_excl_tax) ?? toAmount(o.cost_incl_tax) ?? toAmount(o.cost_excl_tax) ?? toAmount(o.cost);
    if (amount === null) continue;
    out.push({
      level: level as LuluShippingLevel,
      amount,
      source: "lulu",
      minDays: daysFrom(o.min_delivery_date, now),
      maxDays: daysFrom(o.max_delivery_date, now),
    });
  }
  return out;
}

/** The store's own rate table: first copy + each extra copy. Used ONLY when
 * Lulu's live quote cannot be had, so checkout never stops working. */
const ESTIMATE: Record<LuluShippingLevel, { domestic: number; international: number }> = {
  MAIL: { domestic: 4.99, international: 9.99 },
  PRIORITY_MAIL: { domestic: 9.99, international: 16.99 },
  GROUND: { domestic: 7.99, international: 7.99 },
  EXPEDITED: { domestic: 14.99, international: 24.99 },
  EXPRESS: { domestic: 24.99, international: 39.99 },
};
const EXTRA_COPY = 1.5;

export function estimateShipping(level: LuluShippingLevel, countryIso: string, copies: number): ShippingQuote {
  const rate = ESTIMATE[level] ?? ESTIMATE.MAIL;
  const base = countryIso.toUpperCase() === "US" ? rate.domestic : rate.international;
  const extra = Math.max(0, Math.floor(copies) - 1) * EXTRA_COPY;
  return { level, amount: Math.round((base + extra) * 100) / 100, source: "estimate" };
}

/** Picks the quote for the chosen method out of Lulu's quotes, falling back
 * to the estimate for that method. */
export function pickShippingQuote(
  level: LuluShippingLevel,
  luluQuotes: ShippingQuote[],
  countryIso: string,
  copies: number,
): ShippingQuote {
  return luluQuotes.find((q) => q.level === level) ?? estimateShipping(level, countryIso, copies);
}

/** Books + postage, to the cent. */
export function orderTotalWithShipping(subtotal: number, shipping: number): number {
  return Math.round((subtotal + shipping) * 100) / 100;
}
