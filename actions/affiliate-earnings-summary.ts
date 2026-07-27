"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface AffiliateEarningsSummary {
  referralEarnings: number;
  promotionEarnings: number;
  totalEarnings: number;
  earningEvents: number;
  dueEarnings: number;
  dueDate: string;
  referredAuthorsCount: number;
  promotedBooksCount: number;
}

/**
 * Splits an affiliate's earnings into the platform's two real, distinct
 * commission types (see lib/revenue.ts): the 3%-of-company-share
 * referral commission earned when an author they referred sells books,
 * and the 10%-of-sale direct-link commission earned when someone buys
 * through one of their own promotional links — rather than one blended
 * total, matching how the two are actually calculated and paid.
 */
export async function getAffiliateEarningsSummary(): Promise<AffiliateEarningsSummary> {
  const empty: AffiliateEarningsSummary = { referralEarnings: 0, promotionEarnings: 0, totalEarnings: 0, earningEvents: 0, dueEarnings: 0, dueDate: "", referredAuthorsCount: 0, promotedBooksCount: 0 };
  const session = await auth();
  if (!session?.user) return empty;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        affiliateProfile: {
          include: {
            authorReferralEarnings: true,
            affiliateLinks: { include: { saleLines: true } },
          },
        },
      },
    });
    const profile = user?.affiliateProfile;
    if (!profile) return empty;

    const referralLines = profile.authorReferralEarnings as { authorReferralShare: unknown; authorReferralAffiliateId: string | null }[];
    const promotionLines = profile.affiliateLinks.flatMap((l: { saleLines: { affiliateShare: unknown }[] }) => l.saleLines);

    const referralEarnings = referralLines.reduce((s, l) => s + Number(l.authorReferralShare), 0);
    const promotionEarnings = promotionLines.reduce((s: number, l: { affiliateShare: unknown }) => s + Number(l.affiliateShare), 0);
    const totalEarnings = referralEarnings + promotionEarnings;
    const earningEvents = referralLines.length + promotionLines.length;

    const referredAuthorsCount = await prisma.authorProfile.count({ where: { referredById: profile.id } });
    const promotedBooksCount = profile.affiliateLinks.filter((l: { saleLines: unknown[] }) => l.saleLines.length > 0).length;

    const wallet = await prisma.payoutRequest.aggregate({
      where: { userId: session.user.id, status: { in: ["REQUESTED", "APPROVED"] } },
      _sum: { amount: true },
    });
    // Due = total earned minus whatever's already been paid out or is
    // currently mid-request; a simplified "what's left to request" figure.
    const alreadyRequested = Number(wallet._sum.amount ?? 0);
    const paidOut = await prisma.payoutRequest.aggregate({
      where: { userId: session.user.id, status: "PAID" },
      _sum: { amount: true },
    });
    const dueEarnings = Math.max(0, totalEarnings - alreadyRequested - Number(paidOut._sum.amount ?? 0));

    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      referralEarnings,
      promotionEarnings,
      totalEarnings,
      earningEvents,
      dueEarnings,
      dueDate: monthEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      referredAuthorsCount,
      promotedBooksCount,
    };
  } catch {
    return empty;
  }
}
