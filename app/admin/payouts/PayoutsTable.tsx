"use client";

import { useMemo, useState } from "react";
import { ModerationActions } from "./ModerationActions";
import { ColHelp } from "@/components/ColHelp";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";

const TH: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.02em", textAlign: "left", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", fontSize: 12.5, verticalAlign: "top" };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The payout ledger table plus, directly above it, a search bar and
 * filters for affiliate status and for month/year — all client-side
 * over the full ledger the server already sent down, so filtering is
 * instant and never touches the moderation totals shown further up
 * the page.
 */
export function PayoutsTable({ rows, canModerate }: { rows: PayoutLedgerRow[]; canModerate: boolean }) {
  const [query, setQuery] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState<"ALL" | "AFFILIATE" | "BOOK_SALES">("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [year, setYear] = useState<string>("ALL");

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
              <th style={TH}>Account #<ColHelp text="This recipient's account number on the platform." /></th>
              <th style={TH}>Account holder<ColHelp text="The name on file with Wise for this payout — who the money is actually sent to." /></th>
              <th style={TH}>Email<ColHelp text="The recipient's account email." /></th>
              <th style={TH}>Method<ColHelp text="How this payout is sent (bank transfer, mobile money, etc.), as set up with Wise." /></th>
              <th style={TH}>Account / payment details<ColHelp text="The specific bank or mobile-money details this payout is sent to." /></th>
              <th style={TH}>Book sales<ColHelp text="This payout's share that comes from the recipient's own book sales." /></th>
              <th style={TH}>Affiliate<ColHelp text="This payout's share that comes from affiliate commission on sales the recipient referred." /></th>
              <th style={TH}>Total<ColHelp text="Book sales plus affiliate earnings combined — the full amount of this payout." /></th>
              <th style={TH}>Status<ColHelp text="Paid means the transfer has gone out. Not paid means it's still queued or awaiting approval. Rejected means it was declined." /></th>
              <th style={TH}>Requested<ColHelp text="The date this payout was queued." /></th>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "24px 10px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                  No payouts match your search or filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
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
                  <td style={TD}>{p.status === "REQUESTED" && canModerate ? <ModerationActions payoutId={p.id} /> : null}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
