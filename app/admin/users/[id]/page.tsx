import { redirect, notFound } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getUserDetail, getUserActivityLog } from "@/actions/users-admin";
import { getUserAdminProfile } from "@/actions/users-admin-details";
import { EditUserForm } from "./EditUserForm";
import { UserAdminDetails } from "./UserAdminDetails";
import { UserActivityLog } from "../UserActivityLog";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();
  const adminProfile = await getUserAdminProfile(id);
  const activity = await getUserActivityLog(id);

  return (
    <AdminShell role="ADMIN" activeKey="users" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{user.name}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            #{user.accountNumber} · {user.email} · {user.role} · joined {user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {user.location ? ` · ${user.location}` : ""}
            {user.suspended ? " · Suspended" : ""}
          </p>
        </div>
      </div>
      {adminProfile && <UserAdminDetails profile={adminProfile} country={{ name: user.country, source: user.countrySource }} />}
      <EditUserForm user={user} isSelf={user.id === session.user.id} />
      <div className="map-card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 400, marginBottom: 4 }}>Activity log</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 14 }}>
          Latest 200 events shown. The CSV download contains the full log (up to 5,000 events).
        </p>
        <UserActivityLog entries={activity} userId={user.id} />
      </div>
    </AdminShell>
  );
}
