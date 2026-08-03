import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface AffiliateAnalytics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  countriesReached: number;
  /** Always all 12 months of the current calendar year, zero-filled —
   * a real template even before any clicks exist. */
  monthlyClicks: { month: string; clicks: number }[];
  countryBreakdown: { country: string; clicks: number }[];
  linkBreakdown: { book: string; author: string; clicks: number; conversions: number; conversionRate: number }[];
}

function emptyMonths(): { month: string; clicks: number }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => ({
    month: new Date(now.getFullYear(), i, 1).toLocaleDateString("en-US", { month: "short" }),
    clicks: 0,
  }));
}

const EMPTY: AffiliateAnalytics = {
  totalClicks: 0, totalConversions: 0, conversionRate: 0, countriesReached: 0,
  monthlyClicks: emptyMonths(), countryBreakdown: [], linkBreakdown: [],
};

/** Pure-numbers affiliate analytics — clicks, conversions, and the
 * countries those clicks came from. Deliberately no dollar figures:
 * commission and revenue already have a real home on the Referrals and
 * Revenue pages; Analytics is strictly about counts, matching how the
 * Sales analytics page already treats an author's own book sales. */
export async function getAffiliateAnalytics(): Promise<AffiliateAnalytics> {
  const session = await auth();
  if (!session?.user) return EMPTY;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      affiliateProfile: {
        include: {
          affiliateLinks: {
            include: { book: { include: { author: { include: { user: true } } } }, clicks: true, saleLines: true },
          },
        },
      },
    },
  });
  const links = (user?.affiliateProfile?.affiliateLinks ?? []) as {
    code: string;
    book: { title: string; author: { penName: string | null; user: { name: string } } } | null;
    clicks: { country: string | null; createdAt: Date }[];
    saleLines: unknown[];
  }[];
  if (links.length === 0) return EMPTY;

  const allClicks = links.flatMap((l) => l.clicks);
  const totalClicks = allClicks.length;
  const totalConversions = links.reduce((s, l) => s + l.saleLines.length, 0);
  const conversionRate = totalClicks > 0 ? +(((totalConversions / totalClicks) * 100).toFixed(1)) : 0;

  const countryCounts = new Map<string, number>();
  for (const c of allClicks) {
    const country = c.country || "Unknown";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }
  const countryBreakdown = Array.from(countryCounts.entries())
    .map(([country, clicks]) => ({ country, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 8);
  const countriesReached = countryCounts.size;

  // Jan-Dec of the current calendar year, always all 12, zero-filled.
  const now = new Date();
  const monthCounts = new Map<string, number>();
  for (let m = 0; m < 12; m++) {
    monthCounts.set(new Date(now.getFullYear(), m, 1).toLocaleDateString("en-US", { month: "short" }), 0);
  }
  for (const c of allClicks) {
    if (c.createdAt.getFullYear() !== now.getFullYear()) continue;
    const key = c.createdAt.toLocaleDateString("en-US", { month: "short" });
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthlyClicks = Array.from(monthCounts.entries()).map(([month, clicks]) => ({ month, clicks }));

  const linkBreakdown = [...links]
    .sort((a, b) => b.clicks.length - a.clicks.length)
    .map((l) => {
      const clicks = l.clicks.length;
      const conversions = l.saleLines.length;
      return {
        book: l.book?.title ?? l.code,
        author: l.book ? (l.book.author.penName || l.book.author.user.name) : "—",
        clicks,
        conversions,
        conversionRate: clicks > 0 ? +(((conversions / clicks) * 100).toFixed(1)) : 0,
      };
    });

  return { totalClicks, totalConversions, conversionRate, countriesReached, monthlyClicks, countryBreakdown, linkBreakdown };
}
