"use server";

import { prisma } from "@/lib/prisma";
import { getEnabledShippingLevels } from "@/lib/api-keys";
import { countryToIso2 } from "@/lib/user-country";
import { shippingLevelsFor, type LuluShippingLevel } from "@/lib/lulu-order";
import { quoteCartShippingDetailed } from "@/lib/payments/cart-shipping";
import { shippingOutcome, type ShippingState } from "@/lib/shipping-options-state";
import { quoteFingerprint, sealQuote } from "@/lib/shipping-quote-token";
import { buildLuluAddress } from "@/lib/lulu-order";
import { quoteLuluCosts, type ShippingQuoteLine } from "@/lib/payments/lulu";
import type { QuoteFailure } from "@/lib/lulu-quote-failure";

export interface ShippingOptionRow {
  id: LuluShippingLevel;
  label: string;
  detail: string;
  /** What the customer pays for this method, in US dollars. */
  amount: number;
  /** "lulu" = live quote for this exact order; "estimate" = the store's
   * rate table (shown until a complete address is entered). */
  source: "lulu" | "estimate";
  minDays?: number;
  maxDays?: number;
  /** Lulu's per-order fulfillment fee for this order (USD), read from Lulu's own cost quote. Charged to the customer
   * once per order, as its own line; never part of any royalty. Only present for Lulu's own quotes. */
  fulfillment?: number;
  /** The sealed quote for this exact price (only for Lulu's own quotes). Sent back when the order is placed so the
   * customer is charged exactly what they were shown. */
  token?: string;
}

export interface ShippingOptionsInput {
  items: { bookId: string; qty: number; format: string }[];
  country: string;
  /** The delivery address in the stored five-line layout (composeShipAddress). */
  address?: string;
  phone?: string;
  name?: string;
}

export interface ShippingOptionsResult {
  rows: ShippingOptionRow[];
  state: ShippingState;
  /** A plain-language explanation to show when the state is "cannot-ship" or "unavailable". */
  message?: string;
}

// Team alerts about a Lulu problem on OUR side are sent at most once every 15 minutes per kind, so a customer
// retyping an address cannot flood the alert list.
const alerted = new Map<string, number>();
async function alertOnce(failure: QuoteFailure): Promise<void> {
  if (failure.kind !== "auth" && failure.kind !== "unreadable" && failure.kind !== "pages" && failure.kind !== "not-configured") return;
  const last = alerted.get(failure.kind) ?? 0;
  if (Date.now() - last < 15 * 60 * 1000) return;
  alerted.set(failure.kind, Date.now());
  try {
    const { reportSystemError } = await import("@/lib/site-health/alert");
    await reportSystemError("CHECKOUT", new Error(`Checkout could not get Lulu's printing price (${failure.kind}${failure.status ? `, HTTP ${failure.status}` : ""}): ${failure.detail || "no detail"}`), {});
  } catch {
    // an alert that cannot be sent must never break checkout
  }
}

const cache = new Map<string, { at: number; result: ShippingOptionsResult }>();
const CACHE_MS = 5 * 60 * 1000;

/** The shipping methods a customer shipping to this exact address can choose at checkout (what the store has
 * switched on in Admin → API Management, narrowed to what Lulu itself offers for this address), each with Lulu's
 * price for the printed copies in the cart. The customer pays this on top of the books. Public: contains no secrets. */
export async function getShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionsResult> {
  const iso = countryToIso2(input.country) ?? "";
  const printItems = (input.items ?? []).filter((i) => i.format === "paperback" || i.format === "hardcover").slice(0, 50)
    .map((i) => ({ bookId: i.bookId, qty: Math.max(1, Math.min(50, Math.floor(i.qty) || 1)), format: i.format }));
  if (printItems.length === 0) return { rows: [], state: "none" };
  if (!iso) return { rows: [], state: "incomplete" };

  const enabled = await getEnabledShippingLevels();
  const levels = shippingLevelsFor(iso, enabled);

  const key = JSON.stringify([printItems, iso, input.address ?? "", input.phone ?? "", [...levels.map((l) => l.id)]]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  const books = await prisma.book.findMany({
    where: { id: { in: printItems.map((i) => i.bookId) } },
    select: { id: true, title: true, submissionMetadata: true, files: { select: { kind: true, url: true } } },
  });
  const lines = printItems.flatMap((i) => {
    const b = books.find((x) => x.id === i.bookId);
    return b ? [{ title: b.title, format: i.format, qty: i.qty, submissionMetadata: b.submissionMetadata, files: b.files }] : [];
  });

  // The quote is always asked for the customer's own country, region and postal code, never a fixed destination.
  const { quotes, lulu } = await quoteCartShippingDetailed({
    lines, countryIso: iso, rawAddress: input.address, phone: input.phone, name: input.name, levels: levels.map((l) => l.id),
  });
  const fp = quoteFingerprint({ items: printItems, countryIso: iso, address: input.address });
  let rows: ShippingOptionRow[] = levels.map((l) => {
    const q = quotes.find((x) => x.level === l.id);
    const source = q?.source ?? "estimate";
    const amount = q?.amount ?? 0;
    return {
      id: l.id, label: l.label, detail: l.detail, amount, source, minDays: q?.minDays, maxDays: q?.maxDays,
      token: source === "lulu" ? sealQuote({ level: l.id, amount, minDays: q?.minDays, maxDays: q?.maxDays, fp }) || undefined : undefined,
    };
  });
  // Once Lulu has priced this address, only the methods Lulu itself offers are shown, each at Lulu's exact price.
  // A method Lulu does not offer for this address (for example Priority Mail) is never shown with an estimate.
  if (lulu === "ok") rows = rows.filter((r) => r.source === "lulu");
  if (lulu === "none" || lulu === "error") rows = [];
  let { state, message } = shippingOutcome({ lulu, offered: rows.length, countryName: input.country });
  if (state !== "ok" && state !== "incomplete") rows = [];

  // Lulu's printing price (and its fulfillment fee) for this exact order and each offered method is confirmed
  // BEFORE the customer can continue, so the payment step is never reached with an unconfirmed price. A method whose
  // price cannot be confirmed is not offered.
  let costFailure: QuoteFailure | undefined;
  if (state === "ok" && rows.length > 0) {
    const costLines: ShippingQuoteLine[] = lines.map((l) => ({
      title: l.title, format: l.format as "paperback" | "hardcover", quantity: l.qty, submissionMetadata: l.submissionMetadata,
      manuscriptUrl: l.files.find((f: { kind: string; url: string }) => f.kind === "MANUSCRIPT")?.url,
    }));
    const costAddress = buildLuluAddress({ name: input.name || "Customer", email: "quote@thegoodchildbookstore.com", rawAddress: input.address, countryIso: iso, phone: input.phone });
    const costs = await Promise.all(rows.map((r) => quoteLuluCosts(costLines, costAddress, r.id)));
    const priced: ShippingOptionRow[] = [];
    rows.forEach((r, i) => {
      const c = costs[i];
      if (c.ok) priced.push({ ...r, fulfillment: c.quote.fulfillmentCost });
      else costFailure = costFailure ?? c.failure;
    });
    rows = priced;
    if (rows.length === 0 && costFailure) {
      state = "price-unavailable";
      message = costFailure.customerMessage;
      await alertOnce(costFailure);
    }
  }
  const result: ShippingOptionsResult = { rows, state, message };
  // A temporary failure is never remembered, so the next check asks Lulu again.
  if (lulu !== "error" && state !== "price-unavailable") {
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), result });
  }
  return result;
}
