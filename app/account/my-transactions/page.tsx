import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyPurchases } from "@/actions/my-purchases";

/**
 * Author's "Transactions" — under Financial, below Revenue. Deliberately
 * the opposite of Revenue: this shows only purchases/payments the
 * account holder personally MADE as a customer (book orders bought
 * with their own account), never sales they've received — those stay
 * on the Revenue page. See actions/my-purchases.ts.
 */
export default async function AuthorMyTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const rows = await getMyPurchases();

  return (
    <DashboardShell role="AUTHOR" activeKey="my-transactions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Transactions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Purchases and payments you&apos;ve personally made as a customer — not sales you&apos;ve received.
          </p>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                  You haven&apos;t made a purchase yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
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
