"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshFromLulu, registerLuluWebhook, type LuluReport } from "@/actions/admin-lulu";
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
  const [open, setOpen] = useState<string | null>(null);
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

  const connect = () =>
    start(async () => {
      const res = await registerLuluWebhook();
      setMsg(res.message);
    });

  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

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
        <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={connect} title="Asks Lulu to tell this site the moment a print job changes, so rejections reach authors straight away">Connect Lulu Notifications</button>
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

      <div className="map-card" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Order</th>
              <th style={TH_STYLE}>Book</th>
              <th style={TH_STYLE}>Lulu Status</th>
              <th style={TH_STYLE}>Production Printing</th>
              <th style={TH_STYLE}>Shipping</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr><td style={TD_STYLE} colSpan={5}>No printed orders in this period.</td></tr>
            )}
            {report.rows.map((r) => (
              <Fragment key={r.orderId}>
                <tr style={{ ...(r.flagged ? { background: "#FDECEA" } : {}), cursor: "pointer" }} onClick={() => setOpen(open === r.orderId ? null : r.orderId)}>
                  <td style={TD_STYLE}>
                    <div style={{ fontWeight: 700 }}>#{r.orderNumber}</div>
                    <div style={{ color: "var(--ink-faint)" }}>{new Date(r.date).toLocaleDateString()}</div>
                    <div style={{ color: "var(--ink-faint)" }}>{r.customer}</div>
                  </td>
                  <td style={TD_STYLE}>
                    <div style={{ fontWeight: 600 }}>{r.books}</div>
                    <div style={{ color: "var(--ink-faint)" }}>{r.authors}</div>
                    <div style={{ color: "var(--ink-faint)" }}>{r.formats}</div>
                  </td>
                  <td style={TD_STYLE}>
                    {r.problemLabel && (
                      <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "#B3261E", color: "#fff", fontWeight: 700, marginBottom: 4 }}>
                        ⚠ {r.problemLabel}
                      </div>
                    )}
                    <div>{r.luluStatus}</div>
                    {r.reason && (
                      <div style={{ color: "#8C1D18", marginTop: 4 }}>
                        Reason: {r.reason.length > 110 ? `${r.reason.slice(0, 110)}…` : r.reason}
                        <button type="button" className="btn btn-ghost btn-small" style={{ marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); setOpen(open === r.orderId ? null : r.orderId); }}>
                          {open === r.orderId ? "Hide Full Message" : "View Full Message"}
                        </button>
                      </div>
                    )}
                    {r.problemLabel && r.authorNotifiedAt && (
                      <div style={{ marginTop: 4, fontWeight: 600, color: "#165236" }}>Author Notified: {when(r.authorNotifiedAt)}</div>
                    )}
                    {r.problemLabel === "Rejected By Lulu" && !r.authorNotifiedAt && (
                      <div style={{ marginTop: 4, color: "var(--ink-faint)" }}>Author not notified yet</div>
                    )}
                  </td>
                  <td style={TD_STYLE}>{money(r.production)}</td>
                  <td style={TD_STYLE}>{money(r.shipping)}</td>
                </tr>
                {open === r.orderId && (
                  <tr>
                    <td colSpan={5} style={{ ...TD_STYLE, background: "var(--cream)" }}>
                      <div><strong>Order:</strong> #{r.orderNumber} &middot; {when(r.date)} &middot; customer {r.customer}</div>
                      <div><strong>Book:</strong> {r.books} &middot; <strong>Format:</strong> {r.formats} &middot; <strong>Author:</strong> {r.authors}</div>
                      <div><strong>Lulu status:</strong> {r.luluStatus}{r.problemLabel ? ` (${r.problemLabel})` : ""}</div>
                      {r.reason ? (
                        <>
                          <div style={{ marginTop: 6 }}><strong>Full message from Lulu:</strong></div>
                          <div style={{ whiteSpace: "pre-wrap", padding: "8px 10px", border: "1px solid #E7B4B0", background: "#FFF", borderRadius: 6, marginTop: 4 }}>{r.reason}</div>
                        </>
                      ) : (
                        <div style={{ marginTop: 6, color: "var(--ink-faint)" }}>Lulu has not reported a problem with this order.</div>
                      )}
                      {r.authorNotifiedAt && <div style={{ marginTop: 6 }}><strong>Author Notified:</strong> {when(r.authorNotifiedAt)} (in their account notifications and by email, sent once)</div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
