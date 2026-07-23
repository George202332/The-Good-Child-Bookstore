import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyFollowing } from "@/actions/following";

export default async function FollowingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const following = await listMyFollowing();

  return (
    <DashboardShell role="READER" activeKey="following" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Following</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Authors you follow.</p>
        </div>
      </div>
      {following.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Not following anyone yet — tap Follow on any book&apos;s author card to start.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {following.map((f) => (
            <div key={f.authorId} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13.5 }}>
              {f.name}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
