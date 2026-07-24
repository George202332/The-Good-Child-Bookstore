import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CreateUserForm } from "./CreateUserForm";
import { UserRowActions } from "./UserRowActions";
import { AdminShell } from "@/components/AdminShell";
import { listUsers } from "@/actions/users-admin";
import type { Role } from "@/lib/roles";

const ROLE_TABS: { key: Role | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "READER", label: "Reader" },
  { key: "AUTHOR", label: "Author" },
  { key: "AFFILIATE", label: "Affiliate" },
  { key: "EDITOR", label: "Editor" },
  { key: "ADMIN", label: "Admin" },
];

/**
 * Admin-only user directory — "Admin can manage all users" from the
 * brief. Supports creating any account type, filtering by role (tabs at
 * the top), and clicking through to a full view/edit page per account
 * (see /admin/users/[id]) with suspend/reactivate available both there
 * and inline in this list.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { role: roleParam } = await searchParams;
  const activeRole = (ROLE_TABS.find((t) => t.key === roleParam)?.key ?? "ALL") as Role | "ALL";

  const users = await listUsers(activeRole);

  return (
    <AdminShell role="ADMIN" activeKey="users" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Users</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>{users.length} accounts.</p>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Create a new account</h3>
      <CreateUserForm />

      <div style={{ display: "flex", gap: 6, margin: "24px 0 14px", flexWrap: "wrap" }}>
        {ROLE_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "ALL" ? "/admin/users" : `/admin/users?role=${t.key}`}
            className="admin-nav-link"
            style={{
              display: "inline-flex",
              padding: "6px 14px",
              background: activeRole === t.key ? "var(--admin-accent-soft)" : "var(--admin-panel)",
              color: activeRole === t.key ? "var(--admin-accent)" : undefined,
              fontWeight: activeRole === t.key ? 700 : 500,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="map-card" style={{ padding: "6px 16px" }}>
        {users.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
            No accounts of this type yet.
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <Link href={`/admin/users/${u.id}`} style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {u.name} {u.suspended && <span className="age-pill" style={{ marginLeft: 6, background: "var(--admin-danger, #EF6262)", color: "#fff" }}>Suspended</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{u.email} · {u.role}</div>
              </Link>
              {u.id === session.user.id ? (
                <span className="age-pill">You</span>
              ) : (
                <UserRowActions userId={u.id} currentRole={u.role} suspended={u.suspended} />
              )}
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
