/**
 * CENTRALIZED REVENUE ENGINE
 *
 * This is the single place a gross sale is split into company / author /
 * affiliate shares anywhere in the backend (checkout, webhooks, dashboards,
 * reports, PDFs). Nothing else should re-implement this math.
 *
 * Confirmed with the project owner (overrides the generic brief numbers):
 *   - Organic sale:            company 25% / author 75%
 *   - Affiliate-referred sale: company 25% / affiliate 10% / author 65%
 *   - Referral commission: an affiliate who referred an AUTHOR onto the
 *     platform earns 5%, for life, of the COMPANY's revenue from that
 *     author's sales (separate from any per-sale affiliate cut above).
 *   - No refund/return deductions: store policy is no returns once a
 *     product has been purchased, so — unlike the original frontend
 *     prototype this was converted from — the author's share is NOT
 *     reduced by a modeled refund/return rate.
 */

export const REVENUE_CONFIG = {
  organic: { company: 0.25, author: 0.75 },
  affiliate: { company: 0.25, affiliate: 0.10, author: 0.65 },
  referralPct: 0.05,
} as const;

export type SaleType = "ORGANIC" | "AFFILIATE";

export interface RevenueSplit {
  saleType: SaleType;
  gross: number;
  companyShare: number;
  authorShare: number;
  affiliateShare: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Throws if the three shares don't reconcile to the gross, to the cent. */
function assertReconciles(split: RevenueSplit): RevenueSplit {
  const total = round2(split.companyShare + split.authorShare + split.affiliateShare);
  if (Math.abs(total - split.gross) > 0.01) {
    throw new Error(
      `Revenue split failed to reconcile: company(${split.companyShare}) + author(${split.authorShare}) + affiliate(${split.affiliateShare}) = ${total}, expected gross ${split.gross}`
    );
  }
  return split;
}

export function calculateOrganicSplit(grossAmount: number): RevenueSplit {
  const gross = round2(grossAmount);
  const companyShare = round2(gross * REVENUE_CONFIG.organic.company);
  const authorShare = round2(gross - companyShare); // remainder avoids rounding drift
  return assertReconciles({ saleType: "ORGANIC", gross, companyShare, authorShare, affiliateShare: 0 });
}

export function calculateAffiliateSplit(grossAmount: number): RevenueSplit {
  const gross = round2(grossAmount);
  const companyShare = round2(gross * REVENUE_CONFIG.affiliate.company);
  const affiliateShare = round2(gross * REVENUE_CONFIG.affiliate.affiliate);
  const authorShare = round2(gross - companyShare - affiliateShare); // remainder
  return assertReconciles({ saleType: "AFFILIATE", gross, companyShare, authorShare, affiliateShare });
}

export function calculateSplits(grossAmount: number, hasAffiliate: boolean): RevenueSplit {
  return hasAffiliate ? calculateAffiliateSplit(grossAmount) : calculateOrganicSplit(grossAmount);
}

/** The company's % is identical in both sale types, so this can be read
 * directly off any gross amount regardless of how the sale happened. */
export function calculateCompanyShare(grossAmount: number): number {
  return round2(grossAmount * REVENUE_CONFIG.organic.company);
}

/** Lifetime referral commission: 5% of the COMPANY's revenue from an
 * author the affiliate referred — never a percentage of the author's own
 * share, and never a one-time payment. */
export function calculateReferralCommission(companyRevenueFromReferredAuthor: number): number {
  return round2(companyRevenueFromReferredAuthor * REVENUE_CONFIG.referralPct);
}

export function referralCommissionForAuthor(grossRevenueFromAuthor: number): number {
  return calculateReferralCommission(calculateCompanyShare(grossRevenueFromAuthor));
}
