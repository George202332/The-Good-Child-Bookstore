"use client";

import { useState } from "react";
import { getTransactionDetail, type TransactionDetail, type TransactionRow } from "@/actions/transactions";
import { DeleteTransactionButton } from "./DeleteTransactionButton";

const TH: React.CSSProperties = {
  padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)",
  fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", textAlign: "left",
};
const TD: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

/**
 * The admin Transactions ledger — same row-click-opens-a-pop-up pattern
 * as the Users table (see app/admin/users/UsersTable.tsx): the row
 * itself shows the columns that fit, and clicking anywhere on it
 * (outside the Delete button) fetches the full record on demand via
 * getTransactionDetail and shows it in a modal with a Cancel button at
 * the top.
 */
export function TransactionsTable({ rows, canDelete }: { rows: TransactionRow[]; canDelete: boolean }) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function openDetail(row: TransactionRow) {
    const kind = row.type === "Payout" ? "payout" : "sale";
    const key = `${kind}-${row.id}`;
    setLoadingKey(key);
    const result = await getTransactionDetail(row.id, kind);
    setLoadingKey(null);
    if (result) setDetail(result);
  }

  return (
    <>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Transaction ID", "Date", "Type", "Party", "Details", "Amount", "Company", "Royalty", "Commission", "Action"].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: "24px 16px", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
                  No transactions recorded yet — this table will fill in as sales and payouts happen.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const kind = r.type === "Payout" ? "payout" : "sale";
                const rowKey = `${kind}-${r.id}`;
                return (
                  <tr
                    key={rowKey}
                    onClick={() => openDetail(r)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-panel-hover, rgba(0,0,0,0.03))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={TD}><span className="age-pill">{r.type}</span></td>
                    <td style={TD}>{r.party}</td>
                    <td style={TD}>{r.detail}</td>
                    <td style={{ ...TD, fontWeight: 700 }}>{r.type === "Payout" ? "-" : ""}${r.amount.toFixed(2)}</td>
                    <td style={TD}>{r.companyShare !== null ? `$${r.companyShare.toFixed(2)}` : "—"}</td>
                    <td style={TD}>{r.authorShare !== null ? `$${r.authorShare.toFixed(2)}` : "—"}</td>
                    <td style={{ ...TD, color: r.affiliateShare ? "#1F6B48" : "var(--ink-faint)", fontWeight: r.affiliateShare ? 700 : 400 }}>
                      {r.affiliateShare !== null ? `$${r.affiliateShare.toFixed(2)}${r.affiliateName ? ` (${r.affiliateName})` : ""}` : "—"}
                    </td>
                    <td style={TD} onClick={(e) => e.stopPropagation()}>
                      {canDelete && (
                        loadingKey === rowKey ? (
                          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Loading…</span>
                        ) : (
                          <DeleteTransactionButton id={r.id} type={kind} detail={r.detail} />
                        )
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(detail || loadingKey) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{ background: "var(--admin-panel)", border: "1px solid var(--admin-border)", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: detail ? 4 : 0 }}>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setDetail(null)}>Cancel</button>
            </div>
            {!detail ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading…</div>
            ) : (
              <div>
                <h3 style={{ fontSize: 17, marginBottom: 4 }}>{detail.type}</h3>
                <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 16 }}>
                  #{detail.id.slice(0, 8).toUpperCase()} · {detail.status}
                </p>
                <DetailRow label="Date" value={new Date(detail.date).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} />
                <DetailRow label={detail.kind === "payout" ? "Recipient" : "Buyer"} value={`${detail.party} (${detail.partyEmail})`} />
                <DetailRow label="Amount" value={`$${detail.amount.toFixed(2)}`} />

                {detail.kind === "sale" ? (
                  <>
                    <DetailRow label="Book" value={detail.bookTitle ?? "—"} />
                    <DetailRow label="Format" value={detail.format ?? "—"} />
                    <DetailRow label="Sale type" value={detail.saleType ?? "—"} />
                    <DetailRow label="Order ID" value={detail.orderId ? detail.orderId.slice(0, 8).toUpperCase() : "—"} />
                    <DetailRow label="Company share" value={`$${(detail.companyShare ?? 0).toFixed(2)}`} />
                    <DetailRow label="Author share" value={`$${(detail.authorShare ?? 0).toFixed(2)}`} />
                    <DetailRow label="Affiliate share" value={`$${(detail.affiliateShare ?? 0).toFixed(2)}${detail.affiliateName ? ` — ${detail.affiliateName}` : ""}`} />
                    <DetailRow label="Author referral share" value={`$${(detail.authorReferralShare ?? 0).toFixed(2)}`} />
                  </>
                ) : (
                  <>
                    <DetailRow label="Currency" value={detail.currency ?? "—"} />
                    <DetailRow label="Earnings type" value={detail.earningsType ?? "—"} />
                    <DetailRow label="Wise transfer ID" value={detail.wiseTransferId ?? "—"} />
                    <DetailRow label="Failure reason" value={detail.failureReason ?? "—"} />
                    <DetailRow label="Resolved" value={detail.resolvedAt ? new Date(detail.resolvedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border)" }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--admin-text-faint)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--admin-text)" }}>{value}</div>
    </div>
  );
}
