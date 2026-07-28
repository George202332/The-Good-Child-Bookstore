import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { ColHelp } from "@/components/ColHelp";
import { BookSalesTable, type BookSalesRow } from "./BookSalesTable";

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

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

function isCurrentMonth(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Revenue — purely informational: every dollar you've earned, broken
 * down by exactly where it came from (book sales, author referrals you
 * brought in, or book promotions via your affiliate links), with a
 * fully detailed table for each. Actually requesting or tracking a
 * payout lives on Payout Settings, the dedicated tab for moving money —
 * this page is just for understanding where your earnings come from.
 *
 * The Referral Revenue and Book Promotion tables are always rendered,
 * even for authors who haven't enabled affiliate access — they just
 * show a real empty state in that case, rather than never appearing at
 * all (which is what made them look "ignored" before).
 */
export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const isAffiliateToo = await hasAffiliateCapability(session.user.id);

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

  // Group referral earnings by the referred author — one row per author,
  // not per sale, since "Date Joined" and "Account ID" are per-author facts.
  const referralByAuthor = new Map<string, { accountId: string; name: string; dateJoined: Date; revenue: number; commission: number }>();
  for (const l of referralSaleLines) {
    const key = l.book.author.id;
    const existing = referralByAuthor.get(key);
    const revenue = Number(l.companyShare);
    const commission = Number(l.authorReferralShare);
    if (existing) {
      existing.revenue += revenue;
      existing.commission += commission;
    } else {
      referralByAuthor.set(key, {
        accountId: l.book.author.user.accountNumber,
        name: l.book.author.penName || l.book.author.user.name,
        dateJoined: l.book.author.user.createdAt,
        revenue,
        commission,
      });
    }
  }
  const referralRows = Array.from(referralByAuthor.values());
  const referralTotal = referralRows.reduce((s, r) => s + r.commission, 0);

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

  function listPriceFor(book: PromotionSaleLine["book"], format: string | null): number {
    const f = format ?? (book.hasEbook ? "ebook" : book.hasPrint ? "hardcover" : "audiobook");
    const perFormat = f === "ebook" ? book.ebookPrice : f === "paperback" ? book.paperbackPrice : f === "hardcover" ? book.hardcoverPrice : book.audiobookPrice;
    return perFormat !== null && perFormat !== undefined ? Number(perFormat) : 0;
  }

  // Group promotion earnings by book + format — "Copies" only makes
  // sense as a count across multiple sales of the same edition.
  const promotionByBookFormat = new Map<string, { isbn: string | null; title: string; author: string; format: string; price: number; copies: number; commission: number }>();
  for (const l of promotionSaleLines) {
    const formatKey = l.format ?? "ebook";
    const key = `${l.book.id}:${formatKey}`;
    const existing = promotionByBookFormat.get(key);
    const commission = Number(l.affiliateShare);
    if (existing) {
      existing.copies += 1;
      existing.commission += commission;
    } else {
      promotionByBookFormat.set(key, {
        isbn: l.book.isbn,
        title: l.book.title,
        author: l.book.author.penName || l.book.author.user.name,
        format: formatLabelFor(l.format, l.book),
        price: listPriceFor(l.book, l.format),
        copies: 1,
        commission,
      });
    }
  }
  const promotionRows = Array.from(promotionByBookFormat.values());
  const promotionTotal = promotionRows.reduce((s, r) => s + r.commission, 0);

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
      {bookSalesRows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>No sales recorded yet.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <BookSalesTable rows={bookSalesRows} />
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Referral Revenue</h3>
      {referralRows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>
          {isAffiliateToo ? "No referral revenue yet." : "Enable affiliate access from your Dashboard to start referring other authors and earning here."}
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Account ID<ColHelp text="The unique account number belonging to the author you referred — the same number shown on their own Profile page." /></th>
                <th style={TABLE_HEAD_STYLE}>Name<ColHelp text="The referred author's name — their pen name if they've set one in their Profile, otherwise their real name." /></th>
                <th style={TABLE_HEAD_STYLE}>Date Joined<ColHelp text="The date this author created their account using your referral link." /></th>
                <th style={TABLE_HEAD_STYLE}>Revenue<ColHelp text="The total amount the company itself has earned (its 25% share, before any referral commission is carved out) from every book this author has sold, added up across all their sales." /></th>
                <th style={TABLE_HEAD_STYLE}>Commission<ColHelp text="Your own earnings from referring this author: a percentage of the company's revenue above, paid to you for as long as they continue publishing with us — even on books they publish long after signing up." /></th>
              </tr>
            </thead>
            <tbody>
              {referralRows.map((r) => (
                <tr key={r.accountId}>
                  <td style={{ ...TABLE_CELL_STYLE, fontFamily: "monospace" }}>{r.accountId}</td>
                  <td style={TABLE_CELL_STYLE}>{r.name}</td>
                  <td style={TABLE_CELL_STYLE}>{r.dateJoined.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={TABLE_CELL_STYLE}>${r.revenue.toFixed(2)}</td>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book Promotion</h3>
      {promotionRows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          {isAffiliateToo ? "No promotion earnings yet." : "Enable affiliate access from your Dashboard to start promoting books and earning here."}
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>SN/ISBN<ColHelp text="The book's ISBN, or a sequential number if it doesn't have one on file." /></th>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The title of the book you promoted and that sold." /></th>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The name (or pen name) of whoever wrote this book — not necessarily you, since you can promote any book on the shelf." /></th>
                <th style={TABLE_HEAD_STYLE}>Format<ColHelp text="Which edition sold through your link: eBook, Paperback, Hardcover, or Audiobook." /></th>
                <th style={TABLE_HEAD_STYLE}>Price<ColHelp text="The book's real listed price for this format — not a discounted checkout price, the actual price it's sold at." /></th>
                <th style={TABLE_HEAD_STYLE}>Copies<ColHelp text="How many copies of this exact book and format have sold through your promotional link so far." /></th>
                <th style={TABLE_HEAD_STYLE}>Commission<ColHelp text="Your total earnings from this book: 10% of the price, multiplied by the number of copies sold through your link." /></th>
              </tr>
            </thead>
            <tbody>
              {promotionRows.map((r, i) => (
                <tr key={`${r.title}-${r.format}-${i}`}>
                  <td style={TABLE_CELL_STYLE}>{r.isbn ?? `#${i + 1}`}</td>
                  <td style={TABLE_CELL_STYLE}>{r.title}</td>
                  <td style={TABLE_CELL_STYLE}>{r.author}</td>
                  <td style={TABLE_CELL_STYLE}>{r.format}</td>
                  <td style={TABLE_CELL_STYLE}>${r.price.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>{r.copies}</td>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
