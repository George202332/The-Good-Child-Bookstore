import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyCommissions } from "@/actions/affiliate-commissions";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

export default async function CommissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const rows = await getMyCommissions();

  return (
    <DashboardShell role={role} activeKey="commissions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Commissions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every commission, itemized by sale.</p>
        </div>
      </div>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Date", "Type", "Book", "Sale amount", "Your commission"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No commissions yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}><span className="age-pill">{r.type}</span></td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.bookTitle}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${r.saleAmount.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
