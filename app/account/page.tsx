import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getReaderAffiliateStatus } from "@/actions/reader-affiliate";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getMyLinkPerformance } from "@/actions/affiliate-performance";
import { listMyNotifications } from "@/actions/notifications";
import { EnableAffiliateBanner } from "@/components/EnableAffiliateBanner";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";

interface SaleLineShare {
  authorShare: unknown;
  createdAt: Date;
  format: string | null;
}
interface AuthorBook {
  id: string;
  title: string;
  status: string;
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  saleLines: SaleLineShare[];
}

interface OrderLine {
  book: { title: string };
}
interface OrderWithLines {
  id: string;
  totalAmount: unknown;
  createdAt: Date;
  lines: OrderLine[];
}

function isCurrentMonth(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Converted from accountHTML() (the-good-child-bookstore_54_1.html:6682+).
 * The reader branch is fully ported with real Prisma data (books
 * purchased, recent orders). The author/affiliate branches in the
 * original simulate an entire financial/analytics engine (monthly
 * breakdowns, referral timelines, promoted-book stats) — that's a large
 * separate build (see docs/architecture.md) and isn't ported yet, so
 * those roles get an honest "in progress" overview instead of a faked one.
 */
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const displayName = session.user.name ?? "";

  if (role === "READER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        readerProfile: { include: { orders: { include: { lines: { include: { book: true } } }, orderBy: { createdAt: "desc" } } } },
        _count: { select: { wishlists: true } },
      },
    });
    const orders = (user?.readerProfile?.orders ?? []) as OrderWithLines[];
    const booksPurchased = orders.reduce((sum: number, o: OrderWithLines) => sum + o.lines.length, 0);
    const recentOrders = orders.slice(0, 3);
    const wishlistCount = user?._count.wishlists ?? 0;
    const affiliateStatus = await getReaderAffiliateStatus();

    return (
      <DashboardShell role={role} activeKey="dashboard" displayName={displayName}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>Dashboard</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
              Welcome back, {displayName.split(" ")[0]}.
            </p>
          </div>
        </div>
        <div className="stat-grid" style={{ marginBottom: 34 }}>
          <div className="stat-card">
            <div className="stat-label">Books purchased</div>
            <div className="stat-value">{booksPurchased}</div>
            <div className="stat-sub">Lifetime library</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Downloads</div>
            <div className="stat-value">{booksPurchased}</div>
            <div className="stat-sub">Available across all devices</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Wishlist</div>
            <div className="stat-value">{wishlistCount}</div>
            <div className="stat-sub">Saved titles</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Affiliate earnings</div>
            <div className="stat-value">{affiliateStatus.enabled ? `$${affiliateStatus.totalEarnings.toFixed(2)}` : "—"}</div>
            <div className="stat-sub">{affiliateStatus.enabled ? "All time" : "Not enrolled"}</div>
          </div>
        </div>

        {!affiliateStatus.enabled && <EnableAffiliateBanner />}

        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Recent orders</h3>
        <div className="map-card" style={{ padding: "6px 16px", marginBottom: 34 }}>
          {recentOrders.length > 0 ? (
            recentOrders.map((o: OrderWithLines) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.lines.map((l: OrderLine) => l.book.title).join(", ")}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    Order #{o.id.slice(0, 8).toUpperCase()} · {o.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>${Number(o.totalAmount).toFixed(2)}</div>
              </div>
            ))
          ) : (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
              No orders yet; <Link href="/shop">browse the bookshelf</Link> to get started.
            </div>
          )}
        </div>

        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Quick actions</h3>
        <div className="account-links">
          <Link href="/account/library" className="account-link-card">
            <h4>My Library</h4>
            <p>View and download your purchased books.</p>
          </Link>
          <Link href="/wishlist" className="account-link-card">
            <h4>Wishlist</h4>
            <p>See titles you&apos;ve saved for later.</p>
          </Link>
          <Link href="/account/orders" className="account-link-card">
            <h4>Orders</h4>
            <p>Review past purchases and receipts.</p>
          </Link>
          {affiliateStatus.enabled && (
            <Link href="/account/referrals" className="account-link-card">
              <h4>Affiliate Dashboard</h4>
              <p>Track clicks, sales, and commission.</p>
            </Link>
          )}
        </div>
      </DashboardShell>
    );
  }

  if (role === "AUTHOR") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        authorProfile: { include: { books: { include: { saleLines: true } } } },
        affiliateProfile: {
          include: {
            authorReferralEarnings: true,
            affiliateLinks: { include: { saleLines: true } },
          },
        },
      },
    });
    const books = (user?.authorProfile?.books ?? []) as AuthorBook[];
    const allLines = books.flatMap((b) => b.saleLines.map((l) => ({ ...l, bookId: b.id })));

    const now = new Date();

    // Same monthly breakdown as the Revenue page's current-month row —
    // kept identical here so the Dashboard's 4 stat cards always match
    // what Revenue shows for the current month.
    const bookSalesMonthly = allLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.authorShare), 0);
    const referralEarningLines = (user?.affiliateProfile?.authorReferralEarnings ?? []) as { createdAt: Date; authorReferralShare: unknown }[];
    const referralMonthly = referralEarningLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.authorReferralShare), 0);
    const promotionSaleLines: { createdAt: Date; affiliateShare: unknown }[] = (user?.affiliateProfile?.affiliateLinks ?? []).flatMap(
      (l: { saleLines: { createdAt: Date; affiliateShare: unknown }[] }) => l.saleLines
    );
    const promotionMonthly = promotionSaleLines.filter((l) => isCurrentMonth(l.createdAt, now)).reduce((s, l) => s + Number(l.affiliateShare), 0);
    const monthlyTotal = bookSalesMonthly + referralMonthly + promotionMonthly;

    // Sales trend — real unit counts, January through December of the
    // current calendar year.
    const monthBuckets: { label: string; count: number }[] = [];
    for (let m = 0; m < 12; m++) {
      monthBuckets.push({ label: new Date(now.getFullYear(), m, 1).toLocaleDateString("en-US", { month: "short" }), count: 0 });
    }
    for (const l of allLines) {
      if (l.createdAt.getFullYear() === now.getFullYear()) monthBuckets[l.createdAt.getMonth()].count += 1;
    }

    // Format split — real per-sale data now that checkout actually asks
    // which of the 4 formats (eBook/Paperback/Hardcover/Audiobook) a
    // buyer wants, rather than an after-the-fact approximation.
    const formatCounts = { ebook: 0, paperback: 0, hardcover: 0, audiobook: 0 };
    for (const l of allLines) {
      const f = l.format as keyof typeof formatCounts | null;
      if (f && f in formatCounts) formatCounts[f] += 1;
    }

    const isAffiliateToo = await hasAffiliateCapability(session.user.id);
    const affiliateLinks = isAffiliateToo ? await getMyLinkPerformance() : [];
    const affiliateClicks = affiliateLinks.reduce((s, l) => s + l.clicks, 0);
    const affiliateSold = affiliateLinks.reduce((s, l) => s + l.conversions, 0);

    const notifications = await listMyNotifications();
    const recentActivity = notifications.slice(0, 20);

    return (
      <DashboardShell role={role} activeKey="dashboard" displayName={displayName}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>Dashboard</h2>
          </div>
        </div>

        <div className="stat-grid dashboard-color-cards" style={{ marginBottom: 28 }}>
          <div className="stat-card stat-card-referral">
            <div className="stat-label">Royalty</div>
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

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales trend: {now.getFullYear()}</h3>
            <BarChart data={monthBuckets.map((m) => ({ label: m.label, value: m.count }))} color="#1F6B48" />
          </div>

          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Format split</h3>
            <PieChart
              data={[
                { label: "eBook", value: formatCounts.ebook, color: "#2451B7" },
                { label: "Paperback", value: formatCounts.paperback, color: "#8A5B9E" },
                { label: "Hardcover", value: formatCounts.hardcover, color: "#B7472A" },
                { label: "Audiobook", value: formatCounts.audiobook, color: "#1F6B48" },
              ]}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="map-card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 13.5, marginBottom: 12 }}>Affiliate snapshot</h3>
            {isAffiliateToo ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span>Referrals</span><strong>{affiliateLinks.length}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span>Promo clicks</span><strong>{affiliateClicks}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span>Books sold via your links</span><strong>{affiliateSold}</strong></div>
                <Link href="/account/promotions" style={{ display: "inline-block", marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--coral-deep)" }}>Manage affiliate program →</Link>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 10 }}>
                  Authors can also be affiliates; earn commission promoting your own or other authors&apos; books.
                </p>
                <EnableAffiliateBanner />
              </>
            )}
          </div>
          <div className="map-card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 13.5, marginBottom: 12 }}>Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nothing new yet.</p>
            ) : (
              <div className="scroll-fade-no-bar" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 168, overflowY: "auto" }}>
                {recentActivity.map((n) => (
                  <div key={n.id} style={{ display: "flex", gap: 8 }}>
                    <div style={{ fontSize: 12.5 }}>{n.title}{n.body ? `: "${n.body}"` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={role} activeKey="dashboard" displayName={displayName}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Dashboard</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Welcome back, {displayName.split(" ")[0]}.
          </p>
        </div>
      </div>
      <div className="form-section" style={{ background: "var(--cream)" }}>
        <h3 style={{ marginBottom: 6 }}>Dashboard: in progress</h3>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>
          This account type doesn&apos;t have a dashboard here yet; see docs/architecture.md.
        </p>
      </div>
    </DashboardShell>
  );
}
