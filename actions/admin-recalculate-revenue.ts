"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateSplits, applyAuthorReferralCarveOut } from "@/lib/revenue";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";

export interface RecalculateResult {
  ok: boolean;
  updated?: number;
  error?: string;
}

/**
 * Recomputes companyShare/authorShare/affiliateShare/authorReferralShare
 * for every SaleLine that already exists, using the CURRENT percentages
 * (see lib/revenue.ts and lib/commission-settings.ts) instead of
 * whatever was in effect when each sale was originally recorded.
 *
 * Needed because a sale's split is calculated once and stored
 * permanently at the time of purchase — updating REVENUE_CONFIG in code
 * only changes how *future* sales are split; it does nothing to numbers
 * already written to the database. This is the explicit, deliberate
 * migration step to bring historical data in line with a rate change,
 * run once from Admin → Commission Settings rather than automatically,
 * since it rewrites real financial records.
 *
 * grossAmount, saleType, format, affiliateLinkId, and
 * authorReferralAffiliateId are never touched — only the four share
 * amounts are recalculated, from the same gross and the same sale type
 * and referral attribution that were already on record.
 */
export async function recalculateAllRevenueSplits(): Promise<RecalculateResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can run this." };
  }

  try {
    const rates = await getCommissionRates();
    const lines = await prisma.saleLine.findMany({
      select: {
        id: true,
        grossAmount: true,
        saleType: true,
        authorReferralAffiliateId: true,
      },
    });

    // Cache each referring affiliate's current referred-author count so
    // it's only counted once, not once per sale line.
    const tierRateCache = new Map<string, number>();
    async function referralRateFor(affiliateId: string): Promise<number> {
      if (tierRateCache.has(affiliateId)) return tierRateCache.get(affiliateId)!;
      const count = await prisma.authorProfile.count({ where: { referredById: affiliateId } });
      const rate = tierForReferralCount(count, rates.tiers).pct;
      tierRateCache.set(affiliateId, rate);
      return rate;
    }

    let updated = 0;
    for (const line of lines as { id: string; grossAmount: unknown; saleType: string; authorReferralAffiliateId: string | null }[]) {
      const gross = Number(line.grossAmount);
      let split = calculateSplits(gross, line.saleType === "AFFILIATE", rates.promotionPct);
      if (line.authorReferralAffiliateId) {
        const rate = await referralRateFor(line.authorReferralAffiliateId);
        split = applyAuthorReferralCarveOut(split, rate);
      }
      await prisma.saleLine.update({
        where: { id: line.id },
        data: {
          companyShare: split.companyShare,
          authorShare: split.authorShare,
          affiliateShare: split.affiliateShare,
          authorReferralShare: split.authorReferralShare,
        },
      });
      updated++;
    }

    return { ok: true, updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
