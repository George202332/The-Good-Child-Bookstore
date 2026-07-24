import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getTransactionLedger } from "@/actions/transactions";
import { canViewFinancials } from "@/lib/roles";

/** Unified transaction ledger — every sale and every payout, one table,
 * 7 columns. Financial data, so gated the same way as Analytics (Editor
 * cannot access financial information). */
export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");
  if (!canViewFinancials(role)) redirect("/admin");

  const rows = await getTransactionLedger();

  return (
    <AdminShell role={role} activeKey="transactions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Transactions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every sale and every payout, most recent first.
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No transactions recorded yet.</div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Transaction ID", "Date", "Type", "Party", "Method", "Amount", "Status"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>
                    {r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                    <span className="age-pill">{r.type}</span>
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.party}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.method}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
                    {r.type === "Payout" ? "-" : ""}${r.amount.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
