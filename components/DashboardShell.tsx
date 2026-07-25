import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { SignOutButton } from "./SignOutButton";
import { getUnreadNotificationCount } from "@/actions/notifications";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

interface NavItem {
  key: string;
  label: string;
  href: string;
  section: string;
  badge?: number;
}

/** Converted from the items/sections logic in authorDashboardShell()
 * (the-good-child-bookstore_54_1.html:6503-6539). Only routes that
 * actually exist in this build are linked for now — see
 * docs/architecture.md for the list of dashboard sub-pages still to build;
 * the rest of the original's ~30 sub-pages across all three roles aren't
 * ported yet, so their nav items are intentionally left out rather than
 * linking to pages that don't exist. */
function navItemsForRole(role: Role, hasAffiliateAccess: boolean): NavItem[] {
  if (role === "READER") {
    const items: NavItem[] = [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "library", label: "My Library", href: "/account/library", section: "Library" },
      { key: "wishlist", label: "Wishlist", href: "/wishlist", section: "Library" },
      { key: "orders", label: "Orders", href: "/account/orders", section: "Library" },
      { key: "addresses", label: "Addresses", href: "/account/addresses", section: "Account extras" },
      { key: "payment-methods", label: "Payment Methods", href: "/account/payment-methods", section: "Account extras" },
      { key: "following", label: "Following", href: "/account/following", section: "Account extras" },
      { key: "reviews", label: "Reviews", href: "/account/reviews", section: "Account extras" },
      { key: "notifications", label: "Notifications", href: "/account/notifications", section: "Account extras" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Account extras" },
    ];
    if (hasAffiliateAccess) {
      items.push(
        { key: "referrals", label: "Referral Links", href: "/account/referrals", section: "Affiliate" },
        { key: "campaigns", label: "Campaigns", href: "/account/campaigns", section: "Affiliate" },
        { key: "earnings", label: "Earnings", href: "/account/earnings", section: "Affiliate" },
        { key: "payout-settings", label: "Payout Settings", href: "/account/payout-settings", section: "Affiliate" }
      );
    }
    return items;
  }
  if (role === "AFFILIATE") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "referrals", label: "Referral Links", href: "/account/referrals", section: "Affiliate" },
      { key: "campaigns", label: "Campaigns", href: "/account/campaigns", section: "Affiliate" },
      { key: "earnings", label: "Earnings", href: "/account/earnings", section: "Financial" },
      { key: "notifications", label: "Notifications", href: "/account/notifications", section: "Overview" },
      { key: "payout-settings", label: "Payout Settings", href: "/account/payout-settings", section: "Financial" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Affiliate" },
    ];
  }
  if (role === "AUTHOR") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "mybooks", label: "My Books", href: "/account/books", section: "Publishing" },
      { key: "blog", label: "Blog", href: "/account/blog", section: "Publishing" },
      { key: "analytics", label: "Analytics", href: "/account/analytics", section: "Financial" },
      { key: "revenue", label: "Revenue", href: "/account/revenue", section: "Financial" },
      { key: "transaction-history", label: "Transaction History", href: "/account/transaction-history", section: "Financial" },
      { key: "notifications", label: "Notifications", href: "/account/notifications", section: "Overview" },
      { key: "payout-settings", label: "Payout Settings", href: "/account/payout-settings", section: "Financial" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Publishing" },
    ];
  }
  return [{ key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" }];
}

const ROLE_LABEL: Record<Role, string> = {
  READER: "Reader",
  AUTHOR: "Author",
  AFFILIATE: "Affiliate",
  EDITOR: "Editor",
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
};

export async function DashboardShell({
  role,
  activeKey,
  displayName,
  children,
}: {
  role: Role;
  activeKey: string;
  displayName: string;
  children: ReactNode;
}) {
  const unread = await getUnreadNotificationCount();
  let affiliateAccess = false;
  if (role === "READER") {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (session?.user?.id) affiliateAccess = await hasAffiliateCapability(session.user.id);
  }
  const items = navItemsForRole(role, affiliateAccess).map((it) => (it.key === "notifications" ? { ...it, badge: unread || undefined } : it));
  const sections: { name: string; items: NavItem[] }[] = [];
  items.forEach((it) => {
    let sec = sections.find((s) => s.name === it.section);
    if (!sec) {
      sec = { name: it.section, items: [] };
      sections.push(sec);
    }
    sec.items.push(it);
  });
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarColor = "var(--coral)";

  return (
    <div className="wrap" style={{ padding: "40px 0 80px" }}>
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" id="dashboard-sidebar-nav">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-avatar" style={{ background: avatarColor }} aria-hidden>
              {initials}
            </div>
            <div className="dashboard-sidebar-username">{displayName}</div>
            <div className="dashboard-sidebar-account-type">{ROLE_LABEL[role]}</div>
          </div>
          <nav aria-label="Account navigation">
            {sections.map((sec) => (
              <div className="dashboard-nav-group" key={sec.name}>
                <div className="dashboard-nav-section-label">{sec.name}</div>
                {sec.items.map((it) => (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`dashboard-nav-link ${activeKey === it.key ? "active" : ""}`}
                    aria-current={activeKey === it.key ? "page" : undefined}
                  >
                    <span>{it.label}</span>
                    {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <SignOutButton />
        </aside>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
