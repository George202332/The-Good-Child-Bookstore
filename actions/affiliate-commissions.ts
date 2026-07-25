"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface CommissionRow {
  id: string;
  date: string;
  bookTitle: string;
  saleAmount: number;
  commission: number;
  type: "Direct link" | "Author referral";
}

/** Real per-sale commission breakdown — splitting "Commissions" out
 * from the combined Earnings page. Includes both direct per-link
 * commissions and the separate lifetime 5% author-referral commission
 * (see lib/revenue.ts applyAuthorReferralCarveOut) — labeled distinctly
 * since they come from very different things (sharing a specific book's
 * link, vs. having referred that book's author onto the platform in the
 * first place). */
export async function getMyCommissions(): Promise<CommissionRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        affiliateProfile: {
          include: {
            affiliateLinks: { include: { saleLines: { include: { book: true } } } },
            authorReferralEarnings: { include: { book: true } },
          },
        },
      },
    });
    const links = user?.affiliateProfile?.affiliateLinks ?? [];
    const directRows = links.flatMap((l: { saleLines: { id: string; createdAt: Date; grossAmount: unknown; affiliateShare: unknown; book: { title: string } }[] }) =>
      l.saleLines
        .filter((s) => Number(s.affiliateShare) > 0)
        .map((s) => ({
          id: s.id,
          date: s.createdAt.toISOString(),
          bookTitle: s.book.title,
          saleAmount: Number(s.grossAmount),
          commission: Number(s.affiliateShare),
          type: "Direct link" as const,
        }))
    );
    const referralRows = (user?.affiliateProfile?.authorReferralEarnings ?? []).map((s: { id: string; createdAt: Date; grossAmount: unknown; authorReferralShare: unknown; book: { title: string } }) => ({
      id: s.id,
      date: s.createdAt.toISOString(),
      bookTitle: s.book.title,
      saleAmount: Number(s.grossAmount),
      commission: Number(s.authorReferralShare),
      type: "Author referral" as const,
    }));
    return [...directRows, ...referralRows].sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
