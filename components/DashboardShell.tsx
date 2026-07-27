import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { SignOutButton } from "./SignOutButton";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

interface NavItem {
  key: string;
  label: string;
  href: string;
  section: string;
  badge?: number;
}

/** One small line icon per nav item key — 16x16, currentColor stroke,
 * so hover/active text color changes automatically carry through. */
const NAV_ICONS: Record<string, ReactNode> = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" /></svg>,
  messages: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 5h16v12H8l-4 4V5z" /></svg>,
  security: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2z" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 4h4v16H4z" /><path d="M10 4h4v16h-4z" /><path d="M16.5 4.5l3.8 15.5-3.9 1L12.6 5.5z" /></svg>,
  wishlist: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 20C12 20 3.8 15 3.8 9.1C3.8 6.1 6.1 3.8 9 3.8C10.7 3.8 12 4.9 12 4.9C12 4.9 13.3 3.8 15 3.8C17.9 3.8 20.2 6.1 20.2 9.1C20.2 15 12 20 12 20Z" /></svg>,
  orders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M7 8.5h10l-0.8 11.2a1.5 1.5 0 0 1-1.5 1.3H9.3a1.5 1.5 0 0 1-1.5-1.3L7 8.5z" /><path d="M9 8.5V6.8a3 3 0 0 1 6 0V8.5" /></svg>,
  addresses: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>,
  "payment-methods": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>,
  following: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M17 8.5l1.5 1.5 3-3" /></svg>,
  reviews: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.9l-5.5 2.9 1.4-6.2-4.7-4.2 6.2-.6L12 3z" /></svg>,
  mybooks: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 4h4v16H4z" /><path d="M10 4h4v16h-4z" /><path d="M16.5 4.5l3.8 15.5-3.9 1L12.6 5.5z" /></svg>,
  blog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 4h16v13H8l-4 4V4z" /><path d="M8 9h8M8 12.5h5" /></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  "affiliate-analytics": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>,
  revenue: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.2 2.5-2.2s2.5.7 2.5 1.9-1 1.7-2.5 2-2.5.9-2.5 2 1.1 1.9 2.5 1.9 2.5-.8 2.5-2.2" /></svg>,
  "transaction-history": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  "payout-settings": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg>,
  referrals: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="7" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 19c0-3 2.5-5 5-5s5 2 5 5M12 19c0-3 2.5-5 5-5s5 2 5 5" /></svg>,
  promotions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 11l16-7-4 18-4-8-8-3z" /></svg>,
  "active-campaigns": <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 11l16-7-4 18-4-8-8-3z" /></svg>,
  resources: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" /><path d="M9 12l2 2 4-4" /></svg>,
  campaigns: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 11l16-7-4 18-4-8-8-3z" /></svg>,
  commissions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.2 2.5-2.2s2.5.7 2.5 1.9-1 1.7-2.5 2-2.5.9-2.5 2 1.1 1.9 2.5 1.9 2.5-.8 2.5-2.2" /></svg>,
  earnings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  performance: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>,
  payments: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg>,
};

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
      { key: "security", label: "Security", href: "/account/security", section: "Account" },
      { key: "settings", label: "Settings", href: "/account/settings", section: "Account" },
      { key: "library", label: "My Library", href: "/account/library", section: "Library" },
      { key: "wishlist", label: "Wishlist", href: "/wishlist", section: "Library" },
      { key: "orders", label: "Orders", href: "/account/orders", section: "Library" },
      { key: "addresses", label: "Addresses", href: "/account/addresses", section: "Account extras" },
      { key: "payment-methods", label: "Payment Methods", href: "/account/payment-methods", section: "Account extras" },
      { key: "following", label: "Following", href: "/account/following", section: "Account extras" },
      { key: "reviews", label: "Reviews", href: "/account/reviews", section: "Account extras" },
    ];
    if (hasAffiliateAccess) {
      items.push(
        { key: "referrals", label: "Referral Links", href: "/account/referrals", section: "Affiliate" },
        { key: "active-campaigns", label: "Active Campaigns", href: "/account/active-campaigns", section: "Affiliate" },
        { key: "promotions", label: "Promotions", href: "/account/promotions", section: "Affiliate" },
        { key: "resources", label: "Marketing Resources", href: "/account/resources", section: "Affiliate" },
        { key: "campaigns", label: "Campaigns", href: "/account/campaigns", section: "Affiliate" },
        { key: "commissions", label: "Commissions", href: "/account/commissions", section: "Affiliate" },
        { key: "earnings", label: "Earnings", href: "/account/earnings", section: "Affiliate" },
        { key: "performance", label: "Performance", href: "/account/performance", section: "Affiliate" },
        { key: "payments", label: "Payments", href: "/account/payments", section: "Affiliate" },
        { key: "payout-settings", label: "Payout Settings", href: "/account/payout-settings", section: "Affiliate" }
      );
    }
    return items;
  }
  if (role === "AFFILIATE") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Overview" },
      { key: "referrals", label: "Referral Links", href: "/account/referrals", section: "Affiliate" },
      { key: "active-campaigns", label: "Active Campaigns", href: "/account/active-campaigns", section: "Affiliate" },
      { key: "promotions", label: "Promotions", href: "/account/promotions", section: "Affiliate" },
      { key: "resources", label: "Marketing Resources", href: "/account/resources", section: "Affiliate" },
      { key: "campaigns", label: "Campaigns", href: "/account/campaigns", section: "Affiliate" },
      { key: "commissions", label: "Commissions", href: "/account/commissions", section: "Financial" },
      { key: "earnings", label: "Earnings", href: "/account/earnings", section: "Financial" },
      { key: "performance", label: "Performance", href: "/account/performance", section: "Financial" },
      { key: "payments", label: "Payments", href: "/account/payments", section: "Financial" },
      { key: "payout-settings", label: "Payout Settings", href: "/account/payout-settings", section: "Financial" },
      { key: "security", label: "Security", href: "/account/security", section: "Account" },
      { key: "settings", label: "Settings", href: "/account/settings", section: "Account" },
    ];
  }
  if (role === "AUTHOR") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/account", section: "Overview" },
      { key: "profile", label: "Profile", href: "/account/profile", section: "Overview" },
      { key: "messages", label: "Messages", href: "/account/messages", section: "Overview" },
      { key: "mybooks", label: "My Books", href: "/account/books", section: "Publishing" },
      { key: "blog", label: "My Blogs", href: "/account/blog", section: "Publishing" },
      { key: "analytics", label: "Sales", href: "/account/analytics", section: "Analytics" },
      { key: "affiliate-analytics", label: "Affiliate", href: "/account/performance", section: "Analytics" },
      { key: "revenue", label: "Revenue", href: "/account/revenue", section: "Financial" },
      { key: "transaction-history", label: "Transactions", href: "/account/transaction-history", section: "Financial" },
      { key: "payout-settings", label: "Payouts", href: "/account/payout-settings", section: "Financial" },
      { key: "referrals", label: "Referrals", href: "/account/referrals", section: "Affiliate" },
      { key: "active-campaigns", label: "Promotions", href: "/account/active-campaigns", section: "Affiliate" },
      { key: "resources", label: "Marketing", href: "/account/resources", section: "Affiliate" },
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
    <div className="wrap" style={{ padding: "37px 0 80px" }}>
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
                    {NAV_ICONS[it.key] && <span className="nav-icon">{NAV_ICONS[it.key]}</span>}
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
