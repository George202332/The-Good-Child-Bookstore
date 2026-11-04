import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { prisma } from "@/lib/prisma";
import { RefundForm, PayoutAdjustmentForm, PaymentStatusForm } from "./RecordsForms";

/**
 * Records & Refunds. Payments, orders, refunds and payouts are never deleted. A problem is recorded as its own entry here:
 * a refund linked to the original order, a payment keeping its row with a status, a payout fixed with a reversing entry.
 * Every action is written to the change log below with who did it and when. Admin only.
 */
const fmt = (d: Date) => d.toLocaleString();

export default async function RecordsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const [refunds, adjustments, flagged, log] = await Promise.all([
    prisma.refund.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.payoutAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.paymentLog.findMany({ where: { status: { not: "RECORDED" } }, orderBy: { statusChangedAt: "desc" }, take: 25, select: { id: true, orderId: true, gateway: true, status: true, statusReason: true, statusChangedAt: true } }),
    prisma.recordChangeLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const mono = { fontFamily: "monospace", fontSize: 12 } as const;

  return (
    <AdminShell role="ADMIN" activeKey="records" displayName={session.user.name ?? ""}>
      <style>{`.records-table{width:100%;border-collapse:collapse;font-size:13px}.records-table th,.records-table td{padding:6px 10px;text-align:left;border-bottom:1px solid rgba(128,128,128,.25);vertical-align:top}`}</style>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Records &amp; Refunds</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Payments, orders, refunds and payouts are never deleted. Fix a problem by adding a record here; each one is logged with who and when.
          </p>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "8px 0" }}>Record a refund</h3>
      <RefundForm />
      <h3 style={{ fontSize: 15, margin: "24px 0 8px" }}>Fix a payout mistake (reversing entry)</h3>
      <PayoutAdjustmentForm />
      <h3 style={{ fontSize: 15, margin: "24px 0 8px" }}>Mark a payment failed or disputed</h3>
      <PaymentStatusForm />

      <h3 style={{ fontSize: 15, margin: "28px 0 8px" }}>Refunds</h3>
      <table className="records-table"><thead><tr><th>When</th><th>Order</th><th>Amount</th><th>Reason</th><th>Processed by</th></tr></thead><tbody>
        {refunds.length === 0 && <tr><td colSpan={5}>None yet.</td></tr>}
        {refunds.map((r) => (<tr key={r.id}><td>{fmt(r.createdAt)}</td><td style={mono}>{r.orderId}</td><td>{Number(r.amount).toFixed(2)} {r.currency}</td><td>{r.reason}</td><td>{r.processedByName}</td></tr>))}
      </tbody></table>

      <h3 style={{ fontSize: 15, margin: "24px 0 8px" }}>Payout reversing and correcting entries</h3>
      <table className="records-table"><thead><tr><th>When</th><th>Payout</th><th>Type</th><th>Amount</th><th>Reason</th><th>By</th></tr></thead><tbody>
        {adjustments.length === 0 && <tr><td colSpan={6}>None yet.</td></tr>}
        {adjustments.map((a) => (<tr key={a.id}><td>{fmt(a.createdAt)}</td><td style={mono}>{a.payoutRequestId}</td><td>{a.kind}</td><td>{Number(a.amount).toFixed(2)} {a.currency}</td><td>{a.reason}</td><td>{a.createdByName}</td></tr>))}
      </tbody></table>

      <h3 style={{ fontSize: 15, margin: "24px 0 8px" }}>Payments marked failed or disputed</h3>
      <table className="records-table"><thead><tr><th>Changed</th><th>Payment record</th><th>Order</th><th>Status</th><th>Reason</th></tr></thead><tbody>
        {flagged.length === 0 && <tr><td colSpan={5}>None.</td></tr>}
        {flagged.map((p) => (<tr key={p.id}><td>{p.statusChangedAt ? fmt(p.statusChangedAt) : "-"}</td><td style={mono}>{p.id}</td><td style={mono}>{p.orderId}</td><td>{p.status}</td><td>{p.statusReason ?? ""}</td></tr>))}
      </tbody></table>

      <h3 style={{ fontSize: 15, margin: "24px 0 8px" }}>Change log (latest 60)</h3>
      <table className="records-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr></thead><tbody>
        {log.length === 0 && <tr><td colSpan={4}>Nothing logged yet.</td></tr>}
        {log.map((l) => (<tr key={l.id}><td>{fmt(l.createdAt)}</td><td>{l.actorName ?? "system"}</td><td>{l.summary}</td><td style={mono}>{l.entityType} {l.entityId}</td></tr>))}
      </tbody></table>
    </AdminShell>
  );
}
