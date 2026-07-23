import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyWallet } from "@/actions/wallet";

interface SaleLineShare {
  authorShare: unknown;
}
interface AuthorBook {
  id: string;
  status: string;
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
      include: { readerProfile: { include: { orders: { include: { lines: { include: { book: true } } }, orderBy: { createdAt: "desc" } } } } },
    });
    const orders = (user?.readerProfile?.orders ?? []) as OrderWithLines[];
    const booksPurchased = orders.reduce((sum: number, o: OrderWithLines) => sum + o.lines.length, 0);
    const recentOrders = orders.slice(0, 3);

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
            <div className="stat-label">Orders</div>
            <div className="stat-value">{orders.length}</div>
            <div className="stat-sub">Lifetime orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Affiliate earnings</div>
            <div className="stat-value">—</div>
            <div className="stat-sub">Not enrolled</div>
          </div>
        </div>

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
    const allLines = books.flatMap((b) => b.saleLines);
    const totalRevenue = allLines.reduce((sum: number, l: SaleLineShare) => sum + Number(l.authorShare), 0);
    const totalSales = allLines.length;
    const publishedCount = books.filter((b) => b.status === "PUBLISHED").length;

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
            <div className="stat-label">Total earnings</div>
            <div className="stat-value">${totalRevenue.toFixed(2)}</div>
            <div className="stat-sub">All time, your 75%/65% share</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Books sold</div>
            <div className="stat-value">{totalSales}</div>
            <div className="stat-sub">Lifetime units</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Published books</div>
            <div className="stat-value">{publishedCount}</div>
            <div className="stat-sub">{books.length} total, all statuses</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Affiliate earnings</div>
            <div className="stat-value">—</div>
            <div className="stat-sub">Not enrolled</div>
          </div>
        </div>
        <div className="account-links">
          <Link href="/account/books" className="account-link-card">
            <h4>My Books</h4>
            <p>View your published titles and their sales.</p>
          </Link>
          <Link href="/account/revenue" className="account-link-card">
            <h4>Revenue</h4>
            <p>See your earnings broken down by book.</p>
          </Link>
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
