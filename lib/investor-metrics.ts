import { prisma } from "@/lib/prisma";

/**
 * Real growth/retention data for the Investor role's own overview
 * (Amendment 12, app/investor/overview) — built from actual User/
 * SaleLine/AffiliateProfile rows, the same "no simulated data" standard
 * every other analytics surface in this app holds to (see
 * actions/analytics.ts). Nothing here is placeholder data: every number
 * is a real count or a real sum, computed fresh on every load, for
 * exactly the last `MONTHS` calendar months including the current one.
 */

const MONTHS = 12;

function monthKeyOf(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** The last `MONTHS` calendar months, oldest first, as {key, start, end}
 * — shared by every function below so every chart/table lines up on
 * exactly the same set of months. */
function recentMonths(): { key: string; start: Date; end: Date }[] {
  const now = new Date();
  const months: { key: string; start: Date; end: Date }[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({ key: monthKeyOf(start), start, end });
  }
  return months;
}

export interface GrowthMonth {
  month: string;
  revenue: number;
  orders: number;
  newUsers: number;
}

/** Revenue growth and order-volume growth, month over month — real
 * gross revenue and real paid-order counts, the same underlying
 * SaleLine/Order rows actions/analytics.ts uses, plus new-user signups
 * (every role) for that same month as the third growth line. */
export async function getRevenueAndOrderGrowth(): Promise<GrowthMonth[]> {
  const months = recentMonths();
  const windowStart = months[0].start;

  const [saleLines, orders, users] = await Promise.all([
    prisma.saleLine.findMany({
      where: { createdAt: { gte: windowStart }, order: { status: "PAID" } },
      select: { createdAt: true, grossAmount: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: windowStart }, status: "PAID", lines: { some: {} } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
  ]);

  return months.map(({ key, start, end }) => ({
    month: key,
    revenue: (saleLines as { createdAt: Date; grossAmount: unknown }[])
      .filter((l) => l.createdAt >= start && l.createdAt < end)
      .reduce((sum, l) => sum + Number(l.grossAmount), 0),
    orders: (orders as { createdAt: Date }[]).filter((o) => o.createdAt >= start && o.createdAt < end).length,
    newUsers: (users as { createdAt: Date }[]).filter((u) => u.createdAt >= start && u.createdAt < end).length,
  }));
}

export interface RetentionMonth {
  month: string;
  newAuthors: number;
  activeAuthors: number;
  newAffiliates: number;
  activeAffiliates: number;
}

/**
 * Author/affiliate retention — "new joins vs active retention per
 * month" (Amendment 12). "Active" is defined sensibly, per the task's
 * own suggestion, as having at least one real, PAID sale/earning event
 * in that specific month — not simply being registered. This correctly
 * counts an author/affiliate who joined months ago and is still
 * selling/earning as "active" every month they do, and a dormant one
 * as inactive the moment their sales stop, which registration-based
 * "active" never could.
 *
 * HONESTY CHECK: AffiliateProfile has no `createdAt` of its own (see
 * prisma/schema.prisma) — the affiliate capability is a bolt-on created
 * at signup time, not a separately-dated upgrade — so "new affiliate"
 * here is approximated by that user's own account `createdAt`, same as
 * "new author". For the overwhelming majority of accounts (affiliate
 * capability is granted at signup) this is exact; it would only be
 * slightly off for an account that gained affiliate capability well
 * after its original signup month, which this schema has no timestamp
 * for at all.
 */
export async function getAuthorAffiliateRetention(): Promise<RetentionMonth[]> {
  const months = recentMonths();
  const windowStart = months[0].start;

  const [newAuthorUsers, newAffiliateUsers, activeAuthorSales, activeAffiliateSales] = await Promise.all([
    prisma.user.findMany({
      where: { role: "AUTHOR", authorProfile: { isNot: null }, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { affiliateProfile: { isNot: null }, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    // One row per (authorId, saleLine month) pair is all that's needed
    // to know WHICH author earned money in WHICH month — dedup happens
    // per month below, not here, since the same author having 50 sales
    // in a month must still only count once.
    prisma.saleLine.findMany({
      where: { createdAt: { gte: windowStart }, order: { status: "PAID" }, authorShare: { gt: 0 } },
      select: { createdAt: true, book: { select: { authorId: true } } },
    }),
    prisma.saleLine.findMany({
      where: {
        createdAt: { gte: windowStart },
        order: { status: "PAID" },
        OR: [{ affiliateShare: { gt: 0 } }, { authorReferralShare: { gt: 0 } }],
      },
      select: { createdAt: true, affiliateLink: { select: { affiliateId: true } }, authorReferralAffiliateId: true },
    }),
  ]);

  return months.map(({ key, start, end }) => {
    const inMonth = <T extends { createdAt: Date }>(rows: T[]) => rows.filter((r) => r.createdAt >= start && r.createdAt < end);

    const newAuthors = inMonth(newAuthorUsers as { createdAt: Date }[]).length;
    const newAffiliates = inMonth(newAffiliateUsers as { createdAt: Date }[]).length;

    const activeAuthorIds = new Set(
      inMonth(activeAuthorSales as { createdAt: Date; book: { authorId: string } }[]).map((l) => l.book.authorId)
    );
    const activeAffiliateIds = new Set<string>();
    for (const l of inMonth(activeAffiliateSales as { createdAt: Date; affiliateLink: { affiliateId: string } | null; authorReferralAffiliateId: string | null }[])) {
      if (l.affiliateLink?.affiliateId) activeAffiliateIds.add(l.affiliateLink.affiliateId);
      if (l.authorReferralAffiliateId) activeAffiliateIds.add(l.authorReferralAffiliateId);
    }

    return {
      month: key,
      newAuthors,
      activeAuthors: activeAuthorIds.size,
      newAffiliates,
      activeAffiliates: activeAffiliateIds.size,
    };
  });
}

export interface InvestorOverview {
  growth: GrowthMonth[];
  retention: RetentionMonth[];
}

export async function getInvestorOverview(): Promise<InvestorOverview> {
  const [growth, retention] = await Promise.all([getRevenueAndOrderGrowth(), getAuthorAffiliateRetention()]);
  return { growth, retention };
}
