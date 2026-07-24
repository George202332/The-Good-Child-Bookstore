import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getUserDetail } from "@/actions/users-admin";
import { EditUserForm } from "./EditUserForm";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  return (
    <AdminShell role="ADMIN" activeKey="users" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{user.name}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            #{user.accountNumber} · {user.role} · joined {user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {user.suspended ? " · Suspended" : ""}
          </p>
        </div>
      </div>
      <EditUserForm user={user} isSelf={user.id === session.user.id} />
    </AdminShell>
  );
}
