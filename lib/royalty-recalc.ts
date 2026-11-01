import { calculateSplits, applyAuthorReferralCarveOut } from "@/lib/revenue";

/**
 * Round 53 (Amendment 11): the royalty on a printed copy is worked out AFTER Lulu's printing cost.
 * This is the pure part of the one-off recalculation of existing print sale lines (no database, no Lulu),
 * so it can be tested. The runner that reads and writes the database is scripts/recalculate-print-royalties.ts.
 */

export type CostSource = "recorded" | "lulu-specs" | "estimate-specs";

export interface PrintLineInput {
  grossAmount: number;
  saleType: string;
  /** The printing cost saved on the line when it was ordered (all copies), or null for older orders. */
  recordedPrintingCost: number | null;
  /** Referral percentage for the author's referring affiliate (0.05 = 5%), or null when the author was not referred. */
  referralPct: number | null;
  promotionPct?: number;
  /** Used only when recordedPrintingCost is null: the cost for this book's specs (all copies on the line). */
  specsCost?: { cost: number; source: Exclude<CostSource, "recorded"> } | null;
}

export interface Shares { companyShare: number; authorShare: number; affiliateShare: number; authorReferralShare: number }

export interface PrintLineResult {
  printingCost: number;
  costSource: CostSource | "none";
  next: Shares;
  /** True when the cost did not come from the order itself, so the figure is an estimate for that book's specs. */
  flagged: boolean;
}

/** How many copies a line holds: the amount paid over the book's price for that format (an order stores one line per book). */
export function inferQuantity(grossAmount: number, unitPrice: number | null | undefined): number {
  if (!unitPrice || unitPrice <= 0 || !(grossAmount > 0)) return 1;
  return Math.max(1, Math.round(grossAmount / unitPrice));
}

export function recalcPrintLine(l: PrintLineInput): PrintLineResult {
  let cost = 0;
  let costSource: PrintLineResult["costSource"] = "none";
  if (l.recordedPrintingCost != null) { cost = l.recordedPrintingCost; costSource = "recorded"; }
  else if (l.specsCost) { cost = l.specsCost.cost; costSource = l.specsCost.source; }
  let split = calculateSplits(l.grossAmount, l.saleType === "AFFILIATE", l.promotionPct, cost);
  if (l.referralPct != null) split = applyAuthorReferralCarveOut(split, l.referralPct);
  return {
    printingCost: cost,
    costSource,
    next: { companyShare: split.companyShare, authorShare: split.authorShare, affiliateShare: split.affiliateShare, authorReferralShare: split.authorReferralShare },
    flagged: costSource !== "recorded",
  };
}

const cents = (n: number) => Math.round(n * 100);
export function sharesChanged(a: Shares, b: Shares): boolean {
  return cents(a.companyShare) !== cents(b.companyShare) || cents(a.authorShare) !== cents(b.authorShare)
    || cents(a.affiliateShare) !== cents(b.affiliateShare) || cents(a.authorReferralShare) !== cents(b.authorReferralShare);
}
