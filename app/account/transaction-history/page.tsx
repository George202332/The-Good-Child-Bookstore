import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getAuthorTransactions } from "@/actions/author-transactions";
import { getMyPurchases } from "@/actions/my-purchases";

/**
 * This route is reached from two different nav items pointing at the
 * same href: the Reader's "Transactions" (Details section) and, until
 * now, the Author's own transaction history. To keep both working —
 * previously a Reader landing here was redirected straight back to
 * /account, since this page only ever handled the Author case — it now
 * branches on role: a Reader sees their own purchases (the same data
 * as the Author's separate, newer "Transactions" page under Financial,
 * see app/account/my-transactions/page.tsx), and an Author keeps seeing
 * this page's original view of sales received plus payouts.
 */
export default async function AuthorTransactionHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AUTHOR" && role !== "READER") redirect("/account");

  if (role === "READER") {
    const purchaseRows = await getMyPurchases();
    return (
      <DashboardShell role="READER" activeKey="transaction-history" displayName={session.user.name ?? ""}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15.5 }}>Transactions</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every purchase you&apos;ve made.</p>
          </div>
        </div>
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Order", "Date", "Detail", "Method", "Amount", "Status"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchaseRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    You haven&apos;t made a purchase yet.
                  </td>
                </tr>
              ) : (
                purchaseRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                      {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.detail}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.method}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${r.amount.toFixed(2)}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardShell>
    );
  }

  const rows = await getAuthorTransactions();

  return (
    <DashboardShell role="AUTHOR" activeKey="transaction-history" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Transaction History</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every sale and payout on your account.</p>
        </div>
      </div>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Transaction ID", "Date", "Type", "Book / Detail", "Method", "Amount", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                  No transactions yet — this fills in as your books sell and payouts go out.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}><span className="age-pill">{r.type}</span></td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.party}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.method}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>{r.type === "Payout" ? "-" : ""}${r.amount.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
