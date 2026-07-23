import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

/** Admin-only user directory — "Admin can manage all users" from the brief.
 * Role changes/suspensions aren't wired up yet (read-only list for now). */
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
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {users.map((u) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{u.email}</div>
            </div>
            <span className="age-pill">{u.role}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
