import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { SignOutButton } from "./SignOutButton";

/**
 * The backend shell for ADMIN/EDITOR — a new surface with no equivalent in
 * the original frontend (see docs/architecture.md: Reader/Author/Affiliate
 * use the converted DashboardShell; Admin/Editor get this one instead).
 * EDITOR sees a reduced nav (no financial/user-management access, per the
 * brief's explicit "Editor cannot access financial information" rule).
 */
function navItemsForRole(role: Role) {
  const base = [
    { key: "dashboard", label: "Dashboard", href: "/admin" },
    { key: "books", label: "Book Moderation", href: "/admin/books" },
    { key: "blog", label: "Blog Moderation", href: "/admin/blog" },
    { key: "analytics", label: "Analytics", href: "/admin/analytics" },
  ];
  if (role === "ADMIN") {
    return [
      ...base,
      { key: "homepage", label: "Homepage", href: "/admin/homepage" },
      { key: "users", label: "Users", href: "/admin/users" },
      { key: "coupons", label: "Coupons", href: "/admin/coupons" },
      { key: "payouts", label: "Payout Requests", href: "/admin/payouts" },
    ];
  }
  return base;
}

export function AdminShell({
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
  const items = navItemsForRole(role);
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="wrap" style={{ padding: "40px 0 80px" }}>
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-avatar" style={{ background: "var(--lavender-deep)" }} aria-hidden>
              {initials}
            </div>
            <div className="dashboard-sidebar-username">{displayName}</div>
            <div className="dashboard-sidebar-account-type">{role === "ADMIN" ? "Admin" : "Editor"}</div>
          </div>
          <nav aria-label="Admin navigation">
            <div className="dashboard-nav-group">
              {items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  className={`dashboard-nav-link ${activeKey === it.key ? "active" : ""}`}
                  aria-current={activeKey === it.key ? "page" : undefined}
                >
                  <span>{it.label}</span>
                </Link>
              ))}
            </div>
          </nav>
          <SignOutButton />
        </aside>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
