"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModerationActions } from "./ModerationActions";
import { ColHelp } from "@/components/ColHelp";
import { Modal } from "@/components/Modal";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { approvePayoutRequest, bulkMarkPayoutsPaid } from "@/actions/admin";
import { ledgerStatusLabel, ledgerStatusKey, ledgerStatusHelp, ledgerStatusPillStyle, PAYOUT_STATUS_FILTER_OPTIONS, STATUS_COLUMN_HELP, type PayoutStatusKey } from "@/lib/payout-status";
import { actionableIds, ledgerPeriodLabel, payableNowAmount, unreleasedPortion, isSyntheticLedgerRow } from "@/lib/payout-ledger-dedupe";
import { isRowSelectable, unselectableReason, toggleRow, toggleAll, summarizeSelection } from "@/lib/payout-selection";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** How many rows are visible at once before the table itself starts
 * scrolling internally — the totals row below stays fixed in view the
 * whole time, since it lives outside this scrolling area entirely. */
const VISIBLE_ROWS = 15;
/** Explicit size, accent and cursor so the admin theme's blanket
 * `.admin-shell input` rule (dark background and border for text
 * fields) can never make a checkbox look inert or its tick invisible. */
const CHECKBOX_STYLE: React.CSSProperties = { width: 16, height: 16, margin: 0, cursor: "pointer", accentColor: "var(--admin-accent, #2451B7)" };
const ROW_HEIGHT_PX = 42;

/** The user-facing lifecycle (lib/payout-status.ts): Rolled (under $30,
 * carried over), Live (current cycle, including anything rolled in),
 * Pending (closed, $30 or more, awaiting payment: internal SCHEDULED or
 * a queued REQUESTED request), Paid, Rejected. The label, help text and
 * colours all come from that one shared module. */
function statusLabel(p: PayoutLedgerRow): string {
  return ledgerStatusLabel(p.status, p.paid);
}

function statusPillStyle(p: PayoutLedgerRow) {
  return ledgerStatusPillStyle(p.status, p.paid);
}

/** A row's checkbox is enabled exactly when it can really be marked
 * paid (lib/payout-selection.ts isRowSelectable): every Pending row.
 * Rolled, Live, Paid and Rejected rows are disabled, with a tooltip. */
