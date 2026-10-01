"use client";

import { useState } from "react";
import { getTransactionDetail, type TransactionDetail, type TransactionRow } from "@/actions/transactions";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import { ColHelp } from "@/components/ColHelp";
import { Modal } from "@/components/Modal";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";

const TH: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11.5, letterSpacing: "0.03em" };
const TD: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };

const COLUMNS: { label: string; help: string }[] = [
  { label: "Transaction ID", help: "A short reference for this row — the full ID appears in the detail pop-up." },
  { label: "Date", help: "When this sale or payout happened." },
  { label: "Type", help: "Whether this row is a book Sale or a Payout." },
  { label: "Party", help: "For a sale, the buyer. For a payout, who received it." },
  { label: "Details", help: "The book and format sold, or the payout's earnings type." },
  { label: "Amount", help: "The total amount of this sale, or the amount sent out for a payout." },
  { label: "Company", help: "The company's share of this sale." },
  { label: "Royalty", help: "The author's share (royalty) of this sale." },
  { label: "Commission", help: "The affiliate's commission on this sale, and which affiliate earned it, if any." },
  { label: "Action", help: "Permanently delete this record." },
];

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
              {COLUMNS.map((c) => (
                <th key={c.label} style={TH}>{c.label}<ColHelp text={c.help} /></th>
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
        <Modal onClose={() => setDetail(null)} maxWidth={520}>
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
                    <DetailRow label="Failure reason" value={detail.failureReason ?? "—"} />
                    <DetailRow label="Resolved" value={detail.resolvedAt ? new Date(detail.resolvedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
                  </>
                )}
              </div>
            )}
        </Modal>
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
