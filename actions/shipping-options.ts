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
import { QUOTE_BUDGET_MS, classifyDuration, fieldForAddressDetail } from "@/lib/quote-log";
import { printDetailsProblems } from "@/lib/print-details-check";

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
  /** True when asking again could give a different answer (the checkout offers "Try again" and retries once by itself). */
  retryable?: boolean;
  /** Why no price was given (auth, address, rejected, unavailable, unreadable, pages, not-configured, timeout, error, not-served). */
  kind?: string;
  /** The delivery field the problem is about, so the message can be shown beside it. */
  field?: "postcode" | "phone" | "state" | "city" | "address" | "country";
  /** How long the whole price request took on the server. */
  ms?: number;
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
/** TESTING ONLY, never on the live site: LULU_QUOTE_SIMULATE on Preview makes the price request behave badly on purpose.
 *   slow     -> answers after 9 seconds (shows the "taking longer than usual" message)
 *   fail     -> always fails (shows the message and the Try again button)
 *   postcode -> Lulu "refuses" the postal code (shows the message beside the postal code field) */
async function simulatedQuote(): Promise<ShippingOptionsResult | null> {
  const { deploymentOf } = await import("@/lib/runtime-env");
  if (deploymentOf() === "production") return null;
  const mode = process.env.LULU_QUOTE_SIMULATE?.trim().toLowerCase();
  if (mode === "slow") { await new Promise((r) => setTimeout(r, 9000)); return null; }
  if (mode === "fail") return { rows: [], state: "unavailable", kind: "unavailable", retryable: true, message: "Our print partner's price service is not answering right now. We tried several times. Nothing has been charged; please try again in a few minutes." };
  if (mode === "postcode") return { rows: [], state: "cannot-ship", kind: "address", field: "postcode", retryable: false, message: "Our print partner could not price this order for your delivery address (the postal code was not accepted). Please check the postal code and try again. Nothing has been charged." };
  return null;
}

async function computeShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionsResult> {
  const simulated = await simulatedQuote();
  if (simulated) return simulated;
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
  const { quotes, lulu, failure: shipFailure } = await quoteCartShippingDetailed({
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
  let why: QuoteFailure | undefined = state === "unavailable" || state === "cannot-ship" ? shipFailure : undefined;
  // Lulu's own reason is more helpful than the generic line, when we have one.
  if (why && (why.kind === "address" || why.kind === "rejected" || why.kind === "pages" || why.kind === "auth" || why.kind === "unavailable" || why.kind === "not-configured")) message = why.customerMessage;

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
      why = costFailure;
      await alertOnce(costFailure);
    }
  }
  const result: ShippingOptionsResult = {
    rows, state, message,
    ...(why ? { kind: why.kind, retryable: why.retryable, field: why.kind === "address" ? fieldForAddressDetail(why.detail) ?? undefined : undefined } : {}),
    ...(state === "cannot-ship" && !why ? { kind: "not-served", retryable: false } : {}),
    ...(state === "unavailable" && !why ? { kind: "error", retryable: true } : {}),
  };
  // A temporary failure is never remembered, so the next check asks Lulu again.
  if (lulu !== "error" && state !== "price-unavailable") {
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), result });
  }
  return result;
}

const TIMEOUT_RESULT: ShippingOptionsResult = {
  rows: [], state: "unavailable", kind: "timeout", retryable: true,
  message: "Our print partner is slow to answer right now. Your details are safe and nothing has been charged. Please try again.",
};

/** The shipping methods and prices for the printed copies in the cart. Never waits longer than QUOTE_BUDGET_MS, never throws,
 * and logs every failed or slow request (country code, book ids, failure kind, time taken: no names, addresses or keys). */
export async function getShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionsResult> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: ShippingOptionsResult;
  try {
    result = await Promise.race([
      computeShippingOptions(input),
      new Promise<ShippingOptionsResult>((resolve) => { timer = setTimeout(() => resolve(TIMEOUT_RESULT), QUOTE_BUDGET_MS); }),
    ]);
  } catch (e) {
    console.error("[quote] shipping options crashed:", e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "unknown");
    result = { rows: [], state: "unavailable", kind: "error", retryable: true, message: "We could not get shipping prices just now. Nothing has been charged. Please try again." };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  result = { ...result, ms };

  try {
    const printIds = [...new Set((input.items ?? []).filter((i) => i.format === "paperback" || i.format === "hardcover").map((i) => i.bookId))].slice(0, 50);
    const iso = countryToIso2(input.country) ?? "??";
    const asked = result.state === "ok" || result.state === "cannot-ship" || result.state === "unavailable" || result.state === "price-unavailable";
    if (asked && printIds.length > 0) {
      const failed = result.state !== "ok";
      const outcome = classifyDuration(!failed, ms);
      if (outcome !== "ok") console.error(`[quote] ${outcome} kind=${result.kind ?? "none"} country=${iso} ms=${ms} books=${printIds.join(",")}`);
      const { recordQuote, flagBook, clearBookFlag } = await import("@/lib/site-health/quote-log");
      await recordQuote({ at: new Date().toISOString(), outcome, kind: failed ? result.kind ?? "error" : undefined, ms, country: iso, bookId: printIds[0] });
      if (!failed) {
        await Promise.all(printIds.map((id) => clearBookFlag(id)));
      } else if (result.kind === "pages" || result.kind === "rejected") {
        const rows = await prisma.book.findMany({ where: { id: { in: printIds } }, select: { id: true, submissionMetadata: true, files: { select: { kind: true } } } });
        const bad = rows.filter((b) => printDetailsProblems({ submissionMetadata: b.submissionMetadata, hasInteriorFile: b.files.some((f) => f.kind === "MANUSCRIPT"), hasPrintFormat: true }).some((p) => p.level === "error"));
        const toFlag = result.kind === "pages" && bad.length > 0 ? bad : rows;
        await Promise.all(toFlag.map((b) => flagBook(b.id, { kind: result.kind as string, message: result.kind === "pages" ? "A customer could not get a printing price: the page count is missing." : "Lulu refused to price this book's print settings.", at: new Date().toISOString() })));
      }
    }
  } catch {
    // logging must never break checkout
  }
  return result;
}
