import { prisma } from "@/lib/prisma";
import type { EarningsBreakdown, EarningsLine, DateRange } from "@/lib/earnings-lines-core";

/**
 * The single shared source for "how much has this user earned, and
 * when" — every one of Author-royalty, Affiliate-promotion, and
 * Author-referral earnings, as plain {createdAt, amount} lines.
 *
 * Before this file existed, the same fetch-and-reduce (query the
 * user's books/affiliateLinks/authorReferralEarnings, sum
 * authorShare/affiliateShare/authorReferralShare) was hand-written
 * independently in actions/wallet.ts, lib/compute-wallet-for-user.ts,
 * lib/payout-monthly.ts, and actions/payout-ledger.ts — four separate
 * copies that had to be kept in sync by hand every time a revenue
 * category changed. Every one of those now calls fetchEarningsBreakdown
 * below instead.
 *
 * lib/payout-statement-data.ts is the deliberate exception: the PDF
 * statement needs a per-title, per-format breakdown (book title, list
 * price, gross amount, company share) that this shape doesn't carry,
 * so it keeps its own richer query rather than being forced through
 * this narrower one.
 *
 * The pure types and categorization helpers (linesForView, sumLines)
 * live in lib/earnings-lines-core.ts, which has no Prisma dependency
 * and so can be unit-tested directly — see tests/earnings-lines.test.ts.
 * They're re-exported here so existing imports of this file keep working.
 */

export type { EarningsLine, EarningsBreakdown, DateRange };
export { linesForView, sumLines } from "@/lib/earnings-lines-core";

/**
 * Fetches and categorizes one user's real earnings. Every caller that
 * needs "how much has X earned" starts here rather than re-querying
 * books/affiliateLinks/authorReferralEarnings itself — see the file
 * comment above for why this exists.
 */
export async function fetchEarningsBreakdown(userId: string, range?: DateRange): Promise<EarningsBreakdown> {
  const dateFilter = range ? { createdAt: { gte: range.start, lt: range.end } } : {};

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      authorProfile: {
        include: { books: { include: { saleLines: { where: dateFilter } } } },
      },
      affiliateProfile: {
        include: {
          affiliateLinks: { include: { saleLines: { where: dateFilter } } },
          authorReferralEarnings: { where: dateFilter },
        },
      },
    },
  });

  const books = (user?.authorProfile?.books ?? []) as { saleLines: { createdAt: Date; authorShare: unknown }[] }[];
  const organic: EarningsLine[] = books.flatMap((b) => b.saleLines.map((l) => ({ createdAt: l.createdAt, amount: Number(l.authorShare) })));

  const links = (user?.affiliateProfile?.affiliateLinks ?? []) as { saleLines: { createdAt: Date; affiliateShare: unknown }[] }[];
  const commission: EarningsLine[] = links.flatMap((l) => l.saleLines.map((s) => ({ createdAt: s.createdAt, amount: Number(s.affiliateShare) })));

  const referral: EarningsLine[] = ((user?.affiliateProfile?.authorReferralEarnings ?? []) as { createdAt: Date; authorReferralShare: unknown }[]).map(
    (r) => ({ createdAt: r.createdAt, amount: Number(r.authorReferralShare) })
  );

  return { organic, referral, commission };
}
