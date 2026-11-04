"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordRefund, recordPayoutAdjustment, setPaymentStatus } from "@/actions/records";
import { PAYMENT_STATUSES } from "@/lib/records";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? okText : r.error ?? "Failed." });
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <span role="status" style={{ fontSize: 12.5, color: msg.ok ? "#2e8b57" : "#d64545" }}>{msg.text}</span> : null;

export function RefundForm() {
  const { pending, msg, run } = useRun();
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => recordRefund({ orderId, amount: Number(amount), reason, gatewayReference: ref }), "Refund recorded."); }} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <input className="field" placeholder="Order id" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
      <input className="field" placeholder="Amount (USD)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input className="field" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} required />
      <input className="field" placeholder="Paystack / PayPal refund reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
      <div><button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving..." : "Record refund"}</button> <Msg msg={msg} /></div>
      <p className="field-hint" style={{ margin: 0 }}>This only records the refund in our books. Send the money back from Paystack or PayPal yourself, then record it here.</p>
    </form>
  );
}

export function PayoutAdjustmentForm() {
  const { pending, msg, run } = useRun();
  const [payoutId, setPayoutId] = useState("");
  const [kind, setKind] = useState<"REVERSAL" | "CORRECTION">("REVERSAL");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => recordPayoutAdjustment({ payoutId, kind, amount: Number(amount), reason }), "Entry recorded."); }} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <input className="field" placeholder="Payout id" value={payoutId} onChange={(e) => setPayoutId(e.target.value)} required />
      <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "REVERSAL" | "CORRECTION")}>
        <option value="REVERSAL">Reversal (takes back money paid in error)</option>
        <option value="CORRECTION">Correction (adds an amount that was missing)</option>
      </select>
      <input className="field" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input className="field" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} required />
      <div><button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving..." : "Record entry"}</button> <Msg msg={msg} /></div>
      <p className="field-hint" style={{ margin: 0 }}>The original payout stays exactly as it was; this adds a new entry beside it.</p>
    </form>
  );
}

export function PaymentStatusForm() {
  const { pending, msg, run } = useRun();
  const [id, setId] = useState("");
  const [status, setStatus] = useState<string>("FAILED");
  const [reason, setReason] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => setPaymentStatus({ paymentLogId: id, status, reason }), "Status saved."); }} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <input className="field" placeholder="Payment record id" value={id} onChange={(e) => setId(e.target.value)} required />
      <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
        {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input className="field" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} required />
      <div><button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving..." : "Save status"}</button> <Msg msg={msg} /></div>
    </form>
  );
}
