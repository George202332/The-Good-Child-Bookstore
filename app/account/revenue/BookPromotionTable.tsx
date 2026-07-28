"use client";

import { useMemo, useState } from "react";
import { ColHelp } from "@/components/ColHelp";

export interface PromotionRawRow {
  isbn: string | null;
  title: string;
  author: string;
  format: string;
  price: number;
  commission: number;
  saleDate: string;
}

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Always renders inside its own card, whether there's real data or
 * not. Filtering by month/year re-aggregates copies/commission by book
 * + format for just that window, rather than only filtering an
 * already-fixed lifetime total. */
export function BookPromotionTable({ rows }: { rows: PromotionRawRow[] }) {
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");

  const years = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(String(new Date(r.saleDate).getFullYear()));
    return Array.from(seen).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const grouped = useMemo(() => {
    const byBookFormat = new Map<string, { isbn: string | null; title: string; author: string; format: string; price: number; copies: number; commission: number }>();
    for (const r of rows) {
      if (search.trim() && !r.title.toLowerCase().includes(search.trim().toLowerCase())) continue;
      const d = new Date(r.saleDate);
      if (month !== "all" && d.getMonth() !== Number(month)) continue;
      if (year !== "all" && d.getFullYear() !== Number(year)) continue;
      const key = `${r.title}:${r.format}`;
      const existing = byBookFormat.get(key);
      if (existing) {
        existing.copies += 1;
        existing.commission += r.commission;
      } else {
        byBookFormat.set(key, { isbn: r.isbn, title: r.title, author: r.author, format: r.format, price: r.price, copies: 1, commission: r.commission });
      }
    }
    return Array.from(byBookFormat.values());
  }, [rows, search, month, year]);

  const filteredTotal = grouped.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="field revenue-search-input"
          type="text"
          placeholder="Search by book title..."
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
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No promotion earnings yet.</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No promotions match this search.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>SN/ISBN<ColHelp text="The book's ISBN, or a sequential number if it doesn't have one on file." /></th>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The title of the book you promoted and that sold." /></th>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The name (or pen name) of whoever wrote this book — not necessarily you, since you can promote any book on the shelf." /></th>
                <th style={TABLE_HEAD_STYLE}>Format<ColHelp text="Which edition sold through your link: eBook, Paperback, Hardcover, or Audiobook." /></th>
                <th style={TABLE_HEAD_STYLE}>Price<ColHelp text="The book's real listed price for this format — not a discounted checkout price, the actual price it's sold at." /></th>
                <th style={TABLE_HEAD_STYLE}>Copies<ColHelp text="How many copies of this exact book and format sold through your promotional link within the selected time window." /></th>
                <th style={TABLE_HEAD_STYLE}>Commission<ColHelp text="Your total earnings from this book within the selected time window: 10% of the price, multiplied by copies sold." /></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r, i) => (
                <tr key={`${r.title}-${r.format}-${i}`}>
                  <td style={TABLE_CELL_STYLE}>{r.isbn ?? `#${i + 1}`}</td>
                  <td style={TABLE_CELL_STYLE}>{r.title}</td>
                  <td style={TABLE_CELL_STYLE}>{r.author}</td>
                  <td style={TABLE_CELL_STYLE}>{r.format}</td>
                  <td style={TABLE_CELL_STYLE}>${r.price.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>{r.copies}</td>
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
