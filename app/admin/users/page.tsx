import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { CreateUserForm } from "./CreateUserForm";
import { UserRowActions } from "./UserRowActions";
import type { Role } from "@/lib/roles";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

/**
 * Admin-only user directory — "Admin can manage all users" from the
 * brief. Now supports creating any account type directly (Reader,
 * Author, Affiliate, Editor, Admin — see actions/users-admin.ts), plus
 * changing a user's role or removing an account from the same table.
 */
export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const users = (await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  })) as UserRow[];

  return (
    <AdminShell role="ADMIN" activeKey="users" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Users</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>{users.length} accounts, most recent first.</p>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Create a new account</h3>
      <CreateUserForm />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>All accounts</h3>
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {users.map((u) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{u.email} · {u.role}</div>
            </div>
            {u.id === session.user.id ? (
              <span className="age-pill">You</span>
            ) : (
              <UserRowActions userId={u.id} currentRole={u.role} />
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
