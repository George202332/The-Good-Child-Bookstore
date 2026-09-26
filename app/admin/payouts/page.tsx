import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";
import { getPayoutLedger } from "@/actions/payout-ledger";
import type { Role } from "@/lib/roles";

const TH: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.02em", textAlign: "left", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", fontSize: 12.5, verticalAlign: "top" };

/**
 * The admin payout ledger — every payout ever queued, whatever its
 * status (previously this page only showed the ones still pending
 * approval, filtered to status "REQUESTED", which is why George
 * couldn't find a record of anything already paid or rejected). See
 * actions/payout-ledger.ts for where this data comes from, and
 * app/api/admin/payout-ledger/route.ts for the CSV (Wise bulk-payment
 * format) and PDF (internal record) exports below.
 *
 * "Mark paid"/"Reject" (ModerationActions, unchanged) still only apply
 * to a row still in the REQUESTED state and are still Admin-only —
 * Accountant keeps view-only access to the whole ledger, matching the
 * existing role split.
 */
export default async function PayoutsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role as Role;
  if (role !== "ADMIN" && role !== "ACCOUNTANT") redirect("/admin");

  const ledger = await getPayoutLedger();
  const ledgerError = "error" in ledger ? ledger.error : null;
  const rows = ledgerError ? [] : (ledger as Exclude<typeof ledger, { error: string }>);

  const totals = rows.reduce(
    (acc, r) => ({
      bookSales: acc.bookSales + r.bookSalesEarnings,
      affiliate: acc.affiliate + r.affiliateEarnings,
      combined: acc.combined + r.combinedTotal,
      paidCount: acc.paidCount + (r.paid ? 1 : 0),
    }),
    { bookSales: 0, affiliate: 0, combined: 0, paidCount: 0 }
  );

  return (
    <AdminShell role={role} activeKey="payouts" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Requests</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every payout ever queued — completed, rejected, or still owed. All payouts go through Wise.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=csv" className="btn btn-primary btn-small">
            Export Wise CSV
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=pdf" className="btn btn-ghost btn-small">
            Download PDF
          </a>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Book sales earnings</div>
          <div className="stat-value">${totals.bookSales.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Affiliate earnings</div>
          <div className="stat-value">${totals.affiliate.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined total</div>
          <div className="stat-value">${totals.combined.toFixed(2)}</div>
          <div className="stat-sub">Book sales + affiliate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid / total</div>
          <div className="stat-value">{totals.paidCount} / {rows.length}</div>
          <div className="stat-sub">Payouts settled so far</div>
        </div>
      </div>

      {ledgerError && (
        <div className="map-card" style={{ padding: 16, marginBottom: 16, color: "var(--coral-deep)", fontSize: 13 }}>
          Couldn&apos;t load the payout ledger: {ledgerError}
        </div>
      )}

      {/* This table is the permanent payout record — account number, holder
          name, payment method, account/payment details plus email, book
          sales earnings, affiliate earnings, combined total, and paid/not
          paid status for every payout ever queued. It stays on screen at
          all times, with its full header row, even before any payout has
          ever been queued — an empty state renders as a row inside the
          table rather than replacing the table outright, so the account
          details it's meant to always show are never missing. */}
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Account #</th>
              <th style={TH}>Account holder</th>
              <th style={TH}>Email</th>
              <th style={TH}>Method</th>
              <th style={TH}>Account / payment details</th>
              <th style={TH}>Book sales</th>
              <th style={TH}>Affiliate</th>
              <th style={TH}>Total</th>
              <th style={TH}>Status</th>
              <th style={TH}>Requested</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                  No payouts have been queued yet — this table fills in as soon as one is.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...TD, fontFamily: "monospace" }}>{p.accountNumber}</td>
                  <td style={TD}>
                    {p.accountHolderName}
                    <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{p.role}</div>
                  </td>
                  <td style={TD}>{p.email}</td>
                  <td style={TD}>{p.paymentMethod}</td>
                  <td style={{ ...TD, maxWidth: 220, whiteSpace: "normal", wordBreak: "break-word", color: "var(--ink-soft)", fontSize: 11.5 }}>{p.accountDetails}</td>
                  <td style={TD}>{p.bookSalesEarnings > 0 ? `$${p.bookSalesEarnings.toFixed(2)}` : "—"}</td>
                  <td style={TD}>{p.affiliateEarnings > 0 ? `$${p.affiliateEarnings.toFixed(2)}` : "—"}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>${p.combinedTotal.toFixed(2)}</td>
                  <td style={TD}>
                    <span
                      className="age-pill"
                      style={{
                        background: p.paid ? "rgba(31,107,72,0.15)" : p.status === "REJECTED" ? "rgba(107,115,133,0.15)" : "rgba(196,120,20,0.15)",
                        color: p.paid ? "#1F6B48" : p.status === "REJECTED" ? "#6B7385" : "#8A5A0F",
                      }}
                    >
                      {p.paid ? "Paid" : p.status === "REJECTED" ? "Rejected" : "Not paid"}
                    </span>
                  </td>
                  <td style={TD}>{new Date(p.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={TD}>{p.status === "REQUESTED" && role === "ADMIN" ? <ModerationActions payoutId={p.id} /> : null}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
