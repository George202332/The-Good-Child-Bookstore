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
 *     platform earns 5% (moved up from 3% per explicit instruction), for
 *     life, of the COMPANY's revenue from that author's sales (separate
 *     from any per-sale affiliate cut above).
 *   - No refund/return deductions: store policy is no returns once a
 *     product has been purchased, so — unlike the original frontend
 *     prototype this was converted from — the author's share is NOT
 *     reduced by a modeled refund/return rate.
 *
 * Both the affiliate-direct-link rate (10%) and the referral rate (5%)
 * are also controllable from the backend (Admin → Commission Settings,
 * see lib/commission-settings.ts) — the constants below are the
 * fallback defaults used until an admin changes them, and every
 * function here accepts the current rate as an optional parameter so
 * callers that already looked up the live rate can pass it through.
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
  /** The referring affiliate's referral-commission cut, when this sale's
   * author was referred onto the platform by an affiliate — carved out
   * of companyShare (not added on top), so the four fields always sum
   * to gross exactly. 0 when the author wasn't referred by anyone. */
  authorReferralShare: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Throws if the four shares don't reconcile to the gross, to the cent. */
function assertReconciles(split: RevenueSplit): RevenueSplit {
  const total = round2(split.companyShare + split.authorShare + split.affiliateShare + split.authorReferralShare);
  if (Math.abs(total - split.gross) > 0.01) {
    throw new Error(
      `Revenue split failed to reconcile: company(${split.companyShare}) + author(${split.authorShare}) + affiliate(${split.affiliateShare}) + authorReferral(${split.authorReferralShare}) = ${total}, expected gross ${split.gross}`
    );
  }
  return split;
}

export function calculateOrganicSplit(grossAmount: number): RevenueSplit {
  const gross = round2(grossAmount);
  const companyShare = round2(gross * REVENUE_CONFIG.organic.company);
  const authorShare = round2(gross - companyShare); // remainder avoids rounding drift
  return assertReconciles({ saleType: "ORGANIC", gross, companyShare, authorShare, affiliateShare: 0, authorReferralShare: 0 });
}

export function calculateAffiliateSplit(grossAmount: number, promotionPct: number = REVENUE_CONFIG.affiliate.affiliate): RevenueSplit {
  const gross = round2(grossAmount);
  const companyShare = round2(gross * REVENUE_CONFIG.affiliate.company);
  const affiliateShare = round2(gross * promotionPct);
  const authorShare = round2(gross - companyShare - affiliateShare); // remainder
  return assertReconciles({ saleType: "AFFILIATE", gross, companyShare, authorShare, affiliateShare, authorReferralShare: 0 });
}

/**
 * Applies the author-referral carve-out to an already-computed split —
 * called from createPendingOrder for every line whose book's author has
 * authorProfile.referredById set. Takes referralPct of whatever
 * companyShare already is (correct either way: an organic sale's full
 * 25% company share, or an affiliate sale's 25% company share alongside
 * its own separate direct-link affiliate cut) and moves it to
 * authorReferralShare, crediting the referring affiliate — this is
 * always in addition to, never instead of, that affiliate's own direct
 * per-sale commission on their own links.
 */
export function applyAuthorReferralCarveOut(split: RevenueSplit, referralPct: number = REVENUE_CONFIG.referralPct): RevenueSplit {
  const authorReferralShare = calculateReferralCommission(split.companyShare, referralPct);
  const companyShare = round2(split.companyShare - authorReferralShare);
  return assertReconciles({ ...split, companyShare, authorReferralShare });
}

export function calculateSplits(grossAmount: number, hasAffiliate: boolean, promotionPct?: number): RevenueSplit {
  return hasAffiliate ? calculateAffiliateSplit(grossAmount, promotionPct) : calculateOrganicSplit(grossAmount);
}

/** The company's % is identical in both sale types, so this can be read
 * directly off any gross amount regardless of how the sale happened. */
export function calculateCompanyShare(grossAmount: number): number {
  return round2(grossAmount * REVENUE_CONFIG.organic.company);
}

/** Lifetime referral commission: referralPct of the COMPANY's revenue
 * from an author the affiliate referred — never a percentage of the
 * author's own share, and never a one-time payment. */
export function calculateReferralCommission(companyRevenueFromReferredAuthor: number, referralPct: number = REVENUE_CONFIG.referralPct): number {
  return round2(companyRevenueFromReferredAuthor * referralPct);
}

export function referralCommissionForAuthor(grossRevenueFromAuthor: number, referralPct?: number): number {
  return calculateReferralCommission(calculateCompanyShare(grossRevenueFromAuthor), referralPct);
}
