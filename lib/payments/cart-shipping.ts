/**
 * Shipping prices for the printed copies in a cart. One function used by both
 * the checkout page (to show prices) and order creation (to charge them), so
 * the customer is always charged exactly what they were shown for the same
 * address, copies and method.
 */

import { buildLuluAddress, shippingProblems, type LuluShippingLevel } from "@/lib/lulu-order";
import { pickShippingQuote, type ShippingQuote } from "@/lib/shipping-quote";
import { quoteLuluShipping, type ShippingQuoteLine } from "@/lib/payments/lulu";

export interface CartPrintLine {
  title: string;
  format: string;
  qty: number;
  submissionMetadata: unknown;
  files: { kind: string; url: string }[];
}

export async function quoteCartShipping(opts: {
  lines: CartPrintLine[];
  countryIso: string;
  rawAddress?: string | null;
  phone?: string | null;
  name?: string | null;
  levels: LuluShippingLevel[];
}): Promise<ShippingQuote[]> {
  const printLines: ShippingQuoteLine[] = opts.lines
    .filter((l) => l.format === "paperback" || l.format === "hardcover")
    .map((l) => ({
      title: l.title,
      format: l.format as "paperback" | "hardcover",
      quantity: l.qty,
      submissionMetadata: l.submissionMetadata,
      manuscriptUrl: l.files.find((f) => f.kind === "MANUSCRIPT")?.url,
    }));
  if (printLines.length === 0) return [];

  const copies = printLines.reduce((n, l) => n + l.quantity, 0);
  const address = buildLuluAddress({
    name: opts.name || "Customer",
    email: "quote@thegoodchildbookstore.com",
    rawAddress: opts.rawAddress,
    countryIso: opts.countryIso,
    phone: opts.phone,
  });

  // Lulu can only quote a complete destination; until the customer has typed
  // one, the store's estimate is shown (and labelled as an estimate).
  const complete = shippingProblems(address).length === 0;
  const luluQuotes = complete ? await quoteLuluShipping(printLines, address) : [];
  return opts.levels.map((level) => pickShippingQuote(level, luluQuotes, opts.countryIso, copies));
}