function isBulkPayable(p: PayoutLedgerRow): boolean {
  return isRowSelectable(p);
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState<"ALL" | "AFFILIATE" | "BOOK_SALES">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PayoutStatusKey>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [detailRow, setDetailRow] = useState<PayoutLedgerRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [isRowPending, startRowTransition] = useTransition();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string } | null>(null);

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
      // Checked against each column's own amount, not a single
      // isAffiliate flag — since Amendment 5's row-dedup fix, one row
      // can legitimately carry BOTH royalties and affiliate earnings
      // (an author who's also an affiliate), so it should show up
      // under either filter rather than being forced into just one.
      if (affiliateFilter === "AFFILIATE" && r.referralEarnings + r.commissionEarnings <= 0) return false;
      if (affiliateFilter === "BOOK_SALES" && r.bookSalesEarnings <= 0) return false;
      if (statusFilter !== "ALL" && ledgerStatusKey(r.status, r.paid) !== statusFilter) return false;
      const d = new Date(r.requestedAt);
      if (month !== "ALL" && d.getMonth() !== Number(month)) return false;
      if (year !== "ALL" && d.getFullYear() !== Number(year)) return false;
      return true;
    });
  }, [rows, query, affiliateFilter, statusFilter, month, year]);

  // Totals always reflect EVERY account, regardless of the current
  // search/filter selection — a search narrowing the visible rows
  // should never make the always-on totals look wrong. Referral and
  // Commission are kept as two separate running totals (not combined
  // into one "affiliate" figure) specifically so the totals row below
  // can put each one directly under its own column, same as every
  // other total here — a combined number spanning both columns is what
  // made this row look misaligned in the first place.
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          royalties: acc.royalties + r.bookSalesEarnings,
          referral: acc.referral + r.referralEarnings,
          commission: acc.commission + r.commissionEarnings,
          combined: acc.combined + r.combinedTotal,
        }),
        { royalties: 0, referral: 0, commission: 0, combined: 0 }
      ),
    [rows]
  );

  // Selection (all pure logic in lib/payout-selection.ts, unit-tested):
  // the select-all box acts on every selectable row in the CURRENT
  // filtered view; the bar's count and total cover everything ticked.
  const summary = useMemo(() => summarizeSelection(selected, filtered, rows), [selected, filtered, rows]);
  const selectableCount = useMemo(() => filtered.filter(isRowSelectable).length, [filtered]);
  const allPayableSelected = summary.allSelected;
  const somePayableSelected = summary.someSelected;
  const selectedTotal = summary.total;

  function toggleOne(id: string) {
    setSelected((prev) => toggleRow(prev, rows, id));
  }

  function toggleAllPayable() {
    setSelected((prev) => toggleAll(prev, filtered));
  }

  // The per-row "Paid" button. Goes through the same guarded server
  // actions as everything else: a queued (REQUESTED) payout is claimed
  // by approvePayoutRequest (atomic, status-guarded, twin-checked); a
  // Scheduled row has no PayoutRequest yet, so it goes through
  // bulkMarkPayoutsPaid -> payScheduledBalance, which creates the
  // request exactly once (createPayoutOnce) already PAID. Every
  // component id of a merged row is sent, minus any already paid.
  function runRowPaid(p: PayoutLedgerRow) {
    if (!isBulkPayable(p)) return;
    const ids = actionableIds(p);
    if (ids.length === 0) return;
    const amount = payableNowAmount(p);
    if (!window.confirm(`Mark the $${amount.toFixed(2)} payout to ${p.accountHolderName} as paid? This sends a "Payout sent" notification to the recipient.`)) return;
    setRowMessage(null);
    setPayingId(p.id);
    startRowTransition(async () => {
      const res = p.status === "SCHEDULED" ? await bulkMarkPayoutsPaid(ids) : await approvePayoutRequest(ids);
      setPayingId(null);
      if (!res.ok) {
        setRowMessage({ id: p.id, text: res.error ?? "Something went wrong." });
        return;
      }
      if ("updated" in res && !res.updated) {
        setRowMessage({ id: p.id, text: "Nothing was paid: it is no longer due, or was already paid. Refresh to see its status." });
        router.refresh();
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      router.refresh();
    });
  }

  function runBulkMarkPaid() {
    // A row's own `id` is what's tracked in `selected` (it's unique and
    // is what the checkboxes key off), but a merged row (see
    // lib/payout-ledger-dedupe.ts consolidateLedgerRows) carries 2 or more
    // real PayoutRequest ids behind that one row — all of them have to
    // be sent to the server or the others are left behind, un-resolved
    // (actionableIds leaves out any component already paid inside a
    // mixed row, so nothing is ever paid twice).
    const ids = summary.ids;
    if (ids.length === 0) return;
    if (!window.confirm(`Mark ${summary.count} payout${summary.count === 1 ? "" : "s"} as paid? This sends a "Payout sent" notification to each recipient.`)) return;
    setBulkMessage(null);
    startBulkTransition(async () => {
      const res = await bulkMarkPayoutsPaid(ids);
      if (!res.ok) {
        setBulkMessage(res.error ?? "Something went wrong.");
        return;
      }
      setBulkMessage(`Marked ${res.updated ?? 0} payout${res.updated === 1 ? "" : "s"} as paid.`);
      setSelected(new Set());
      router.refresh();
    });
  }

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
            <option value="BOOK_SALES">Royalties</option>
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label className="field-label field-label-compact" htmlFor="payout-status-filter">Status</label>
          <select
            id="payout-status-filter"
            className="field field-compact"
            style={{ marginBottom: 0 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | PayoutStatusKey)}
          >
            <option value="ALL">All statuses</option>
            {PAYOUT_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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
        {(query || affiliateFilter !== "ALL" || statusFilter !== "ALL" || month !== "ALL" || year !== "ALL") && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => { setQuery(""); setAffiliateFilter("ALL"); setStatusFilter("ALL"); setMonth("ALL"); setYear("ALL"); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* The bulk "Mark selected as paid" bar — only ever shown to Admins
          (Accountant and Investor stay view-only, same as the per-row
          action). Every row has a checkbox in the leftmost column, the
          header one selects all selectable rows, and only Pending rows
          can be ticked: Rolled/Live/Paid/Rejected are disabled, each
          with a tooltip saying why (lib/payout-selection.ts). */}
      {canModerate && (
        <div className="map-card" style={{ padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
            {summary.count > 0 ? `${summary.count} selected — $${selectedTotal.toFixed(2)}` : "No payouts selected"}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={summary.count === 0 || isBulkPending}
            onClick={runBulkMarkPaid}
          >
            {isBulkPending ? "Marking…" : "Mark selected as paid"}
          </button>
          {summary.count > 0 && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(new Set())} disabled={isBulkPending}>
              Clear selection
            </button>
          )}
          {bulkMessage && <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{bulkMessage}</span>}
        </div>
      )}

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
                {canModerate && (
                  <th style={{ ...TH_STYLE, width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label="Select all Pending rows"
                      title={selectableCount === 0 ? "No Pending payouts in this view to select" : "Select or deselect every Pending payout in this view"}
                      checked={allPayableSelected}
                      disabled={selectableCount === 0}
                      style={CHECKBOX_STYLE}
                      ref={(el) => {
                        if (el) el.indeterminate = somePayableSelected && !allPayableSelected;
                      }}
                      onChange={toggleAllPayable}
                    />
                  </th>
                )}
                <th style={TH_STYLE}>Account #<ColHelp text="This recipient's account number on the platform." /></th>
                <th style={TH_STYLE}>Account holder<ColHelp text="The name on file for this payout — who the money is actually sent to." /></th>
                <th style={TH_STYLE}>Email<ColHelp text="The recipient's account email." /></th>
                <th style={TH_STYLE}>Royalties<ColHelp text="This payout's share that comes from the recipient's own book sales." /></th>
                <th style={TH_STYLE}>Referral<ColHelp text="A cut of company revenue from authors this person personally referred onto the platform." /></th>
                <th style={TH_STYLE}>Commission<ColHelp text="Commission from copies sold through this person's own affiliate promotional links." /></th>
                <th style={TH_STYLE}>Total<ColHelp text="Royalties plus referral plus commission — the full amount of this payout." /></th>
                <th style={TH_STYLE}>Status<ColHelp text={STATUS_COLUMN_HELP} /></th>
                {canModerate && (
                  <th style={TH_STYLE}>Action<ColHelp text="Paid marks this payout as paid once you have sent the money. It is available only for Pending payouts (closed, $30 or more, whether or not a request has been queued yet). A Pending payout with no request yet has its request created once, already paid. Rolled, Live, Paid and Rejected rows show a dash. Everything it pays is re-checked on the server, so clicking twice never pays twice." /></th>
                )}
                <th style={TH_STYLE}>Report<ColHelp text="Download this payout's month as a full PDF statement — the same report available to that account holder on their own Payouts page." /></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canModerate ? 11 : 9} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    No payouts have been queued yet — this table fills in as soon as one is.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canModerate ? 11 : 9} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    No payouts match your search or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setDetailRow(p)}
                    className={p.paid ? "payout-row-paid" : undefined}
                    style={{ cursor: "pointer", background: p.paid ? "rgba(31,107,72,0.07)" : undefined }}
                  >
                    {canModerate && (
                      <td style={{ ...TD_STYLE, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.accountHolderName}`}
                          checked={isBulkPayable(p) && selected.has(p.id)}
                          disabled={!isBulkPayable(p)}
                          style={CHECKBOX_STYLE}
                          title={unselectableReason(p) ?? "Select this payout to mark it as paid"}
                          onChange={() => toggleOne(p.id)}
                        />
                      </td>
                    )}
                    <td style={{ ...TD_STYLE, fontFamily: "monospace" }}>{p.accountNumber}</td>
                    <td style={TD_STYLE}>
                      {p.accountHolderName}
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{p.role}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{ledgerPeriodLabel(p)}</div>
                    </td>
                    <td style={TD_STYLE}>{p.email}</td>
                    <td style={TD_STYLE}>${p.bookSalesEarnings.toFixed(2)}</td>
                    <td style={TD_STYLE}>${p.referralEarnings.toFixed(2)}</td>
                    <td style={TD_STYLE}>${p.commissionEarnings.toFixed(2)}</td>
                    <td style={{ ...TD_STYLE, fontWeight: 700 }}>
                      ${p.combinedTotal.toFixed(2)}
                      {isSyntheticLedgerRow(p) && p.unreleasedAmount !== undefined && p.unreleasedAmount > 0 && (
                        <div style={{ fontSize: 10.5, fontWeight: 400, color: "var(--ink-faint)" }}>
                          incl. ${unreleasedPortion(p).toFixed(2)} not yet released
                        </div>
                      )}
                    </td>
                    <td style={TD_STYLE}>
                      <span className="age-pill" style={statusPillStyle(p)} title={ledgerStatusHelp(p.status, p.paid)}>
                        {statusLabel(p)}
                        {p.paid && " ✓"}
                      </span>
                    </td>
                    {canModerate && (
                      <td style={TD_STYLE} onClick={(e) => e.stopPropagation()}>
                        {isBulkPayable(p) ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            disabled={isRowPending || isBulkPending}
                            title={`Mark this $${payableNowAmount(p).toFixed(2)} payout as paid`}
                            onClick={() => runRowPaid(p)}
                          >
                            {payingId === p.id ? "Paying…" : "Paid"}
                          </button>
                        ) : (
                          <span style={{ color: "var(--ink-faint)" }} title="Not payable: Rolled and Live balances are not due yet, and Paid or Rejected rows are settled">—</span>
                        )}
                        {rowMessage?.id === p.id && (
                          <div style={{ fontSize: 11, color: "var(--coral-deep)", maxWidth: 220 }}>{rowMessage.text}</div>
                        )}
                      </td>
                    )}
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
            {/*
              THE REAL FIX for the totals-row misalignment (this is at
              least the 2nd report of it): the previous "fix" treated it
              as a colSpan-count bug and recounted the cells — and that
              count was in fact already correct (11/10 on both sides
              before this round's column changes). Re-reading the actual
              markup with fresh eyes, the real root cause is structural,
              not arithmetic: the totals row used to live in a SEPARATE
              <table> element, sitting outside the scrolling wrapper div
              above. Two independent <table>s each run their own column-
              width auto-layout from their own content — matching colSpan
              math does NOT guarantee matching pixel widths across two
              separate tables, and critically, when the data table's
              content is wide enough to scroll horizontally (inside its
              own overflowX:auto wrapper) and the totals table is NOT
              inside that same scrollable wrapper, the two drift apart
              the instant the data table is scrolled sideways — the
              totals table has nothing to scroll in sync with.
              The fix: this totals row is now the LAST ROW OF THE SAME
              <table>, inside the SAME scrolling wrapper, so it shares
              the exact same column-width computation and scrolls
              perfectly in sync, horizontally, with the header/data
              above. "Stays in view while scrolling" (the original goal)
              is instead achieved with `position: sticky; bottom: 0` on
              its cells — a trick that still pins it to the bottom of the
              scrolling area without needing a second table at all.
            */}
            <tbody>
              <tr>
                <td
                  style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", fontWeight: 700, position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }}
                  colSpan={canModerate ? 4 : 3}
                >
                  Totals — all accounts
                </td>
                <td style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", fontWeight: 700, position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }}>${totals.royalties.toFixed(2)}</td>
                <td style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", fontWeight: 700, position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }}>${totals.referral.toFixed(2)}</td>
                <td style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", fontWeight: 700, position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }}>${totals.commission.toFixed(2)}</td>
                <td style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", fontWeight: 700, position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }}>${totals.combined.toFixed(2)}</td>
                <td style={{ ...TD_STYLE, borderBottom: "none", borderTop: "2px solid var(--line)", position: "sticky", bottom: 0, background: "var(--admin-panel, #F7F8FB)" }} colSpan={canModerate ? 3 : 2} />
              </tr>
            </tbody>
          </table>
        </div>
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
              { label: "Royalties", value: `$${detailRow.bookSalesEarnings.toFixed(2)}` },
              { label: "Referral earnings", value: `$${detailRow.referralEarnings.toFixed(2)}` },
              { label: "Commission earnings", value: `$${detailRow.commissionEarnings.toFixed(2)}` },
              { label: "Combined total", value: `$${detailRow.combinedTotal.toFixed(2)}` },
              ...(isSyntheticLedgerRow(detailRow) && detailRow.unreleasedAmount
                ? [{ label: "Of which not yet released (current month)", value: `$${detailRow.unreleasedAmount.toFixed(2)}` }]
                : []),
              { label: "Currency", value: detailRow.currency },
              ...(detailRow.paidAmount ? [{ label: "Already paid within this row", value: `$${detailRow.paidAmount.toFixed(2)}` }] : []),
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
              <span className="age-pill" style={statusPillStyle(detailRow)} title={ledgerStatusHelp(detailRow.status, detailRow.paid)}>
                {statusLabel(detailRow)}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  className="btn btn-ghost btn-small"
                  href={`/api/payout-report?month=${detailRow.reportMonthKey}&userId=${detailRow.userId}`}
                  title={`Download the ${detailRow.reportMonthKey} statement as a PDF`}
                >
                  Download report
                </a>
                {(detailRow.status === "REQUESTED" || detailRow.status === "APPROVED") && canModerate && <ModerationActions payoutId={actionableIds(detailRow)} />}
              </div>
            </div>
        </Modal>
      )}
    </>
  );
}
