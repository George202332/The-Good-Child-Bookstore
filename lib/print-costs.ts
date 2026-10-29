/**
 * Lulu's production printing cost for printed copies, and what is left of the book price
 * for the royalty split once it is taken off.
 *
 * Lulu's cost calculator (POST /print-job-cost-calculations/) returns, for the books and
 * address in an order: one cost per line item (the PRODUCTION PRINTING cost of those copies),
 * a separate shipping cost, and a fulfilment fee. Only the production printing cost is taken
 * off the book price. Shipping is paid by the customer on top of the book price and passed
 * straight to Lulu; it never enters the royalty split.
 */

export interface LuluCostQuote {
  /** Production printing cost of each requested line, in request order (all copies of the line). */
  lineCosts: number[];
  /** What Lulu charges for shipping this order. */
  shippingCost: number;
  /** Lulu's per-order fulfilment fee (not charged to authors). */
  fulfillmentCost: number;
  currency: string;
}

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Reads Lulu's cost calculation reply. Uses the cost excluding tax (tax is not part of the
 * production cost). Returns null when it cannot be read, so a wrong number is never used. */
export function parseLuluCostCalculation(json: unknown, expectedLines: number): LuluCostQuote | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const items = Array.isArray(o.line_item_costs) ? (o.line_item_costs as Record<string, unknown>[]) : null;
  if (!items || items.length !== expectedLines) return null;
  const lineCosts: number[] = [];
  for (const it of items) {
    const c = money(it?.total_cost_excl_tax);
    if (c === null) return null;
    lineCosts.push(c);
  }
  const ship = o.shipping_cost as Record<string, unknown> | undefined;
  const fulfil = o.fulfillment_cost as Record<string, unknown> | undefined;
  const shippingCost = money(ship?.total_cost_excl_tax) ?? 0;
  const fulfillmentCost = money(fulfil?.total_cost_excl_tax) ?? 0;
  return { lineCosts, shippingCost, fulfillmentCost, currency: typeof o.currency === "string" ? o.currency : "USD" };
}

/** The amount left to split between author, affiliate and company: book price minus Lulu's
 * production printing cost, never below zero. */
export function netAfterPrintingCost(gross: number, printingCost: number): number {
  return Math.max(0, Math.round((gross - printingCost) * 100) / 100);
}

export function sumCosts(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}
