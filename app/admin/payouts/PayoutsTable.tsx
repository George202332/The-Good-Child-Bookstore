"use client";

import { useMemo, useState } from "react";
import { ModerationActions } from "./ModerationActions";
import { ColHelp } from "@/components/ColHelp";
import { Modal } from "@/components/Modal";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** How many rows are visible at once before the table itself starts
 * scrolling internally — the totals row below stays fixed in view the
 * whole time, since it lives outside this scrolling area entirely. */
const VISIBLE_ROWS = 15;
const ROW_HEIGHT_PX = 42;

function statusPillStyle(p: PayoutLedgerRow) {
  return {
    background: p.status === "LIVE" ? "rgba(36,81,183,0.14)" : p.paid ? "rgba(31,107,72,0.15)" : p.status === "REJECTED" ? "rgba(107,115,133,0.15)" : "rgba(196,120,20,0.15)",
    color: p.status === "LIVE" ? "#2451B7" : p.paid ? "#1F6B48" : p.status === "REJECTED" ? "#6B7385" : "#8A5A0F",
  };
}

/**
 * The payout ledger table plus, directly above it, a search bar and
 * filters for affiliate status and for month/year — all client-side
 * over the full ledger the server already sent down, so filtering is
 * instant and never touches the moderation totals shown further up
 * the page.
 *
 * The row list scrolls internally after 15 entries; a totals row
 * (book sales / affiliate / combined, across every account regardless
 * of the current search or filters) sits below that scrolling area, so
 * it's always in view no matter how far the list is scrolled. Payment
 * method and account/payment details are no longer shown inline —
 * clicking a row opens a popup with those plus every other detail for
 * that account.
 */
