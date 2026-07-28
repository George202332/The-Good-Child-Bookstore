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

/** A real search box + month/year filter above the Book Sales table —
 * filters the actual rows already loaded (not a separate query), and
 * shows the real royalty total for whatever's currently filtered. */
export function BookSalesTable({ rows }: { rows: BookSalesRow[] }) {
  const [search, setSearch] = useState("");
  const [monthYear, setMonthYear] = useState("all");

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!seen.has(key)) seen.set(key, d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    }
    return Array.from(seen.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search.trim() && !r.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (monthYear !== "all") {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthYear) return false;
      }
      return true;
    });
  }, [rows, search, monthYear]);

  const filteredTotal = filtered.reduce((s, r) => s + r.share * r.units, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="field"
          type="text"
          placeholder="Search by book title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280, marginBottom: 0 }}
        />
        <select className="field" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} style={{ maxWidth: 200, marginBottom: 0 }}>
          <option value="all">All time</option>
          {monthOptions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 13.5 }}>
          Royalty for this query: <strong>${filteredTotal.toFixed(2)}</strong>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No sales match this search.</div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
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
