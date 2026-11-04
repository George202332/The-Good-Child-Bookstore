"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { checkPayoutAdjustment, checkRefund, logRecordChange, PAYMENT_STATUSES } from "@/lib/records";

/**
 * Corrections to money records. Nothing here deletes or rewrites an order, payment or payout: every action adds a NEW record
 * (a refund, a reversing entry) or sets a status, and writes a line in the permanent change log with who did it and when.
 * Admin only.
 */

type Result = { ok: boolean; error?: string };

async function admin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;
  return { id: session.user.id as string, name: (session.user.name as string) ?? "Admin" };
}

function done(): void {
  revalidatePath("/admin/records");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/payouts");
}

/** Records a refund as a new entry linked to the original order. The order and its payments are not changed. */
export async function recordRefund(input: { orderId: string; amount: number; reason: string; gatewayReference?: string }): Promise<Result> {
  const who = await admin();
  if (!who) return { ok: false, error: "Only Admins can record a refund." };
  const orderId = input.orderId.trim();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, totalAmount: true, refunds: { select: { amount: true } } } });
  if (!order) return { ok: false, error: "No order with that id." };
  if (order.status !== "PAID") return { ok: false, error: "Only a paid order can be refunded." };
  const check = checkRefund({
    orderTotal: Number(order.totalAmount),
    alreadyRefunded: order.refunds.reduce((s: number, r: { amount: unknown }) => s + Number(r.amount), 0),
    amount: Number(input.amount),
    reason: input.reason,
  });
  if (!check.ok) return check;
  try {
    const refund = await prisma.refund.create({
      data: {
        orderId, amount: Number(input.amount).toFixed(2), currency: "USD", reason: input.reason.trim().slice(0, 1000),
        processedById: who.id, processedByName: who.name, gatewayReference: input.gatewayReference?.trim() || null,
      },
    });
    await logRecordChange({ entityType: "REFUND", entityId: refund.id, action: "REFUND_RECORDED", summary: `Refund of ${Number(input.amount).toFixed(2)} on order ${orderId}`, after: { orderId, amount: Number(input.amount), reason: input.reason.trim() }, actorId: who.id, actorName: who.name });
    await logRecordChange({ entityType: "ORDER", entityId: orderId, action: "REFUND_ADDED", summary: `Refund ${refund.id} added`, actorId: who.id, actorName: who.name });
    done();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not record the refund." };
  }
}

/** Fixes a payout mistake with a new reversing (or correcting) entry. The original payout is not changed. */
export async function recordPayoutAdjustment(input: { payoutId: string; kind: "REVERSAL" | "CORRECTION"; amount: number; reason: string }): Promise<Result> {
  const who = await admin();
  if (!who) return { ok: false, error: "Only Admins can do this." };
  const payout = await prisma.payoutRequest.findUnique({ where: { id: input.payoutId.trim() }, select: { id: true, amount: true, currency: true, adjustments: { select: { kind: true, amount: true } } } });
  if (!payout) return { ok: false, error: "No payout with that id." };
  const check = checkPayoutAdjustment({
    payoutAmount: Number(payout.amount),
    existing: payout.adjustments.map((a: { kind: string; amount: unknown }) => ({ kind: a.kind, amount: Number(a.amount) })),
    kind: input.kind, amount: Number(input.amount), reason: input.reason,
  });
  if (!check.ok) return check;
  try {
    const adj = await prisma.payoutAdjustment.create({
      data: { payoutRequestId: payout.id, kind: input.kind, amount: Number(input.amount).toFixed(2), currency: payout.currency, reason: input.reason.trim().slice(0, 1000), createdById: who.id, createdByName: who.name },
    });
    await logRecordChange({ entityType: "PAYOUT_ADJUSTMENT", entityId: adj.id, action: `PAYOUT_${input.kind}`, summary: `${input.kind === "REVERSAL" ? "Reversing" : "Correcting"} entry of ${Number(input.amount).toFixed(2)} on payout ${payout.id}`, after: { payoutId: payout.id, amount: Number(input.amount), reason: input.reason.trim() }, actorId: who.id, actorName: who.name });
    done();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not record the entry." };
  }
}

/** Sets the status of a payment record (failed, disputed...). The payment row is kept; only its status and reason change. */
export async function setPaymentStatus(input: { paymentLogId: string; status: string; reason: string }): Promise<Result> {
  const who = await admin();
  if (!who) return { ok: false, error: "Only Admins can do this." };
  if (!(PAYMENT_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Unknown status." };
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };
  const row = await prisma.paymentLog.findUnique({ where: { id: input.paymentLogId.trim() }, select: { id: true, orderId: true, status: true } });
  if (!row) return { ok: false, error: "No payment record with that id." };
  try {
    await prisma.paymentLog.update({ where: { id: row.id }, data: { status: input.status, statusReason: input.reason.trim().slice(0, 1000), statusChangedAt: new Date() } });
    await logRecordChange({ entityType: "PAYMENT", entityId: row.id, action: "PAYMENT_STATUS", summary: `Payment status ${row.status} -> ${input.status}`, before: { status: row.status }, after: { status: input.status, reason: input.reason.trim() }, actorId: who.id, actorName: who.name });
    done();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the status." };
  }
}
