import { prisma } from "@/lib/prisma";

export interface PayoutStatementTitleRow {
  title: string;
  isbn: string;
  format: string;
  price: number;
  copies: number;
  gross: number;
  companyShare: number;
  affiliateShare: number;
  authorEarnings: number;
}

export interface PayoutStatementReferralRow {
  authorName: string;
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
  titleRows: PayoutStatementTitleRow[];
  referralRows: PayoutStatementReferralRow[];
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
          affiliateLinks: { include: { saleLines: { where: { createdAt: { gte: start, lt: end } } } } },
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
  const titleRows: PayoutStatementTitleRow[] = [];
  for (const b of books as { title: string; isbn: string | null; price: unknown; saleLines: { format: string | null; grossAmount: unknown; companyShare: unknown; authorShare: unknown; affiliateShare: unknown; affiliateLinkId: string | null }[] }[]) {
    if (b.saleLines.length === 0) continue;
    let copies = 0, gross = 0, companyShare = 0, affiliateShare = 0, authorEarnings = 0;
    let format = "";
    for (const l of b.saleLines) {
      copies += 1;
      gross += Number(l.grossAmount);
      companyShare += Number(l.companyShare);
      affiliateShare += Number(l.affiliateShare);
      authorEarnings += Number(l.authorShare);
      format = l.format || format;
      if (l.affiliateLinkId) affiliateChannelRevenue += Number(l.authorShare);
      else organicRevenue += Number(l.authorShare);
    }
    titleRows.push({
      title: b.title,
      isbn: b.isbn || "—",
      format: format || "—",
      price: Number(b.price),
      copies,
      gross,
      companyShare,
      affiliateShare,
      authorEarnings,
    });
  }

  const promotionLines = (user.affiliateProfile?.affiliateLinks ?? []).flatMap(
    (l: { saleLines: { affiliateShare: unknown }[] }) => l.saleLines.map((s) => Number(s.affiliateShare))
  );
  const promotionCommission = promotionLines.reduce((a: number, b: number) => a + b, 0);

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
      referralByAuthor.set(key, { authorName: authorUser.name, accountId: displayAccountId(authorUser.id), grossRevenue: 0, companyRevenue: 0, commission: 0 });
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
    titleRows,
    referralRows: Array.from(referralByAuthor.values()),
  };
}
