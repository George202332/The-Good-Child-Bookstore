import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyNotifications } from "@/actions/notifications";
import { MarkReadButton } from "./MarkReadButton";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR" && role !== "AFFILIATE") redirect("/admin");

  const notifications = await listMyNotifications();

  return (
    <DashboardShell role={role} activeKey="notifications" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Notifications</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Updates on your orders, submissions, and payouts.</p>
        </div>
        {notifications.some((n) => !n.read) && <MarkReadButton />}
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>Nothing yet — you&apos;re all caught up.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--line)",
                opacity: n.read ? 0.65 : 1,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>{n.body}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
