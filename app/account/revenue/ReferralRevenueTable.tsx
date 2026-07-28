"use client";

import { useMemo, useState } from "react";
import { ColHelp } from "@/components/ColHelp";

export interface ReferralRawRow {
  accountId: string;
  name: string;
  dateJoined: string;
  saleDate: string;
  revenue: number;
  commission: number;
}

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Always renders inside its own card, whether there's real data or
 * not. Filtering by month/year re-aggregates by referred author for
 * just that window — e.g. "how much did referrals earn me in March" —
 * rather than only filtering an already-fixed lifetime total. */
export function ReferralRevenueTable({ rows }: { rows: ReferralRawRow[] }) {
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");

  const years = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(String(new Date(r.saleDate).getFullYear()));
    return Array.from(seen).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const grouped = useMemo(() => {
    const byAuthor = new Map<string, { accountId: string; name: string; dateJoined: string; revenue: number; commission: number }>();
    for (const r of rows) {
      if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) continue;
      const d = new Date(r.saleDate);
      if (month !== "all" && d.getMonth() !== Number(month)) continue;
      if (year !== "all" && d.getFullYear() !== Number(year)) continue;
      const existing = byAuthor.get(r.accountId);
      if (existing) {
        existing.revenue += r.revenue;
        existing.commission += r.commission;
      } else {
        byAuthor.set(r.accountId, { accountId: r.accountId, name: r.name, dateJoined: r.dateJoined, revenue: r.revenue, commission: r.commission });
      }
    }
    return Array.from(byAuthor.values());
  }, [rows, search, month, year]);

  const filteredTotal = grouped.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="field revenue-search-input"
          type="text"
          placeholder="Search by author name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <div style={{ marginLeft: "auto", fontSize: 13.5 }}>
          Commission for this query: <strong>${filteredTotal.toFixed(2)}</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No referral revenue yet.</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No referral revenue matches this search.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Account ID<ColHelp text="The unique account number belonging to the author you referred — the same number shown on their own Profile page." /></th>
                <th style={TABLE_HEAD_STYLE}>Name<ColHelp text="The referred author's name — their pen name if they've set one in their Profile, otherwise their real name." /></th>
                <th style={TABLE_HEAD_STYLE}>Date Joined<ColHelp text="The date this author created their account using your referral link." /></th>
                <th style={TABLE_HEAD_STYLE}>Revenue<ColHelp text="The company's revenue from this author's book sales within the selected time window (its 25% share, before any referral commission is carved out)." /></th>
                <th style={TABLE_HEAD_STYLE}>Commission<ColHelp text="Your earnings from referring this author within the selected time window: a percentage of the company revenue above." /></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r) => (
                <tr key={r.accountId}>
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
