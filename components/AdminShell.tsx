import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { SignOutButton } from "./SignOutButton";

/**
 * The backend shell for ADMIN/EDITOR — a new surface with no equivalent in
 * the original frontend. Deliberately distinct dark theme (see
 * app/admin/admin.css) rather than the storefront's cream/coral palette,
 * since sharing that look was flagged as a real problem: a backend panel
 * reusing the consumer storefront's exact visual identity reads as
 * unfinished, not intentional. EDITOR sees a reduced nav (no financial/
 * user-management access, per the brief's "Editor cannot access financial
 * information" rule).
 */
function navItemsForRole(role: Role) {
  if (role === "ACCOUNTANT") {
    return [
      { key: "dashboard", label: "Dashboard", href: "/admin" },
      { key: "analytics", label: "Analytics", href: "/admin/analytics" },
      { key: "transactions", label: "Transactions", href: "/admin/transactions" },
      { key: "payouts", label: "Payout Requests", href: "/admin/payouts" },
    ];
  }

  const base = [
    { key: "dashboard", label: "Dashboard", href: "/admin" },
    { key: "books", label: "Book Management", href: "/admin/books" },
    { key: "blog", label: "Blog Moderation", href: "/admin/blog" },
    { key: "analytics", label: "Analytics", href: "/admin/analytics" },
  ];
  if (role === "ADMIN") {
    return [
      ...base,
      { key: "site-settings", label: "Site Settings", href: "/admin/site-settings" },
      { key: "users", label: "Users", href: "/admin/users" },
      { key: "coupons", label: "Coupons", href: "/admin/coupons" },
      { key: "payouts", label: "Payout Requests", href: "/admin/payouts" },
      { key: "transactions", label: "Transactions", href: "/admin/transactions" },
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
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">GC</div>
          <div className="admin-brand-text">
            The Good Child
            <small>Backend</small>
          </div>
        </div>
        <div className="admin-user">
          <div className="admin-user-avatar">{initials}</div>
          <div>
            <div className="admin-user-name">{displayName}</div>
            <div className="admin-user-role">{role === "ADMIN" ? "Admin" : role === "EDITOR" ? "Editor" : "Accountant"}</div>
          </div>
        </div>
        <nav aria-label="Admin navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((it) => (
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
        <SignOutButton className="admin-signout" callbackUrl="/admin/login" />
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
