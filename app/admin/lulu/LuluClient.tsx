"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshFromLulu, type LuluReport } from "@/actions/admin-lulu";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { BUCKET_LABEL, type StatusBucket } from "@/lib/lulu-report";

const money = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
const signed = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="map-card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13.5, fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function LuluClient({ report, range, from, to }: { report: LuluReport; range: string; from: string; to: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [msg, setMsg] = useState<string | null>(null);
  const t = report.totals;
  const p = report.performance;

  const go = (r: string, f = "", tt = "") => {
    const q = new URLSearchParams({ range: r });
    if (r === "custom") { q.set("from", f); q.set("to", tt); }
    router.push(`/admin/lulu?${q.toString()}`);
  };

  const refresh = () =>
    start(async () => {
      const res = await refreshFromLulu(range, from, to);
      setMsg(res.ok ? `Checked ${res.checked} print order(s) with Lulu; ${res.updated} updated.${res.error ? ` Some could not be read: ${res.error}` : ""}` : res.error ?? "Could not reach Lulu.");
      router.refresh();
    });

  const buckets: StatusBucket[] = ["SUBMITTED", "IN_PRODUCTION", "SHIPPED", "REJECTED", "FAILED", "NOT_SENT"];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="map-card" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        {([["this-month", "This Month"], ["last-month", "Last Month"], ["custom", "Custom Range"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={`btn btn-small ${range === k ? "btn-primary" : "btn-ghost"}`} onClick={() => (k === "custom" ? go("custom", customFrom, customTo) : go(k))}>
            {label}
          </button>
        ))}
        <label style={{ fontSize: 12 }}>From<br /><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>To<br /><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></label>
        <button type="button" className="btn btn-ghost btn-small" disabled={!customFrom || !customTo} onClick={() => go("custom", customFrom, customTo)}>Apply</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary btn-small" disabled={pending} onClick={refresh}>{pending ? "Checking…" : "Refresh from Lulu"}</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
        Showing {report.rangeLabel}: {t.orders} printed order(s). {report.lastSyncedAt ? `Lulu last checked ${new Date(report.lastSyncedAt).toLocaleString()}.` : "Lulu has not been checked yet, so amounts below are the prices quoted when each order was placed."}
        {msg && <div role="status" style={{ marginTop: 6 }}>{msg}</div>}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Card title="What Customers Paid">
          <Line label="Book prices (print)" value={money(t.paidBooks)} />
          <Line label="Of which production printing" value={money(t.paidProduction)} />
          <Line label="Shipping" value={money(t.paidShipping)} />
          <Line label="Production + shipping" value={money(t.paidProduction + t.paidShipping)} bold />
        </Card>
        <Card title="What Lulu Charges">
          <Line label="Production printing" value={money(t.luluProduction)} />
          <Line label="Shipping" value={money(t.luluShipping)} />
          <Line label="Fulfilment fee (company cost)" value={money(t.luluFulfillment)} />
          <Line label="Total owed to Lulu" value={money(t.luluTotal)} bold />
        </Card>
        <Card title="Difference">
          <Line label="Production printing" value={signed(t.productionDifference)} />
          <Line label="Shipping" value={signed(t.shippingDifference)} />
          <Line label="Production + shipping" value={signed(t.totalDifference)} bold />
          <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
            Customer payments minus Lulu charges. Zero means they match; a minus means Lulu charged more than customers paid. The fulfilment fee is not included.
          </p>
        </Card>
      </div>

      <Card title="Performance">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {buckets.map((b) => {
            const bad = (b === "REJECTED" || b === "FAILED" || b === "NOT_SENT") && p.counts[b] > 0;
            return (
              <div key={b} style={{ minWidth: 130, padding: "8px 12px", borderRadius: 8, border: `1px solid ${bad ? "#B3261E" : "var(--line, #ddd)"}`, background: bad ? "#FDECEA" : undefined }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: bad ? "#B3261E" : undefined }}>{p.counts[b]}</div>
                <div style={{ fontSize: 12.5 }}>{BUCKET_LABEL[b]}{bad ? " ⚠" : ""}</div>
              </div>
            );
          })}
          <div style={{ minWidth: 150, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line, #ddd)" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{p.avgDaysToShip == null ? "—" : `${p.avgDaysToShip} days`}</div>
            <div style={{ fontSize: 12.5 }}>Average Order To Shipping{p.shippedCount ? ` (${p.shippedCount} shipped)` : ""}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 10 }}>
          Lulu does not report a &quot;delivered&quot; status for print jobs (it stops at shipped), so delivered orders cannot be counted here.
          Orders flagged in red were rejected or cancelled by Lulu, failed to send, or have not been sent yet.
        </p>
      </Card>

      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Order</th>
              <th style={TH_STYLE}>Date</th>
              <th style={TH_STYLE}>Book</th>
              <th style={TH_STYLE}>Format</th>
              <th style={TH_STYLE}>Lulu Status</th>
              <th style={TH_STYLE}>Production Printing</th>
              <th style={TH_STYLE}>Shipping</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr><td style={TD_STYLE} colSpan={7}>No printed orders in this period.</td></tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.orderId} style={r.flagged ? { background: "#FDECEA" } : undefined}>
                <td style={TD_STYLE}>#{r.orderNumber}</td>
                <td style={TD_STYLE}>{new Date(r.date).toLocaleDateString()}</td>
                <td style={TD_STYLE}>{r.books}</td>
                <td style={TD_STYLE}>{r.formats}</td>
                <td style={TD_STYLE}>
                  {r.flagged && <strong style={{ color: "#B3261E" }}>⚠ {r.bucketLabel}: </strong>}
                  {r.luluStatus}
                  {r.error && <div style={{ fontSize: 11.5, color: "#B3261E", maxWidth: 260 }}>{r.error}</div>}
                </td>
                <td style={TD_STYLE}>{money(r.production)}</td>
                <td style={TD_STYLE}>{money(r.shipping)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
