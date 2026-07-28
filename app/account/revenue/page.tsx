import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { BookSalesTable, type BookSalesRow } from "./BookSalesTable";
import { ReferralRevenueTable, type ReferralRawRow } from "./ReferralRevenueTable";
import { BookPromotionTable, type PromotionRawRow } from "./BookPromotionTable";

interface SaleLineRow {
  id: string;
  grossAmount: unknown;
  companyShare: unknown;
  affiliateShare: unknown;
  authorShare: unknown;
  saleType: string;
  format: string | null;
  createdAt: Date;
  book: {
    title: string;
    isbn: string | null;
    hasEbook: boolean;
    hasPrint: boolean;
    hasAudiobook: boolean;
  };
}
interface AuthorBookWithLines {
  saleLines: SaleLineRow[];
}

const FORMAT_LABEL: Record<string, string> = { ebook: "eBook", paperback: "Paperback", hardcover: "Hardcover", audiobook: "Audiobook" };

/** Every real sale always has an actual format on it going forward
 * (checkout requires picking one) — this fallback only covers sales
 * made before that existed, so the column is never blank. */
function formatLabelFor(format: string | null, book: { hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean }): string {
  if (format) return FORMAT_LABEL[format] ?? format;
  if (book.hasEbook) return "eBook";
  if (book.hasPrint) return "Hardcover";
  if (book.hasAudiobook) return "Audiobook";
  return "eBook";
}

