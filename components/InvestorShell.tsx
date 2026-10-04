import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/investor" },
  { key: "analytics", label: "Sales Analytics", href: "/investor/sales-analytics" },
  { key: "payouts", label: "Payout Requests", href: "/investor/payouts" },
  { key: "transactions", label: "Transactions", href: "/investor/transactions" },
  { key: "overview", label: "Growth Overview", href: "/investor/overview" },
];

/**
 * The Investor role's own shell (Amendment 12) — deliberately separate
 * from AdminShell (reuses the same dark admin.css theme, loaded by
 * app/investor/layout.tsx, so it looks like the same backend product,
 * but is its own component) rather than another branch inside
 * AdminShell's navItemsForRole: a read-only role touching sensitive
 * financial data is exactly the wrong place to rely on a shared shell's
 * moderation/mutation controls all happening to stay correctly hidden.
 * There is no sign-out-and-switch-role concern here either — Investor
 * never sees a single control that writes anything, by construction:
 * every page under app/investor/** only ever calls read actions, and
 * PayoutsTable/TransactionsTable are rendered with canModerate/
 * canDelete explicitly false.
 */
export function InvestorShell({
  activeKey,
  displayName,
  children,
}: {
  activeKey: string;
  displayName: string;
  children: ReactNode;
}) {
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">GC</div>
          <div className="admin-brand-text">
            The Good Child
            <small>Investor view</small>
          </div>
        </div>
        <div className="admin-user">
          <div className="admin-user-avatar">{initials}</div>
          <div>
            <div className="admin-user-name">{displayName}</div>
            <div className="admin-user-role">Investor (read-only)</div>
          </div>
        </div>
        <nav aria-label="Investor navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              className={`admin-nav-link ${activeKey === it.key ? "active" : ""}`}
              aria-current={activeKey === it.key ? "page" : undefined}
            >
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <SignOutButton className="admin-signout" callbackUrl="/admin/login" isAdmin />
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
