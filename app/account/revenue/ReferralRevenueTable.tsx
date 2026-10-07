"use client";

import { useMemo, useState } from "react";
import { ColHelp } from "@/components/ColHelp";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { useRevenueHighlightActive } from "@/components/RevenueHighlight";

export interface ReferralRawRow {
  /** Opaque per-referred-author key used only for grouping rows. */
  groupKey: string;
  /** Already masked on the server (e.g. "30****01"). */
  accountId: string;
  /** Already reduced to the first name on the server. */
  name: string;
  dateJoined: string;
  saleDate: string;
  revenue: number;
  commission: number;
  /** True when this specific referral-earning line happened after the
   * last time this user viewed Revenue — see BookSalesRow.isNew for
   * the full explanation; this row is grouped by author below, so a
   * group is "new" if ANY raw line that fed into it is. */
  isNew?: boolean;
}

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Always renders inside its own card, whether there's real data or
 * not. Filtering by month/year re-aggregates by referred author for
 * just that window — e.g. "how much did referrals earn me in March" —
 * rather than only filtering an already-fixed lifetime total. */
export function ReferralRevenueTable({ rows }: { rows: ReferralRawRow[] }) {
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const highlightActive = useRevenueHighlightActive();

  const years = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(String(new Date(r.saleDate).getFullYear()));
    return Array.from(seen).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const grouped = useMemo(() => {
    const byAuthor = new Map<string, { groupKey: string; accountId: string; name: string; dateJoined: string; revenue: number; commission: number; isNew: boolean }>();
    for (const r of rows) {
      const d = new Date(r.saleDate);
      if (month !== "all" && d.getMonth() !== Number(month)) continue;
      if (year !== "all" && d.getFullYear() !== Number(year)) continue;
      const existing = byAuthor.get(r.groupKey);
      if (existing) {
        existing.revenue += r.revenue;
        existing.commission += r.commission;
        existing.isNew = existing.isNew || !!r.isNew;
      } else {
        byAuthor.set(r.groupKey, { groupKey: r.groupKey, accountId: r.accountId, name: r.name, dateJoined: r.dateJoined, revenue: r.revenue, commission: r.commission, isNew: !!r.isNew });
      }
    }
    return Array.from(byAuthor.values());
  }, [rows, month, year]);

  const filteredTotal = grouped.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="map-card tinted-peach" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5 }}>
          Commission for this query: <strong>${filteredTotal.toFixed(2)}</strong>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select className="field revenue-filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select className="field revenue-filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No referral revenue yet.</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No referral revenue in this period.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Account ID<ColHelp text="The account number of the author you referred, partly hidden for their privacy." /></th>
                <th style={TABLE_HEAD_STYLE}>Name<ColHelp text="The referred author's first name only — their pen name if they've set one in their Profile, otherwise their real name." /></th>
                <th style={TABLE_HEAD_STYLE}>Date Joined<ColHelp text="The date this author created their account using your referral link." /></th>
                <th style={TABLE_HEAD_STYLE}>Revenue<ColHelp text="The company's revenue from this author's book sales within the selected time window (its 30% share, before any referral commission is carved out)." /></th>
                <th style={TABLE_HEAD_STYLE}>Commission<ColHelp text="Your earnings from referring this author within the selected time window: a percentage of the company revenue above." /></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r) => (
                <tr key={r.groupKey} className={highlightActive && r.isNew ? "revenue-row-new" : undefined}>
                  <td style={{ ...TABLE_CELL_STYLE, fontFamily: "monospace" }}>{r.accountId}</td>
                  <td style={TABLE_CELL_STYLE}>{r.name}</td>
                  <td style={TABLE_CELL_STYLE}>{new Date(r.dateJoined).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={TABLE_CELL_STYLE}>${r.revenue.toFixed(2)}</td>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
