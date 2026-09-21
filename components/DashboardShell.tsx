import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { SignOutButton } from "./SignOutButton";
import { SessionInactivityTimer } from "./SessionInactivityTimer";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { NAV_ICONS } from "./nav-icons";

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
      { key: "messages", label: "Messages", href: "/account/messages", section: "Overview" },
      { key: "library", label: "My Library", href: "/account/library", section: "Overview" },
      { key: "orders", label: "Orders", href: "/account/orders", section: "Details" },
      { key: "wishlist", label: "Wishlist", href: "/wishlist", section: "Details" },
      { key: "transaction-history", label: "Transactions", href: "/account/transaction-history", section: "Details" },
    ];
    if (hasAffiliateAccess) {
      items.push(
        { key: "blog", label: "My Blogs", href: "/account/blog", section: "Publishing" },
        { key: "referrals", label: "Referrals", href: "/account/referrals", section: "Affiliate" },
        { key: "active-campaigns", label: "Promotions", href: "/account/active-campaigns", section: "Affiliate" },
        { key: "performance", label: "Affiliate", href: "/account/performance", section: "Analytics" },
        { key: "blog-analytics", label: "Blogs", href: "/account/blog-analytics", section: "Analytics" },
        { key: "revenue", label: "Commissions", href: "/account/revenue", section: "Financial" },
        { key: "payout-settings", label: "Payouts", href: "/account/payout-settings", section: "Financial" }
      );
    }
    // Account always comes last — added after the conditional affiliate
    // sections above so it renders as the final section whenever they're
    // present, and it's still the final (and only remaining) section
    // when they're not.
    items.push({ key: "settings", label: "Settings", href: "/account/settings", section: "Account" });
    return items;
  }
  if (role === "AUTHOR") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Overview" },
      { key: "mybooks", label: "My Books", href: "/account/books", section: "Publishing" },
      { key: "blog", label: "My Blogs", href: "/account/blog", section: "Publishing" },
      { key: "referrals", label: "Referrals", href: "/account/referrals", section: "Affiliate" },
      { key: "active-campaigns", label: "Promotions", href: "/account/active-campaigns", section: "Affiliate" },
      { key: "analytics", label: "Sales", href: "/account/analytics", section: "Analytics" },
      { key: "performance", label: "Affiliate", href: "/account/performance", section: "Analytics" },
      { key: "blog-analytics", label: "Blogs", href: "/account/blog-analytics", section: "Analytics" },
      { key: "revenue", label: "Revenue", href: "/account/revenue", section: "Financial" },
      { key: "payout-settings", label: "Payouts", href: "/account/payout-settings", section: "Financial" },
      { key: "settings", label: "Settings", href: "/account/settings", section: "Account" },
    ];
  }
  return [{ key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" }];
}

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
  let affiliateAccess = false;
  if (role === "READER") {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (session?.user?.id) affiliateAccess = await hasAffiliateCapability(session.user.id);
  }
  const { getUnreadSidebarKeys, markSidebarKeyNotificationsRead } = await import("@/actions/notifications");
  const unreadSidebarKeys = await getUnreadSidebarKeys();
  // Fire-and-forget: visiting this section is itself the acknowledgment
  // for that section's notifications — no need to block rendering on it.
  markSidebarKeyNotificationsRead(activeKey).catch(() => {});

  const items = navItemsForRole(role, affiliateAccess);
  const sections: { name: string; items: NavItem[] }[] = [];
  items.forEach((it) => {
    let sec = sections.find((s) => s.name === it.section);
    if (!sec) {
      sec = { name: it.section, items: [] };
      sections.push(sec);
    }
    sec.items.push(it);
  });
  return (
    <div className="wrap" style={{ padding: "26px 0 80px" }}>
      <SessionInactivityTimer />
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" id="dashboard-sidebar-nav" aria-label={`Account menu for ${displayName}`}>
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
                    {NAV_ICONS[it.key] ? (
                      <span className={`dashboard-nav-icon ${unreadSidebarKeys.has(it.key) && activeKey !== it.key ? "has-unread" : ""}`}>
                        {NAV_ICONS[it.key]}
                        {unreadSidebarKeys.has(it.key) && activeKey !== it.key && <span className="dashboard-nav-blink-dot" aria-label="New notification" />}
                      </span>
                    ) : null}
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
