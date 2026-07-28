"use client";

import { useMemo, useState } from "react";
import { ColHelp } from "@/components/ColHelp";

export interface BookSalesRow {
  date: string;
  title: string;
  format: string;
  saleType: string;
  price: number;
  company: number;
  affiliate: number;
  share: number;
  units: number;
}

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Always renders inside its own card, whether there's real data or
 * not — a real search box, separate Month and Year dropdowns (not
 * combined), filtering the actual rows already loaded (not a separate
 * query), with a live royalty total for whatever's currently filtered. */
export function BookSalesTable({ rows }: { rows: BookSalesRow[] }) {
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");

  const years = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(String(new Date(r.date).getFullYear()));
    return Array.from(seen).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.date);
      if (month !== "all" && d.getMonth() !== Number(month)) return false;
      if (year !== "all" && d.getFullYear() !== Number(year)) return false;
      return true;
    });
  }, [rows, month, year]);

  const filteredTotal = filtered.reduce((s, r) => s + r.share * r.units, 0);

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5 }}>
          Royalty for this query: <strong>${filteredTotal.toFixed(2)}</strong>
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
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No sales recorded yet.</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No sales in this period.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Date<ColHelp text="The date of the most recent sale in this row. Every sale here shares the exact same book, format, sale type, and price — the date shown is simply the latest one among them." /></th>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The title of the book that was sold." /></th>
                <th style={TABLE_HEAD_STYLE}>Format<ColHelp text="The edition purchased: eBook, Paperback, Hardcover, or Audiobook. Each format can have its own price, so it's tracked separately." /></th>
                <th style={TABLE_HEAD_STYLE}>Sale Type<ColHelp text="Organic means the customer found and bought the book directly, with no affiliate link involved. Affiliate means they bought it after clicking someone's promotional link, which earns that affiliate a commission out of the company's share." /></th>
                <th style={TABLE_HEAD_STYLE}>Price<ColHelp text="The price the customer paid for one copy in this format. If this book's price ever changes, sales at the old and new price appear as separate rows." /></th>
                <th style={TABLE_HEAD_STYLE}>Company<ColHelp text="The company's cut of a single copy at this price: normally 25%, or a smaller share if part of it was carved out to pay an affiliate's referral commission." /></th>
                <th style={TABLE_HEAD_STYLE}>Affiliate<ColHelp text="The commission an affiliate earns on a single copy sold through their link: 10% of the price. Always $0.00 for organic sales, since no affiliate was involved." /></th>
                <th style={TABLE_HEAD_STYLE}>Share<ColHelp text="Your royalty rate for a single copy at this price: what you personally earn per book sold, before multiplying by how many were sold." /></th>
                <th style={TABLE_HEAD_STYLE}>Units<ColHelp text="How many copies were sold at exactly this price, in this format, under this sale type. If the price changes, or a sale happens through an affiliate instead of organically, that becomes its own separate row with its own count." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalty<ColHelp text="Your total earnings for this whole row: Share multiplied by Units. This is the actual amount you're owed for all the copies sold under this exact condition." /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td style={TABLE_CELL_STYLE}>{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={TABLE_CELL_STYLE}>{r.title}</td>
                  <td style={TABLE_CELL_STYLE}>{r.format}</td>
                  <td style={TABLE_CELL_STYLE}><span className="age-pill">{r.saleType === "AFFILIATE" ? "Affiliate" : "Organic"}</span></td>
                  <td style={TABLE_CELL_STYLE}>${r.price.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>${r.company.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>${r.affiliate.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>${r.share.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>{r.units}</td>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${(r.share * r.units).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