function isCurrentMonth(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Revenue — purely informational: every dollar you've earned, broken
 * down by exactly where it came from (book sales, author referrals you
 * brought in, or book promotions via your affiliate links), with a
 * fully detailed, filterable table for each — always visible inside its
 * own card, even with zero data, rather than disappearing (which is
 * what made these look "ignored" in earlier rounds).
 */
export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      authorProfile: {
        include: {
          books: {
            include: {
              saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      affiliateProfile: {
        include: {
          authorReferralEarnings: {
            include: {
              book: {
                include: {
                  author: { include: { user: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          affiliateLinks: {
            include: {
              saleLines: { include: { book: { include: { author: { include: { user: true } } } } }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  const now = new Date();
  const books = (user?.authorProfile?.books ?? []) as AuthorBookWithLines[];
  const bookSaleLines = books.flatMap((b) => b.saleLines);
  const bookSalesTotal = bookSaleLines.reduce((s, l) => s + Number(l.authorShare), 0);
  const bookSalesMonthly = bookSaleLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.authorShare), 0);

  // Group Book Sales by book + format + sale type + price — a new row
  // only appears when one of those actually differs (e.g. the price
  // changed, or the same book sold once organically and once via an
  // affiliate link); "Units" counts how many sales fall under that
  // exact same condition. Share/Company/Affiliate are per-unit values;
  // Royalty (computed in the table itself) is Share × Units.
  const bookSalesByCondition = new Map<string, BookSalesRow>();
  for (const l of bookSaleLines) {
    const price = Number(l.grossAmount);
    const key = `${l.book.title}:${formatLabelFor(l.format, l.book)}:${l.saleType}:${price.toFixed(2)}`;
    const existing = bookSalesByCondition.get(key);
    if (existing) {
      existing.units += 1;
      if (l.createdAt.toISOString() > existing.date) existing.date = l.createdAt.toISOString();
    } else {
      bookSalesByCondition.set(key, {
        date: l.createdAt.toISOString(),
        title: l.book.title,
        format: formatLabelFor(l.format, l.book),
        saleType: l.saleType,
        price,
        company: Number(l.companyShare),
        affiliate: Number(l.affiliateShare),
        share: Number(l.authorShare),
        units: 1,
      });
    }
  }
  const bookSalesRows = Array.from(bookSalesByCondition.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  type ReferralSaleLine = {
    id: string;
    createdAt: Date;
    companyShare: unknown;
    authorReferralShare: unknown;
    book: { author: { id: string; penName: string | null; user: { name: string; accountNumber: string; createdAt: Date } } };
  };
  const referralSaleLines = (user?.affiliateProfile?.authorReferralEarnings ?? []) as ReferralSaleLine[];
  const referralMonthly = referralSaleLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.authorReferralShare), 0);
  const referralTotal = referralSaleLines.reduce((s, l) => s + Number(l.authorReferralShare), 0);

  // Raw per-sale rows passed to the client component, which groups by
  // author and re-aggregates dynamically based on whatever search/
  // month/year filter is applied — rather than a fixed lifetime total
  // that can't be filtered meaningfully.
  const referralRawRows: ReferralRawRow[] = referralSaleLines.map((l) => ({
    accountId: l.book.author.user.accountNumber,
    name: l.book.author.penName || l.book.author.user.name,
    dateJoined: l.book.author.user.createdAt.toISOString(),
    saleDate: l.createdAt.toISOString(),
    revenue: Number(l.companyShare),
    commission: Number(l.authorReferralShare),
  }));

  type PromotionSaleLine = {
    id: string;
    createdAt: Date;
    format: string | null;
    affiliateShare: unknown;
    book: {
      id: string;
      title: string;
      isbn: string | null;
      hasEbook: boolean;
      hasPrint: boolean;
      hasAudiobook: boolean;
      ebookPrice: unknown;
      paperbackPrice: unknown;
      hardcoverPrice: unknown;
      audiobookPrice: unknown;
      author: { penName: string | null; user: { name: string } };
    };
  };
  const promotionSaleLines: PromotionSaleLine[] = (user?.affiliateProfile?.affiliateLinks ?? []).flatMap(
    (l: { saleLines: PromotionSaleLine[] }) => l.saleLines
  );
  const promotionMonthly = promotionSaleLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.affiliateShare), 0);
  const promotionTotal = promotionSaleLines.reduce((s, l) => s + Number(l.affiliateShare), 0);

  function listPriceFor(book: PromotionSaleLine["book"], format: string | null): number {
    const f = format ?? (book.hasEbook ? "ebook" : book.hasPrint ? "hardcover" : "audiobook");
    const perFormat = f === "ebook" ? book.ebookPrice : f === "paperback" ? book.paperbackPrice : f === "hardcover" ? book.hardcoverPrice : book.audiobookPrice;
    return perFormat !== null && perFormat !== undefined ? Number(perFormat) : 0;
  }

  const promotionRawRows: PromotionRawRow[] = promotionSaleLines.map((l) => ({
    isbn: l.book.isbn,
    title: l.book.title,
    author: l.book.author.penName || l.book.author.user.name,
    format: formatLabelFor(l.format, l.book),
    price: listPriceFor(l.book, l.format),
    commission: Number(l.affiliateShare),
    saleDate: l.createdAt.toISOString(),
  }));

  const grandTotal = bookSalesTotal + referralTotal + promotionTotal;
  const monthlyTotal = bookSalesMonthly + referralMonthly + promotionMonthly;

  return (
    <DashboardShell role="AUTHOR" activeKey="revenue" displayName={session.user.name ?? ""}>
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Lifetime royalties</div>
          <div className="stat-value">${bookSalesTotal.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Referral revenue</div>
          <div className="stat-value">${referralTotal.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Book promotion</div>
          <div className="stat-value">${promotionTotal.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Total earnings</div>
          <div className="stat-value">${grandTotal.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Book sales</div>
          <div className="stat-value">${bookSalesMonthly.toFixed(2)}</div>
          <div className="stat-sub">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Referral revenue</div>
          <div className="stat-value">${referralMonthly.toFixed(2)}</div>
          <div className="stat-sub">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Book promotions</div>
          <div className="stat-value">${promotionMonthly.toFixed(2)}</div>
          <div className="stat-sub">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Total earnings</div>
          <div className="stat-value">${monthlyTotal.toFixed(2)}</div>
          <div className="stat-sub">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book Sales</h3>
      <div style={{ marginBottom: 28 }}>
        <BookSalesTable rows={bookSalesRows} />
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Referral Revenue</h3>
      <div style={{ marginBottom: 28 }}>
        <ReferralRevenueTable rows={referralRawRows} />
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book Promotion</h3>
      <BookPromotionTable rows={promotionRawRows} />
    </DashboardShell>
  );
}
