import { prisma } from "@/lib/prisma";

/**
 * The permanent change log for payments, orders, refunds, payouts and Lulu records: who changed what, and when.
 * Records themselves are never deleted (the database refuses it); a correction is a new entry plus a line here.
 * logRecordChange never throws: a logging problem must never undo or block the real action.
 */

export type RecordEntity = "ORDER" | "PAYMENT" | "PAYOUT" | "PAYOUT_ADJUSTMENT" | "REFUND" | "LULU";

export interface RecordChange {
  entityType: RecordEntity;
  entityId: string;
  action: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  actorId?: string | null;
  actorName?: string | null;
}

export async function logRecordChange(change: RecordChange): Promise<void> {
  try {
    await prisma.recordChangeLog.create({
      data: {
        entityType: change.entityType,
        entityId: change.entityId,
        action: change.action,
        summary: change.summary.slice(0, 500),
        before: change.before === undefined ? undefined : (JSON.parse(JSON.stringify(change.before)) as object),
        after: change.after === undefined ? undefined : (JSON.parse(JSON.stringify(change.after)) as object),
        actorId: change.actorId ?? null,
        actorName: change.actorName ?? null,
      },
    });
  } catch (e) {
    console.error("[records] could not write the change log", e instanceof Error ? e.message : "");
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Pure rules (tested)
// ---------------------------------------------------------------------------------------------------------------------

export const PAYMENT_STATUSES = ["RECORDED", "FAILED", "DISPUTED", "CHARGEBACK", "RESOLVED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const cents = (n: number) => Math.round(n * 100);

/** A refund may not be zero, negative, or take the total refunded above what the order was paid. */
export function checkRefund(opts: { orderTotal: number; alreadyRefunded: number; amount: number; reason: string }): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(opts.amount) || cents(opts.amount) <= 0) return { ok: false, error: "Enter a refund amount above zero." };
  if (!opts.reason.trim()) return { ok: false, error: "A reason is required for every refund." };
  const remaining = cents(opts.orderTotal) - cents(opts.alreadyRefunded);
  if (cents(opts.amount) > remaining) {
    return { ok: false, error: `That is more than can still be refunded on this order (${(remaining / 100).toFixed(2)} left of ${opts.orderTotal.toFixed(2)}).` };
  }
  return { ok: true };
}

/** A reversal cannot take back more than the payout was for, counting earlier reversals and corrections. */
export function checkPayoutAdjustment(opts: { payoutAmount: number; existing: { kind: string; amount: number }[]; kind: string; amount: number; reason: string }): { ok: true } | { ok: false; error: string } {
  if (opts.kind !== "REVERSAL" && opts.kind !== "CORRECTION") return { ok: false, error: "Choose reversal or correction." };
  if (!Number.isFinite(opts.amount) || cents(opts.amount) <= 0) return { ok: false, error: "Enter an amount above zero." };
  if (!opts.reason.trim()) return { ok: false, error: "A reason is required." };
  if (opts.kind === "REVERSAL") {
    const reversed = opts.existing.filter((a) => a.kind === "REVERSAL").reduce((s, a) => s + cents(a.amount), 0);
    const corrected = opts.existing.filter((a) => a.kind === "CORRECTION").reduce((s, a) => s + cents(a.amount), 0);
    const room = cents(opts.payoutAmount) + corrected - reversed;
    if (cents(opts.amount) > room) return { ok: false, error: `A reversal cannot be more than the payout still stands for (${(room / 100).toFixed(2)}).` };
  }
  return { ok: true };
}

/** What a payout now stands for after reversals and corrections. The original payout row is never changed. */
export function netPayoutAmount(payoutAmount: number, adjustments: { kind: string; amount: number }[]): number {
  let c = cents(payoutAmount);
  for (const a of adjustments) c += a.kind === "REVERSAL" ? -cents(a.amount) : a.kind === "CORRECTION" ? cents(a.amount) : 0;
  return c / 100;
}
