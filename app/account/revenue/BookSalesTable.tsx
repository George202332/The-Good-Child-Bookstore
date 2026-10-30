"use client";

import { Fragment, useMemo, useState } from "react";
import { ColHelp } from "@/components/ColHelp";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { useRevenueHighlightActive } from "@/components/RevenueHighlight";

export interface BookSalesRow {
  date: string;
  title: string;
  format: string;
  /** Still tracked on every row (organic vs affiliate) for the grouping
   * key upstream in app/account/revenue/page.tsx, even though its own
   * column was removed from this table (Amendment 1 — the closest
   * column to what was reported as "Cell Type"; no column by that
   * exact name ever existed here) to fix the horizontal scrollbar. Not
   * load-bearing for anything else on the Revenue page: it's never
   * filtered on, and the Company/Affiliate money columns already make
   * clear whether a sale was affiliate-referred. */
  saleType: string;
  price: number;
  /** Lulu's production printing cost for a printed copy, saved when it was ordered. null =
   * not a printed copy (shown as a dash) or a print sale made before this was recorded.
   * Never includes shipping. */
  printingCost: number | null;
  company: number;
  affiliate: number;
  share: number;
  units: number;
  /** True when at least one of the raw sales grouped into this row
   * happened after the last time this user viewed Revenue (see
   * app/account/revenue/page.tsx) — drives the highlight below, which
   * stays on until the page is clicked anywhere (see
   * components/RevenueHighlight.tsx). */
  isNew?: boolean;
}

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "9px 6px", fontSize: 10.5, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "8px 6px", fontSize: undefined, verticalAlign: undefined };
const isPrintFormat = (format: string) => /paperback|hardcover/i.test(format);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Always renders inside its own card, whether there's real data or
 * not — a real search box, separate Month and Year dropdowns (not
 * combined), filtering the actual rows already loaded (not a separate
 * query), with a live royalty total for whatever's currently filtered. */
export function BookSalesTable({ rows }: { rows: BookSalesRow[] }) {
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const highlightActive = useRevenueHighlightActive();

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
    <div className="map-card tinted-blue" style={{ padding: 20 }}>
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
        <div style={{ width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Date<ColHelp text="The date of the most recent sale in this row. Every sale here shares the exact same book, format, sale type, and price — the date shown is simply the latest one among them." /></th>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The title of the book that was sold, with its format underneath: eBook, Paperback, Hardcover, or Audiobook. Each format can have its own price, so it is tracked separately. Click a row to see the company share and the affiliate commission for one copy." /></th>
                <th style={TABLE_HEAD_STYLE}>Price<ColHelp text="The price the customer paid for one copy in this format. If this book's price ever changes, sales at the old and new price appear as separate rows." /></th>
                <th style={TABLE_HEAD_STYLE}>Printing Cost<ColHelp text="Lulu's production printing cost for a printed copy (Paperback or Hardcover), taken off the price before your royalty is worked out. eBook and Audiobook rows show a dash. Shipping is paid by the customer and is never included here." /></th>
                <th style={TABLE_HEAD_STYLE}>Share<ColHelp text="Your royalty for a single copy at this price: what you personally earn per book sold, before multiplying by how many were sold. For printed copies it is worked out after Lulu's printing cost is taken off the price." /></th>
                <th style={TABLE_HEAD_STYLE}>Units<ColHelp text="How many copies were sold at exactly this price, in this format, under this sale type. If the price changes, or a sale happens through an affiliate instead of organically, that becomes its own separate row with its own count." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalty<ColHelp text="Your total earnings for this whole row: Share multiplied by Units. This is the actual amount you're owed for all the copies sold under this exact condition." /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <Fragment key={i}>
                  <tr className={highlightActive && r.isNew ? "revenue-row-new" : undefined} onClick={() => setOpenRow(openRow === i ? null : i)} style={{ cursor: "pointer" }} aria-expanded={openRow === i}>
                    <td style={TABLE_CELL_STYLE}>{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <div>{r.title}</div>
                      <div style={{ color: "var(--ink-faint)" }}>{r.format}</div>
                    </td>
                    <td style={TABLE_CELL_STYLE}>${r.price.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>{r.printingCost != null ? `$${r.printingCost.toFixed(2)}` : isPrintFormat(r.format) ? "Not recorded" : "—"}</td>
                    <td style={TABLE_CELL_STYLE}>${r.share.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>{r.units}</td>
                    <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${(r.share * r.units).toFixed(2)}</td>
                  </tr>
                  {openRow === i && (
                    <tr>
                      <td colSpan={7} style={{ ...TABLE_CELL_STYLE, background: "var(--cream)", color: "var(--ink-soft)" }}>
                        For one copy at this price: company share <strong>${r.company.toFixed(2)}</strong> &middot; affiliate commission <strong>${r.affiliate.toFixed(2)}</strong>{r.affiliate === 0 ? " (organic sale, no affiliate)" : ""}.
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
