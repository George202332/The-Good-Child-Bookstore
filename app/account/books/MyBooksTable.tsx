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

const STEP = 10;
const FORMATS: { key: keyof MyBookRow["cells"]; label: string; help: string }[] = [
  { key: "ebook", label: "eBook", help: "Copies sold of the eBook, with its price in brackets. The label under it shows where it stands." },
  { key: "audiobook", label: "Audiobook", help: "Copies sold of the audiobook, with its price in brackets. The label under it shows where it stands." },
  { key: "paperback", label: "Paperback", help: "Copies sold of the paperback, with its price in brackets. The label under it shows where it stands." },
  { key: "hardcover", label: "Hardcover", help: "Copies sold of the hardcover, with its price in brackets. The label under it shows where it stands." },
];

const css = `
  .mybooks-card{border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(46,36,64,.14);border:1px solid var(--line);background:var(--paper)}
  .mybooks-scroll{overflow-x:auto}
  .mybooks-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
  .mybooks-table thead th{background:#2E2440;color:#F1E2C9;font-weight:700;font-size:11px;letter-spacing:.03em;text-transform:uppercase;text-align:left;padding:14px 16px;white-space:nowrap}
  .mybooks-table thead .col-help{border-color:#F1E2C9;color:#F1E2C9}
  .mybooks-table td{padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:middle;background:var(--paper);transition:background .12s}
  .mybooks-table tbody tr:last-child td{border-bottom:none}
  .mybooks-table td:first-child{box-shadow:inset 0 0 0 0 var(--coral-deep);transition:box-shadow .12s,background .12s}
  .mybooks-row{outline:none;cursor:default}
  .mybooks-row:hover td,.mybooks-row:focus-within td,.mybooks-row.is-active td{background:var(--cream)}
  .mybooks-row:hover td:first-child,.mybooks-row:focus-within td:first-child,.mybooks-row.is-active td:first-child{box-shadow:inset 4px 0 0 0 #8C72D6}
  .mybooks-last{position:relative;padding-right:24px}
  .mybooks-row .row-actions{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .12s;padding:6px 6px 6px 18px;border-radius:10px;background:linear-gradient(to right,rgba(241,226,201,0),var(--cream) 18px)}
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
  .mybooks-more{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:16px}
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
  const [shown, setShown] = useState(STEP);
  // On a touch screen there is no hover: tapping a row shows its buttons, tapping it again (or another row) hides them.
  const [active, setActive] = useState<string | null>(null);
  const visible = rows.slice(0, shown);

  return (
    <>
      <style>{css}</style>
      <div className="mybooks-card">
        <div className="mybooks-scroll">
          <table className="mybooks-table">
            <thead>
              <tr>
                <th>Title<ColHelp text="The book's title. One book is one row, even when it has several formats. Hover over a row (or tap it on a phone) to edit its eBook / Audiobook or its Print Book." /></th>
                <th>Author<ColHelp text="The author name entered on this book. It can differ from your account name." /></th>
                <th>Category<ColHelp text="The book's category." /></th>
                <th>Units Sold<ColHelp text="Total copies sold across every format combined." /></th>
                <th>Royalty<ColHelp text="Your total lifetime earnings from this book's sales." /></th>
                {FORMATS.map((f) => (
                  <th key={f.key}>{f.label}<ColHelp text={f.help} /></th>
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
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {r.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- author-uploaded cover served from our own file route
                        <img src={r.cover} alt="" width={36} height={48} style={{ objectFit: "cover", borderRadius: 3, flex: "none", background: "var(--cream)" }} />
                      ) : (
                        <span aria-hidden style={{ width: 36, height: 48, borderRadius: 3, background: "var(--cream)", flex: "none" }} />
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
      <div className="mybooks-more">
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Showing {Math.min(shown, rows.length)} of {rows.length}</span>
        {shown < rows.length && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setShown((n) => n + STEP)}>Load More</button>
        )}
      </div>
    </>
  );
}
