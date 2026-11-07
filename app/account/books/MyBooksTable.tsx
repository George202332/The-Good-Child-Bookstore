"use client";

import { useState } from "react";
import Link from "next/link";
import { ColHelp } from "@/components/ColHelp";

/** What the table needs to draw one book, prepared on the server (plain values only). */
export interface MyBookCell {
  /** Copies sold of this format. */
  sold: number;
  /** The price in dollars, only when this format exists and has a price. */
  price: number | null;
  /** The format exists on this book and is on offer. */
  exists: boolean;
  status: "published" | "review" | "unpublished";
  /** Small line under an "Unpublished" pill (Draft, Attention, Suspended ...). */
  stage?: string;
}
export interface MyBookRow {
  id: string;
  title: string;
  cover: string | null;
  authorName: string;
  category: string;
  units: number;
  royalty: number;
  /** One line per held edit or sent-back note, shown under the title. */
  notes: { text: string; alert: boolean }[];
  cells: { ebook: MyBookCell; audiobook: MyBookCell; paperback: MyBookCell; hardcover: MyBookCell };
  actions: { href: string; label: string }[];
}

/** Fifteen books are shown at a time; the arrows at the bottom replace the set (nothing loads automatically). */
const PAGE_SIZE = 15;
const FORMATS: { key: keyof MyBookRow["cells"]; label: string; help: string }[] = [
  { key: "ebook", label: "eBook", help: "Copies sold of the eBook, with its price in brackets. The label under it shows where it stands." },
  { key: "audiobook", label: "Audiobook", help: "Copies sold of the audiobook, with its price in brackets. The label under it shows where it stands." },
  { key: "paperback", label: "Paperback", help: "Copies sold of the paperback, with its price in brackets. The label under it shows where it stands." },
  { key: "hardcover", label: "Hardcover", help: "Copies sold of the hardcover, with its price in brackets. The label under it shows where it stands." },
];

/* Every rule is scoped under .dashboard-content so it wins over the site-wide "fit every table" rules (which use !important). */
const css = `
  .mybooks-card{border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(46,36,64,.14);border:1px solid var(--line);background:var(--paper)}
  .dashboard-content .mybooks-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto}
  .dashboard-content .mybooks-table thead th{background:#2E2440;color:#F1E2C9;font-weight:700;font-size:11px !important;letter-spacing:.03em;text-transform:uppercase;text-align:center;vertical-align:middle !important;white-space:nowrap !important;padding:0 8px !important;height:48px;line-height:1}
  .mybooks-th{position:relative;display:inline-block;line-height:1}
  .mybooks-th .col-help{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin:0 0 0 4px;border-color:#F1E2C9;color:#F1E2C9}
  .dashboard-content .mybooks-table td{padding:14px 10px !important;font-size:13px !important;line-height:1.35;text-align:center;border-bottom:1px solid var(--line);vertical-align:middle;background:var(--paper);transition:background .12s}
  .dashboard-content .mybooks-table td.mybooks-title{text-align:left}
  .mybooks-table tbody tr:last-child td{border-bottom:none}
  .mybooks-table td:first-child{box-shadow:inset 0 0 0 0 var(--coral-deep);transition:box-shadow .12s,background .12s}
  .mybooks-row{outline:none;cursor:default}
  .mybooks-row:hover td,.mybooks-row:focus-within td,.mybooks-row.is-active td{background:var(--cream)}
  .mybooks-row:hover td:first-child,.mybooks-row:focus-within td:first-child,.mybooks-row.is-active td:first-child{box-shadow:inset 4px 0 0 0 #8C72D6}
  .mybooks-last{position:relative}
  /* The buttons have no column of their own: they float over the right end of the row, after Hardcover. */
  .mybooks-row .row-actions{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .12s;padding:6px 6px 6px 22px;border-radius:10px;background:linear-gradient(to right,rgba(241,226,201,0),var(--cream) 20px);z-index:2}
  .mybooks-row .row-actions a{white-space:nowrap;text-align:center;font-size:11.5px;padding:5px 10px}
  @media (hover:hover){
    .mybooks-row:hover .row-actions,.mybooks-row:focus-within .row-actions{opacity:1;pointer-events:auto}
  }
  .mybooks-row.is-active .row-actions{opacity:1;pointer-events:auto}
  .mb-pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;line-height:1.5;white-space:nowrap}
  .mb-pill-published{background:#D6F0E0;color:#165236}
  .mb-pill-review{background:#FBE7B5;color:#6E4A00}
  .mb-pill-unpublished{background:#E5E1EC;color:#43385B}
  html.dark-mode .mb-pill-published{background:#1D4A33;color:#BFEFD3}
  html.dark-mode .mb-pill-review{background:#5A4410;color:#FBE7B5}
  html.dark-mode .mb-pill-unpublished{background:#3A3348;color:#D6CEE6}
  .mybooks-pager{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;flex-wrap:wrap}
  .mybooks-pager .pager-info{font-size:13px;color:var(--ink-soft);text-align:center}
  .mybooks-pager button[disabled]{opacity:.4;cursor:not-allowed}
  @media (max-width:900px){
    .mybooks-card{border:0;box-shadow:none;background:transparent;border-radius:0;overflow:visible}
    .dashboard-content .mybooks-table td{text-align:right}
    .dashboard-content .mybooks-table td.mybooks-title{display:block;text-align:left;padding:8px 0 !important}
    .dashboard-content .mybooks-table td.mybooks-title::before{content:none !important}
    .mybooks-row td:first-child{box-shadow:none !important}
    .mybooks-row .row-actions{position:static;transform:none;flex-direction:row;flex-wrap:wrap;justify-content:flex-end;background:none;padding:6px 0 0;display:none;opacity:1}
    .mybooks-row.is-active .row-actions{display:flex}
    .mybooks-last{flex-wrap:wrap}
  }
`;

