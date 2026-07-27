import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyWallet } from "@/actions/wallet";
import { getReaderAffiliateStatus } from "@/actions/reader-affiliate";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getMyLinkPerformance } from "@/actions/affiliate-performance";
import { listMyNotifications } from "@/actions/notifications";
import { HOLD_DAYS } from "@/lib/wallet";
import { EnableAffiliateBanner } from "@/components/EnableAffiliateBanner";

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
      include: { authorProfile: { include: { books: { include: { saleLines: true } } } } },
    });
    const books = (user?.authorProfile?.books ?? []) as AuthorBook[];
    const allLines = books.flatMap((b) => b.saleLines.map((l) => ({ ...l, bookId: b.id })));
    const totalRevenue = allLines.reduce((sum: number, l: SaleLineShare) => sum + Number(l.authorShare), 0);
    const publishedCount = books.filter((b) => b.status === "PUBLISHED").length;

    const now = new Date();
    const thisMonthRevenue = allLines
      .filter((l) => l.createdAt.getFullYear() === now.getFullYear() && l.createdAt.getMonth() === now.getMonth())
      .reduce((sum, l) => sum + Number(l.authorShare), 0);

    const wallet = await getMyWallet("author");
    const holdCutoff = now.getTime() - HOLD_DAYS * 24 * 60 * 60 * 1000;
    const earliestOnHold = allLines
      .filter((l) => l.createdAt.getTime() > holdCutoff)
      .reduce<Date | null>((earliest, l) => (!earliest || l.createdAt < earliest ? l.createdAt : earliest), null);
    const nextPayoutDate = earliestOnHold ? new Date(earliestOnHold.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000) : null;

    // Sales trend — real unit counts, January through December of the
    // current calendar year.
    const monthBuckets: { label: string; count: number }[] = [];
    for (let m = 0; m < 12; m++) {
      monthBuckets.push({ label: new Date(now.getFullYear(), m, 1).toLocaleDateString("en-US", { month: "short" }), count: 0 });
    }
    for (const l of allLines) {
      if (l.createdAt.getFullYear() === now.getFullYear()) monthBuckets[l.createdAt.getMonth()].count += 1;
    }
    const maxMonthly = Math.max(1, ...monthBuckets.map((m) => m.count));

    // Format split — an honest approximation: checkout doesn't yet ask a
    // buyer which format they want, so each sale is attributed to this
    // Format split — real per-sale data now that checkout actually asks
    // which of the 4 formats (eBook/Paperback/Hardcover/Audiobook) a
    // buyer wants, rather than an after-the-fact approximation.
    const formatCounts = { ebook: 0, paperback: 0, hardcover: 0, audiobook: 0 };
    for (const l of allLines) {
      const f = l.format as keyof typeof formatCounts | null;
      if (f && f in formatCounts) formatCounts[f] += 1;
    }
    const formatTotal = Math.max(1, formatCounts.ebook + formatCounts.paperback + formatCounts.hardcover + formatCounts.audiobook);
    const formatPct = {
      ebook: Math.round((formatCounts.ebook / formatTotal) * 100),
      paperback: Math.round((formatCounts.paperback / formatTotal) * 100),
      hardcover: Math.round((formatCounts.hardcover / formatTotal) * 100),
      audiobook: Math.round((formatCounts.audiobook / formatTotal) * 100),
    };
    // SVG donut via stroke-dasharray: circumference of a r=60 circle ≈ 377.
    const circumference = 2 * Math.PI * 60;
    const ebookDash = (formatPct.ebook / 100) * circumference;
    const paperbackDash = (formatPct.paperback / 100) * circumference;
    const hardcoverDash = (formatPct.hardcover / 100) * circumference;
    const audioDash = (formatPct.audiobook / 100) * circumference;

    const isAffiliateToo = await hasAffiliateCapability(session.user.id);
    const affiliateLinks = isAffiliateToo ? await getMyLinkPerformance() : [];
    const affiliateClicks = affiliateLinks.reduce((s, l) => s + l.clicks, 0);
    const affiliateSold = affiliateLinks.reduce((s, l) => s + l.conversions, 0);
    const affiliateCommissionTotal = affiliateLinks.reduce((s, l) => s + l.commission, 0);
    const affiliateWallet = isAffiliateToo ? await getMyWallet("affiliate") : null;
    const combinedOnHold = wallet.onHold + (affiliateWallet?.onHold ?? 0);
    const combinedAvailable = wallet.available + (affiliateWallet?.available ?? 0);

    const notifications = await listMyNotifications();
    const recentActivity = notifications.slice(0, 5);

    return (
      <DashboardShell role={role} activeKey="dashboard" displayName={displayName}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>Dashboard</h2>
          </div>
        </div>

        <div className="stat-grid dashboard-color-cards" style={{ marginBottom: 28 }}>
          <div className="stat-card stat-card-blue">
            <div className="stat-label">Book sales</div>
            <div className="stat-value">${totalRevenue.toFixed(2)}</div>
            <div className="stat-sub">All time, your author share</div>
          </div>
          <div className="stat-card stat-card-purple">
            <div className="stat-label">Affiliate commission</div>
            <div className="stat-value">{isAffiliateToo ? `$${affiliateCommissionTotal.toFixed(2)}` : "—"}</div>
            <div className="stat-sub">{isAffiliateToo ? "3% author referral + 10% book commission" : "Not enrolled"}</div>
          </div>
          <div className="stat-card stat-card-amber">
            <div className="stat-label">On hold</div>
            <div className="stat-value">${combinedOnHold.toFixed(2)}</div>
            <div className="stat-sub">{nextPayoutDate ? `Releases from ${nextPayoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Nothing on hold"}</div>
          </div>
          <div className="stat-card stat-card-green">
            <div className="stat-label">Available</div>
            <div className="stat-value">${combinedAvailable.toFixed(2)}</div>
            <div className="stat-sub-row">
              <span className="stat-sub">Ready to request</span>
              <Link href="/account/payout-settings" className="stat-withdraw-btn">Withdraw</Link>
            </div>
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-label">Titles on shelf</div>
            <div className="stat-value">{books.length}</div>
            <div className="stat-sub">{publishedCount} published</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">This month</div>
            <div className="stat-value">${thisMonthRevenue.toFixed(2)}</div>
            <div className="stat-sub">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}, in progress</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales trend — {now.getFullYear()}</h3>
            {allLines.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No sales recorded yet — this chart fills in once your books start selling.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
                {monthBuckets.map((m) => (
                  <div key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-faint)", marginBottom: 4 }}>{m.count || ""}</div>
                    <div title={`${m.label}: ${m.count}`} style={{ width: "100%", background: "#1F6B48", borderRadius: "4px 4px 0 0", height: `${Math.max(3, (m.count / maxMonthly) * 110)}px` }} />
                    <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Format split</h3>
            {allLines.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No sales yet.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <svg viewBox="0 0 140 140" width={120} height={120} style={{ flexShrink: 0 }}>
                  <g transform="translate(70,70) rotate(-90)">
                    <circle r="60" fill="none" stroke="var(--line)" strokeWidth="20" />
                    <circle r="60" fill="none" stroke="#2451B7" strokeWidth="20" strokeDasharray={`${ebookDash} ${circumference}`} strokeDashoffset="0" />
                    <circle r="60" fill="none" stroke="#8A5B9E" strokeWidth="20" strokeDasharray={`${paperbackDash} ${circumference}`} strokeDashoffset={-ebookDash} />
                    <circle r="60" fill="none" stroke="#B7472A" strokeWidth="20" strokeDasharray={`${hardcoverDash} ${circumference}`} strokeDashoffset={-(ebookDash + paperbackDash)} />
                    <circle r="60" fill="none" stroke="#1F6B48" strokeWidth="20" strokeDasharray={`${audioDash} ${circumference}`} strokeDashoffset={-(ebookDash + paperbackDash + hardcoverDash)} />
                  </g>
                  <text x="70" y="66" textAnchor="middle" fontSize="11" fill="var(--ink-faint)">eBook</text>
                  <text x="70" y="82" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">{formatPct.ebook}%</text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2451B7", display: "inline-block" }} /> eBook &nbsp;{formatPct.ebook}%</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#8A5B9E", display: "inline-block" }} /> Paperback &nbsp;{formatPct.paperback}%</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#B7472A", display: "inline-block" }} /> Hardcover &nbsp;{formatPct.hardcover}%</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1F6B48", display: "inline-block" }} /> Audiobook &nbsp;{formatPct.audiobook}%</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Affiliate snapshot</h3>
            {isAffiliateToo ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}><span>Referrals</span><strong>{affiliateLinks.length}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}><span>Promo clicks</span><strong>{affiliateClicks}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span>Books sold via your links</span><strong>{affiliateSold}</strong></div>
                <Link href="/account/promotions" style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--coral-deep)" }}>Manage affiliate program →</Link>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 12 }}>
                  Authors can also be affiliates — earn commission promoting your own or other authors&apos; books.
                </p>
                <EnableAffiliateBanner />
              </>
            )}
          </div>
          <div className="map-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Nothing new yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recentActivity.map((n) => (
                  <div key={n.id} style={{ display: "flex", gap: 10 }}>
                    <div style={{ fontSize: 13.5 }}>{n.title}{n.body ? `: "${n.body}"` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (role === "AFFILIATE") {
    const wallet = await getMyWallet();
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
            <div className="stat-label">Total earned</div>
            <div className="stat-value">${wallet.totalEarned.toFixed(2)}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">On Hold</div>
            <div className="stat-value">${wallet.onHold.toFixed(2)}</div>
            <div className="stat-sub">Released after 10 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Available</div>
            <div className="stat-value">${wallet.available.toFixed(2)}</div>
            <div className="stat-sub">Ready to request</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sales</div>
            <div className="stat-value">{wallet.saleCount}</div>
            <div className="stat-sub">Through your links</div>
          </div>
        </div>
        <div className="account-links">
          <Link href="/account/referrals" className="account-link-card">
            <h4>Referral Links</h4>
            <p>Generate a promotional link and track clicks/sales.</p>
          </Link>
          <Link href="/account/earnings" className="account-link-card">
            <h4>Earnings</h4>
            <p>See your balance and request a payout.</p>
          </Link>
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
        <h3 style={{ marginBottom: 6 }}>Dashboard — in progress</h3>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>
          This account type doesn&apos;t have a dashboard here yet — see docs/architecture.md.
        </p>
      </div>
    </DashboardShell>
  );
}
