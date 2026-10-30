/**
 * Print cost estimation, matching the "Pricing" section's cost/royalty
 * breakdown (printing cost, company revenue, estimated royalty). Lulu's real per-copy printing cost depends
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

import { calculateSplits } from "@/lib/revenue";

const DEFAULT_PAGE_COUNT = 32; // typical children's picture book length, used until a real page count is known

export function estimatePrintingCost(binding: "PB" | "CO" | "LW", pageCount: number = DEFAULT_PAGE_COUNT): number {
  const perPage = 0.012;
  const fixedCost = binding === "LW" ? 5.39 : binding === "CO" ? 2.2 : 1.59;
  return +(fixedCost + pageCount * perPage).toFixed(2);
}

export interface PrintPricingBreakdown {
  /** Estimated production printing cost (Lulu's exact price is used when the sale is made). */
  printingCost: number;
  /** Retail price minus the printing cost. Shipping is never part of it. */
  balance: number;
  /** Company's 30% of the balance, before any referral commission. */
  companyRevenue: number;
  /** What the author earns on a normal sale: 70% of the balance. */
  estimatedRoyalty: number;
  /** What the author earns when the sale comes through a promotional affiliate link: 60% of the balance. */
  royaltyViaAffiliate: number;
  /** What the promotional affiliate earns on such a sale: 10% of the balance. */
  affiliateCommission: number;
}

/** The Pricing preview uses the SAME split engine as real sales (lib/revenue.ts), so the
 * figures shown here are the figures recorded when a copy is sold (apart from the printing
 * cost, which is Lulu's exact price at that time). */
export function computePrintPricing(retailPrice: number, binding: "PB" | "CO" | "LW", pageCount?: number): PrintPricingBreakdown {
  const printingCost = estimatePrintingCost(binding, pageCount);
  const organic = calculateSplits(retailPrice, false, undefined, printingCost);
  const viaAffiliate = calculateSplits(retailPrice, true, undefined, printingCost);
  return {
    printingCost,
    balance: organic.net,
    companyRevenue: organic.companyShare,
    estimatedRoyalty: organic.authorShare,
    royaltyViaAffiliate: viaAffiliate.authorShare,
    affiliateCommission: viaAffiliate.affiliateShare,
  };
}
