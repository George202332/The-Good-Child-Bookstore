/**
 * Shipping prices for the printed copies in a cart. One function used by both
 * the checkout page (to show prices) and order creation (to charge them), so
 * the customer is always charged exactly what they were shown for the same
 * address, copies and method.
 */

import { buildLuluAddress, shippingProblems, type LuluShippingLevel } from "@/lib/lulu-order";
import { pickShippingQuote, type ShippingQuote } from "@/lib/shipping-quote";
import { quoteLuluShippingDetailed, type ShippingQuoteLine } from "@/lib/payments/lulu";

export interface CartPrintLine {
  title: string;
  format: string;
  qty: number;
  submissionMetadata: unknown;
  files: { kind: string; url: string }[];
}

export interface CartShippingResult {
  quotes: ShippingQuote[];
  /** ok = Lulu priced this address; none = Lulu cannot ship these books to this address; error = Lulu could not
   * be asked; incomplete = the address is not complete yet, so only the store's estimate is shown. */
  lulu: "ok" | "none" | "error" | "incomplete";
  /** Why Lulu gave no price (kind, status, short reason). Present when lulu is "error" or "none". */
  failure?: import("@/lib/lulu-quote-failure").QuoteFailure;
}

export async function quoteCartShippingDetailed(opts: {
  lines: CartPrintLine[];
  countryIso: string;
  rawAddress?: string | null;
  phone?: string | null;
  name?: string | null;
  levels: LuluShippingLevel[];
}): Promise<CartShippingResult> {
  const printLines: ShippingQuoteLine[] = opts.lines
    .filter((l) => l.format === "paperback" || l.format === "hardcover")
    .map((l) => ({
      title: l.title,
      format: l.format as "paperback" | "hardcover",
      quantity: l.qty,
      submissionMetadata: l.submissionMetadata,
      manuscriptUrl: l.files.find((f) => f.kind === "MANUSCRIPT")?.url,
    }));
  if (printLines.length === 0) return { quotes: [], lulu: "incomplete" };

  const copies = printLines.reduce((n, l) => n + l.quantity, 0);
  const address = buildLuluAddress({
    name: opts.name || "Customer",
    email: "quote@thegoodchildbookstore.com",
    rawAddress: opts.rawAddress,
    countryIso: opts.countryIso,
    phone: opts.phone,
  });

  // Lulu can only quote a complete destination (country, region where needed, postal code); until the customer has
  // typed one, the store's estimate is shown (and labelled as an estimate).
  const complete = shippingProblems(address).length === 0;
  const answer = complete ? await quoteLuluShippingDetailed(printLines, address) : { status: "incomplete" as const, quotes: [] };
  return {
    quotes: opts.levels.map((level) => pickShippingQuote(level, answer.quotes, opts.countryIso, copies)),
    lulu: answer.status,
    failure: "failure" in answer ? answer.failure : undefined,
  };
}

/** The quotes only (used when an order is created). */
export async function quoteCartShipping(opts: Parameters<typeof quoteCartShippingDetailed>[0]): Promise<ShippingQuote[]> {
  return (await quoteCartShippingDetailed(opts)).quotes;
}
