/**
 * Print cost estimation, matching the "Pricing" section's cost/royalty
 * breakdown (HARDCOVER/PAPERBACK PRINTING COST, COMPANY REVENUE, AUTHOR
 * PROFIT, ESTIMATED ROYALTY). Lulu's real per-copy printing cost depends
 * on trim size, interior color, paper, binding, and page count, and is
 * normally fetched live from Lulu's Print API cost-calculation endpoint.
 *
 * IMPORTANT HONESTY NOTE: this environment has no network access to call
 * that live endpoint, so this is a documented approximation using
 * publicly-typical Lulu per-copy cost ranges for a standard children's
 * picture book (a modest fixed cost plus a small per-page rate, higher
 * for hardcover's linen wrap binding) — not a real-time quote. Wiring
 * this to Lulu's actual cost-calculation API is the natural next step
 * once real API credentials and network access are available.
 */

const DEFAULT_PAGE_COUNT = 32; // typical children's picture book length, used until a real page count is known

export function estimatePrintingCost(binding: "PB" | "CO" | "LW", pageCount: number = DEFAULT_PAGE_COUNT): number {
  const perPage = 0.012;
  const fixedCost = binding === "LW" ? 5.39 : binding === "CO" ? 2.2 : 1.59;
  return +(fixedCost + pageCount * perPage).toFixed(2);
}

const COMPANY_REVENUE_SHARE = 0.25; // matches the confirmed 25% organic-sale company share used elsewhere

export interface PrintPricingBreakdown {
  printingCost: number;
  companyRevenue: number;
  authorProfit: number;
  estimatedRoyalty: number;
}

export function computePrintPricing(retailPrice: number, binding: "PB" | "CO" | "LW", pageCount?: number): PrintPricingBreakdown {
  const printingCost = estimatePrintingCost(binding, pageCount);
  const companyRevenue = +(retailPrice * COMPANY_REVENUE_SHARE).toFixed(2);
  const authorProfit = +(retailPrice - printingCost).toFixed(2);
  const estimatedRoyalty = Math.max(0, +(authorProfit - companyRevenue).toFixed(2));
  return { printingCost, companyRevenue, authorProfit, estimatedRoyalty };
}
