import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyPayoutRequests } from "@/actions/payouts";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/** Payout history — splitting "Payments" out from the combined Earnings
 * page. Adding/managing where money goes still lives at Payout Settings. */
export default async function PaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const rows = await getMyPayoutRequests();

  return (
    <DashboardShell role={role} activeKey="payments" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payments</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every payout you&apos;ve requested, via Wise.</p>
        </div>
        <Link href="/account/payout-settings" className="btn btn-ghost btn-small">Manage payout destinations</Link>
      </div>
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No payouts requested yet.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${r.amount.toFixed(2)} {r.currency}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>via {r.recipientLabel} · requested {r.requestedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
              </div>
              <span className="age-pill">{r.status}</span>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