export function PayoutsTable({ rows, canModerate }: { rows: PayoutLedgerRow[]; canModerate: boolean }) {
  const [query, setQuery] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState<"ALL" | "AFFILIATE" | "BOOK_SALES">("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [detailRow, setDetailRow] = useState<PayoutLedgerRow | null>(null);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => new Date(r.requestedAt).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const matches =
          r.accountHolderName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.accountNumber.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (affiliateFilter === "AFFILIATE" && !r.isAffiliate) return false;
      if (affiliateFilter === "BOOK_SALES" && r.isAffiliate) return false;
      const d = new Date(r.requestedAt);
      if (month !== "ALL" && d.getMonth() !== Number(month)) return false;
      if (year !== "ALL" && d.getFullYear() !== Number(year)) return false;
      return true;
    });
  }, [rows, query, affiliateFilter, month, year]);

  // Totals always reflect EVERY account, regardless of the current
  // search/filter selection — a search narrowing the visible rows
  // should never make the always-on totals look wrong.
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          bookSales: acc.bookSales + r.bookSalesEarnings,
          affiliate: acc.affiliate + r.referralEarnings + r.commissionEarnings,
          combined: acc.combined + r.combinedTotal,
        }),
        { bookSales: 0, affiliate: 0, combined: 0 }
      ),
    [rows]
  );

  return (
    <>
      <div className="map-card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <label className="field-label field-label-compact" htmlFor="payout-search">Search</label>
          <input
            id="payout-search"
            type="search"
            className="field field-compact"
            style={{ marginBottom: 0 }}
            placeholder="Name, account number, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ minWidth: 160 }}>
          <label className="field-label field-label-compact" htmlFor="payout-affiliate-filter">Affiliate status</label>
          <select
            id="payout-affiliate-filter"
            className="field field-compact"
            style={{ marginBottom: 0 }}
            value={affiliateFilter}
            onChange={(e) => setAffiliateFilter(e.target.value as "ALL" | "AFFILIATE" | "BOOK_SALES")}
          >
            <option value="ALL">All payouts</option>
            <option value="AFFILIATE">Affiliate commission</option>
            <option value="BOOK_SALES">Book sales</option>
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label className="field-label field-label-compact" htmlFor="payout-month-filter">Month</label>
          <select id="payout-month-filter" className="field field-compact" style={{ marginBottom: 0 }} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="ALL">All months</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 110 }}>
          <label className="field-label field-label-compact" htmlFor="payout-year-filter">Year</label>
          <select id="payout-year-filter" className="field field-compact" style={{ marginBottom: 0 }} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="ALL">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {(query || affiliateFilter !== "ALL" || month !== "ALL" || year !== "ALL") && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => { setQuery(""); setAffiliateFilter("ALL"); setMonth("ALL"); setYear("ALL"); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* This table is the permanent payout record — account number,
          holder name, email, book sales earnings, referral earnings,
          commission earnings, combined total, status, requested date
          and a report download for every payout ever queued. Payment
          method and full account/payment details live in the popup
          (click any row), along with every other detail for that
          account, rather than inline. It stays on screen at all times,
          with its full header row, even before any payout has ever
          been queued — an empty state renders as a row inside the
          table rather than replacing the table outright. */}
      <div className="map-card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: rows.length > VISIBLE_ROWS ? VISIBLE_ROWS * ROW_HEIGHT_PX + 34 : undefined }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Account #<ColHelp text="This recipient's account number on the platform." /></th>
                <th style={TH_STYLE}>Account holder<ColHelp text="The name on file for this payout — who the money is actually sent to." /></th>
                <th style={TH_STYLE}>Email<ColHelp text="The recipient's account email." /></th>
                <th style={TH_STYLE}>Book sales<ColHelp text="This payout's share that comes from the recipient's own book sales." /></th>
                <th style={TH_STYLE}>Referral<ColHelp text="A cut of company revenue from authors this person personally referred onto the platform." /></th>
                <th style={TH_STYLE}>Commission<ColHelp text="Commission from copies sold through this person's own affiliate promotional links." /></th>
                <th style={TH_STYLE}>Total<ColHelp text="Book sales plus referral plus commission — the full amount of this payout." /></th>
                <th style={TH_STYLE}>Status<ColHelp text="Live means the current month is still in progress and this total keeps growing as sales happen — it's not a real payout request yet. Pending means it's queued or awaiting approval. Paid means the transfer has gone out. Rejected means it was declined." /></th>
                <th style={TH_STYLE}>Requested<ColHelp text="The date this payout was queued. For a Live row, this is simply today — nothing has actually been requested yet." /></th>
                <th style={TH_STYLE}>Report<ColHelp text="Download this payout's month as a full PDF statement — the same report available to that account holder on their own Payouts page." /></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    No payouts have been queued yet — this table fills in as soon as one is.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    No payouts match your search or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} onClick={() => setDetailRow(p)} style={{ cursor: "pointer" }}>
                    <td style={{ ...TD_STYLE, fontFamily: "monospace" }}>{p.accountNumber}</td>
                    <td style={TD_STYLE}>
                      {p.accountHolderName}
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{p.role}</div>
                    </td>
                    <td style={TD_STYLE}>{p.email}</td>
                    <td style={TD_STYLE}>{p.bookSalesEarnings > 0 ? `$${p.bookSalesEarnings.toFixed(2)}` : "—"}</td>
                    <td style={TD_STYLE}>{p.referralEarnings > 0 ? `$${p.referralEarnings.toFixed(2)}` : "—"}</td>
                    <td style={TD_STYLE}>{p.commissionEarnings > 0 ? `$${p.commissionEarnings.toFixed(2)}` : "—"}</td>
                    <td style={{ ...TD_STYLE, fontWeight: 700 }}>${p.combinedTotal.toFixed(2)}</td>
                    <td style={TD_STYLE}>
                      <span className="age-pill" style={statusPillStyle(p)}>
                        {p.status === "LIVE" ? "Live" : p.paid ? "Paid" : p.status === "REJECTED" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td style={TD_STYLE}>
                      {p.status === "LIVE"
                        ? "This month (in progress)"
                        : new Date(p.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={TD_STYLE}>
                      <a
                        className="btn btn-ghost btn-small"
                        href={`/api/payout-report?month=${p.reportMonthKey}&userId=${p.userId}`}
                        title={`Download the ${p.reportMonthKey} statement as a PDF`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↓
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Static totals row — outside the scrolling area above, so it
            stays visible no matter how far the list above is scrolled.
            Always sums every account, not just the filtered/visible
            rows (see `totals`, computed from the full `rows` prop). */}
        <table style={{ width: "100%", borderCollapse: "collapse", borderTop: "2px solid var(--line)" }}>
          <tbody>
            <tr style={{ background: "var(--admin-panel, #F7F8FB)" }}>
              <td style={{ ...TD_STYLE, borderBottom: "none", fontWeight: 700 }} colSpan={3}>Totals — all accounts</td>
              <td style={{ ...TD_STYLE, borderBottom: "none", fontWeight: 700 }}>${totals.bookSales.toFixed(2)}</td>
              <td style={{ ...TD_STYLE, borderBottom: "none", fontWeight: 700 }} colSpan={2}>${totals.affiliate.toFixed(2)}</td>
              <td style={{ ...TD_STYLE, borderBottom: "none", fontWeight: 700 }}>${totals.combined.toFixed(2)}</td>
              <td style={{ ...TD_STYLE, borderBottom: "none" }} colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {detailRow && (
        <Modal onClose={() => setDetailRow(null)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>{detailRow.accountHolderName}</h3>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setDetailRow(null)}>Close</button>
            </div>
            <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginTop: 2, marginBottom: 18 }}>{detailRow.role}</p>

            {[
              { label: "Account #", value: detailRow.accountNumber },
              { label: "Email", value: detailRow.email },
              { label: "Payment method", value: detailRow.paymentMethod },
              { label: "Account / payment details", value: detailRow.accountDetails },
              { label: "Book sales earnings", value: `$${detailRow.bookSalesEarnings.toFixed(2)}` },
              { label: "Referral earnings", value: `$${detailRow.referralEarnings.toFixed(2)}` },
              { label: "Commission earnings", value: `$${detailRow.commissionEarnings.toFixed(2)}` },
              { label: "Combined total", value: `$${detailRow.combinedTotal.toFixed(2)}` },
              { label: "Currency", value: detailRow.currency },
              {
                label: "Requested",
                value: detailRow.status === "LIVE" ? "This month (in progress)" : new Date(detailRow.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              },
              {
                label: "Resolved",
                value: detailRow.resolvedAt ? new Date(detailRow.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
              },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-faint)" }}>{row.label}</span>
                <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{row.value}</span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 10, flexWrap: "wrap" }}>
              <span className="age-pill" style={statusPillStyle(detailRow)}>
                {detailRow.status === "LIVE" ? "Live" : detailRow.paid ? "Paid" : detailRow.status === "REJECTED" ? "Rejected" : "Pending"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  className="btn btn-ghost btn-small"
                  href={`/api/payout-report?month=${detailRow.reportMonthKey}&userId=${detailRow.userId}`}
                  title={`Download the ${detailRow.reportMonthKey} statement as a PDF`}
                >
                  Download report
                </a>
                {detailRow.status === "REQUESTED" && canModerate && <ModerationActions payoutId={detailRow.id} />}
              </div>
            </div>
        </Modal>
      )}
    </>
  );
}
