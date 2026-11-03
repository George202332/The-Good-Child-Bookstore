"use client";

import { useEffect, useState } from "react";
import { getAccountingDrill } from "@/actions/accounting";
import type { Drill } from "@/lib/accounting/service";
import { Modal } from "@/components/Modal";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { usd, shortDate } from "@/lib/accounting/format";

/** The list of transactions behind a clicked total. Read-only; loads from the server (which re-checks the role). */
export function DrillModal({ selection, metric, includeTest, onClose }: { selection: string; metric: string; includeTest: boolean; onClose: () => void }) {
  const [drill, setDrill] = useState<Drill | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getAccountingDrill(selection, metric, includeTest).then((d) => { if (live) setDrill(d); }).catch(() => { if (live) setDrill(null); });
    return () => { live = false; };
  }, [selection, metric, includeTest]);
  const q = `table=drill&metric=${encodeURIComponent(metric)}&selection=${encodeURIComponent(selection)}&includeTest=${includeTest ? 1 : 0}`;
  return (
    <Modal onClose={onClose} maxWidth={860}>
      {drill === undefined && <p>Loading…</p>}
      {drill === null && <p>These transactions could not be loaded.</p>}
      {drill && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
            <div>
              <h3 style={{ fontSize: 17 }}>{drill.title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>{drill.explain}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn btn-ghost btn-small" href={`/api/accounting/export?${q}&format=csv`}>CSV</a>
              <a className="btn btn-ghost btn-small" href={`/api/accounting/export?${q}&format=pdf`}>PDF</a>
              <button type="button" className="btn btn-primary btn-small" onClick={onClose}>Close</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={TH_STYLE}>Date</th><th style={TH_STYLE}>Reference</th><th style={TH_STYLE}>Description</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                {drill.rows.length === 0 && <tr><td style={TD_STYLE} colSpan={4}>Nothing in this period.</td></tr>}
                {drill.rows.map((r) => (
                  <tr key={r.key}>
                    <td style={TD_STYLE}>{r.date ? shortDate(r.date) : ""}</td>
                    <td style={TD_STYLE}>{r.ref}</td>
                    <td style={TD_STYLE}>{r.description}{r.note ? <span style={{ color: "var(--ink-faint)" }}> ({r.note})</span> : null}</td>
                    <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(r.amount)}</td>
                  </tr>
                ))}
                <tr><td style={{ ...TD_STYLE, fontWeight: 700 }} colSpan={3}>Total</td><td style={{ ...TD_STYLE, textAlign: "right", fontWeight: 700 }}>{usd(drill.total)}</td></tr>
              </tbody>
            </table>
          </div>
          {drill.rows.length >= 2000 && <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>Showing the latest 2,000 rows. Export for the full list.</p>}
        </>
      )}
    </Modal>
  );
}