function FormatCell({ cell }: { cell: MyBookCell }) {
  const top = !cell.exists ? <span style={{ color: "var(--ink-faint)" }}>—</span> : (
    <span style={{ fontWeight: 700 }}>
      {cell.status === "published" ? cell.sold : null}
      {cell.price != null && <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{cell.status === "published" ? " " : ""}(${cell.price.toFixed(2)})</span>}
      {cell.status !== "published" && cell.price == null && <span style={{ color: "var(--ink-faint)" }}>—</span>}
    </span>
  );
  return (
    <>
      <div>{top}</div>
      <div style={{ marginTop: 4 }}>
        <span className={`mb-pill mb-pill-${cell.status}`}>{cell.status === "published" ? "Published" : cell.status === "review" ? "On Review" : "Unpublished"}</span>
        {cell.status === "unpublished" && cell.stage && <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{cell.stage}</div>}
      </div>
    </>
  );
}

export function MyBooksTable({ rows }: { rows: MyBookRow[] }) {
  const [page, setPage] = useState(1);
  // On a touch screen there is no hover: tapping a row shows its buttons, tapping it again (or another row) hides them.
  const [active, setActive] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const first = rows.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const last = Math.min(rows.length, current * PAGE_SIZE);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <style>{css}</style>
      <div className="mybooks-card">
        <div>
          <table className="mybooks-table">
            <thead>
              <tr>
                <th><span className="mybooks-th">Title<ColHelp text="The book's title. One book is one row, even when it has several formats. Hover over a row (or tap it on a phone) to edit its eBook / Audiobook or its Print Book." /></span></th>
                <th><span className="mybooks-th">Author<ColHelp text="The author name entered on this book. It can differ from your account name." /></span></th>
                <th><span className="mybooks-th">Category<ColHelp text="The book's category." /></span></th>
                <th><span className="mybooks-th">Units Sold<ColHelp text="Total copies sold across every format combined." /></span></th>
                <th><span className="mybooks-th">Royalty<ColHelp text="Your total lifetime earnings from this book's sales." /></span></th>
                {FORMATS.map((f) => (
                  <th key={f.key}><span className="mybooks-th">{f.label}<ColHelp text={f.help} /></span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`mybooks-row${active === r.id ? " is-active" : ""}`}
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    setActive((cur) => (cur === r.id ? null : r.id));
                  }}
                >
                  <td className="mybooks-title">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {r.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- author-uploaded cover served from our own file route
                        <img src={r.cover} alt="" height={58} style={{ height: 58, width: "auto", minWidth: 36, maxWidth: 64, objectFit: "contain", borderRadius: 0, flex: "none", background: "var(--cream)" }} />
                      ) : (
                        <span aria-hidden style={{ width: 43, height: 58, borderRadius: 0, background: "var(--cream)", flex: "none" }} />
                      )}
                      <div>
                        <strong>{r.title}</strong>
                        {r.notes.map((n, i) => (
                          <div key={i} style={{ fontSize: 12, color: n.alert ? "#6F1A28" : "var(--ink-soft)", marginTop: 4, maxWidth: 280 }}>{n.text}</div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>{r.authorName}</td>
                  <td>{r.category}</td>
                  <td>{r.units}</td>
                  <td>${r.royalty.toFixed(2)}</td>
                  {FORMATS.map((f, i) => (
                    <td key={f.key} className={i === FORMATS.length - 1 ? "mybooks-last" : undefined}>
                      <FormatCell cell={r.cells[f.key]} />
                      {i === FORMATS.length - 1 && (
                        <div className="row-actions">
                          {r.actions.map((a) => (
                            <Link key={a.href} href={a.href} className="btn btn-ghost btn-small">{a.label}</Link>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <nav className="mybooks-pager" aria-label="My Books pages">
        <button type="button" className="btn btn-ghost btn-small" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">← Previous</button>
        <span className="pager-info">Showing {first} to {last} of {rows.length} · Page {current} of {pages}</span>
        <button type="button" className="btn btn-ghost btn-small" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">Next →</button>
      </nav>
    </>
  );
}
