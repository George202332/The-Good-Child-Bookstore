import { prisma } from "@/lib/prisma";

export interface PayoutStatementFormatRow {
  title: string;
  format: string;
  price: number;
  copies: number;
  gross: number;
  companyShare: number;
  yourEarnings: number;
}

export interface PayoutStatementReferralRow {
  accountId: string;
  grossRevenue: number;
  companyRevenue: number;
  commission: number;
}

export interface PayoutStatementData {
  authorName: string;
  monthLabel: string;
  payoutDate: Date;
  status: "Paid" | "Pending payout";
  organicRevenue: number;
  affiliateChannelRevenue: number;
  referralCommission: number;
  promotionCommission: number;
  totalPayout: number;
  /** Direct Sales: Organic — one row per title, reader found it directly. */
  organicRows: PayoutStatementFormatRow[];
  /** Direct Sales: Affiliate — one row per title, reader arrived via an affiliate link. */
  affiliateRows: PayoutStatementFormatRow[];
  /** Referral Commission — one row per referred author (identified by
   * account id only, per explicit instruction, not name). */
  referralRows: PayoutStatementReferralRow[];
  /** Promotion Commission — one row per title sold through this
   * person's own promotional links. */
  promotionRows: PayoutStatementFormatRow[];
}

/** A short, stable, human-looking account number derived from the
 * user's real id — just for display on the statement (this app doesn't
 * have a separate "account number" concept, so this is generated
 * deterministically rather than stored). */
function displayAccountId(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return String(h).slice(0, 8).padStart(8, "0");
}

export async function getPayoutStatementData(userId: string, monthKey: string): Promise<PayoutStatementData | null> {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr), month = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      authorProfile: {
        include: {
          books: {
            include: {
              saleLines: { where: { createdAt: { gte: start, lt: end } } },
            },
          },
        },
      },
      affiliateProfile: {
        include: {
          affiliateLinks: {
            include: {
              book: true,
              saleLines: { where: { createdAt: { gte: start, lt: end } } },
            },
          },
          authorReferralEarnings: {
            where: { createdAt: { gte: start, lt: end } },
            include: { book: { include: { author: { include: { user: true } } } } },
          },
        },
      },
    },
  });
  if (!user) return null;

  const books = user.authorProfile?.books ?? [];
  let organicRevenue = 0, affiliateChannelRevenue = 0;
  const organicByTitle = new Map<string, PayoutStatementFormatRow>();
  const affiliateByTitle = new Map<string, PayoutStatementFormatRow>();

  function addRow(map: Map<string, PayoutStatementFormatRow>, key: string, title: string, format: string, price: number, gross: number, companyShare: number, earnings: number) {
    if (!map.has(key)) map.set(key, { title, format, price, copies: 0, gross: 0, companyShare: 0, yourEarnings: 0 });
    const row = map.get(key)!;
    row.copies += 1;
    row.gross += gross;
    row.companyShare += companyShare;
    row.yourEarnings += earnings;
    row.format = format || row.format;
  }

  for (const b of books as { title: string; price: unknown; saleLines: { format: string | null; grossAmount: unknown; companyShare: unknown; authorShare: unknown; affiliateLinkId: string | null }[] }[]) {
    for (const l of b.saleLines) {
      const gross = Number(l.grossAmount), companyShare = Number(l.companyShare), earnings = Number(l.authorShare);
      const format = l.format || "—";
      if (l.affiliateLinkId) {
        affiliateChannelRevenue += earnings;
        addRow(affiliateByTitle, b.title, b.title, format, Number(b.price), gross, companyShare, earnings);
      } else {
        organicRevenue += earnings;
        addRow(organicByTitle, b.title, b.title, format, Number(b.price), gross, companyShare, earnings);
      }
    }
  }

  // Promotion Commission — this person's own promotional links, broken
  // out per title (not just a lump sum), since a report with no
  // breakdown for a whole revenue category isn't a real breakdown.
  const promotionByTitle = new Map<string, PayoutStatementFormatRow>();
  let promotionCommission = 0;
  for (const link of (user.affiliateProfile?.affiliateLinks ?? []) as {
    book: { title: string; price: unknown } | null;
    saleLines: { format: string | null; grossAmount: unknown; affiliateShare: unknown }[];
  }[]) {
    const title = link.book?.title ?? "Unspecified title";
    for (const l of link.saleLines) {
      const commission = Number(l.affiliateShare);
      promotionCommission += commission;
      addRow(promotionByTitle, title, title, l.format || "—", link.book ? Number(link.book.price) : 0, Number(l.grossAmount), 0, commission);
    }
  }

  const referralLines = (user.affiliateProfile?.authorReferralEarnings ?? []) as {
    authorReferralShare: unknown;
    grossAmount: unknown;
    companyShare: unknown;
    book: { author: { user: { name: string; id: string } } };
  }[];
  const referralByAuthor = new Map<string, PayoutStatementReferralRow>();
  for (const l of referralLines) {
    const authorUser = l.book.author.user;
    const key = authorUser.id;
    if (!referralByAuthor.has(key)) {
      referralByAuthor.set(key, { accountId: displayAccountId(authorUser.id), grossRevenue: 0, companyRevenue: 0, commission: 0 });
    }
    const row = referralByAuthor.get(key)!;
    row.grossRevenue += Number(l.grossAmount);
    row.companyRevenue += Number(l.companyShare);
    row.commission += Number(l.authorReferralShare);
  }
  const referralCommission = Array.from(referralByAuthor.values()).reduce((a, r) => a + r.commission, 0);

  const payoutDate = new Date(year, month + 1, 15);
  const payoutMonthKey = `${payoutDate.getFullYear()}-${String(payoutDate.getMonth() + 1).padStart(2, "0")}`;
  const payoutRequests = await prisma.payoutRequest.findMany({ where: { userId } });
  const matching = payoutRequests.find((p: { requestedAt: Date; status: string }) => {
    const k = `${p.requestedAt.getFullYear()}-${String(p.requestedAt.getMonth() + 1).padStart(2, "0")}`;
    return k === payoutMonthKey;
  });
  const status: PayoutStatementData["status"] = matching?.status === "PAID" ? "Paid" : "Pending payout";

  return {
    authorName: user.name,
    monthLabel: start.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    payoutDate,
    status,
    organicRevenue,
    affiliateChannelRevenue,
    referralCommission,
    promotionCommission,
    totalPayout: organicRevenue + affiliateChannelRevenue + referralCommission + promotionCommission,
    organicRows: Array.from(organicByTitle.values()),
    affiliateRows: Array.from(affiliateByTitle.values()),
    referralRows: Array.from(referralByAuthor.values()),
    promotionRows: Array.from(promotionByTitle.values()),
  };
}
