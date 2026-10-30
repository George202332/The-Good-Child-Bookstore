/**
 * Print cost ESTIMATE, the fallback only. The Pricing section asks Lulu for the real printing cost of
 * the book's detected specifications (actions/print-specs.ts quotePrintCost, which calls Lulu's cost
 * calculator, the same one real orders use). This estimate (a fixed amount plus a small per-page rate,
 * higher for the hardcover) is shown, clearly labelled, only before an interior file is uploaded or when
 * Lulu cannot be asked.
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
 * figures shown here are the figures recorded when a copy is sold. Pass Lulu's real quote for the
 * book's detected specs as `printingCost` (actions/print-specs.ts quotePrintCost). */
export function computePrintPricingFromCost(retailPrice: number, printingCost: number): PrintPricingBreakdown {
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

/** The same breakdown using the site's own cost ESTIMATE. Only for when Lulu has not been asked
 * (no interior uploaded yet) or cannot answer; the form labels it as an estimate. */
export function computePrintPricing(retailPrice: number, binding: "PB" | "CO" | "LW", pageCount?: number): PrintPricingBreakdown {
  return computePrintPricingFromCost(retailPrice, estimatePrintingCost(binding, pageCount));
}
