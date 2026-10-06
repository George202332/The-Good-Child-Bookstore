import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";

/**
 * The pure data layer of the monthly payout statement's "Revenue
 * Breakdown" summary table (Revenue Source / Description / Amount) and
 * its total, split out of lib/pdf/payout-statement.ts so the numbers can
 * be unit-tested without rendering a PDF
 * (tests/payout-statement-breakdown.test.ts).
 *
 * A Rollover line, for balance under $30 carried over from earlier
 * months, is listed FIRST when there is one, is part of the breakdown's
 * sum and of the statement's final total payout, and is left out
 * entirely when there is no rollover.
 */

export interface RevenueBreakdownInput {
  organicRevenue: number;
  affiliateChannelRevenue: number;
  referralCommission: number;
  promotionCommission: number;
  /** Balance rolled over from earlier months (0 or omitted: none). */
  rolloverAmount?: number;
}

export interface RevenueBreakdownRow {
  source: string;
  description: string;
  amount: number;
}

export interface RevenueBreakdown {
  rows: RevenueBreakdownRow[];
  /** The sum of every row, to the cent: the statement's total payout. */
  total: number;
}

function cents(n: number): number {
  return Math.round(n * 100);
}

export const ROLLOVER_SOURCE = "Rollover";
export const ROLLOVER_DESCRIPTION = `Balance under $${MIN_PAYOUT_AMOUNT} carried over from earlier months`;

export function buildRevenueBreakdown(d: RevenueBreakdownInput): RevenueBreakdown {
  const rows: RevenueBreakdownRow[] = [];
  if (cents(d.rolloverAmount ?? 0) > 0) {
    rows.push({ source: ROLLOVER_SOURCE, description: ROLLOVER_DESCRIPTION, amount: (d.rolloverAmount ?? 0) });
  }
  rows.push(
    { source: "Direct sales: organic", description: "Reader found your book directly", amount: d.organicRevenue },
    { source: "Direct sales: affiliate", description: "Readers arrived via an affiliate link", amount: d.affiliateChannelRevenue },
    { source: "Referral commission", description: "Your tiered commission on the company's revenue from authors you referred", amount: d.referralCommission },
    { source: "Promotion commission", description: "Commission on copies sold via your promotional links", amount: d.promotionCommission }
  );
  const total = rows.reduce((sum, r) => sum + cents(r.amount), 0) / 100;
  return { rows, total };
}
