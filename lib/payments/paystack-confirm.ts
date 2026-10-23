import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { evaluatePaystackPayment } from "@/lib/payments/paystack-check";

/**
 * Asks Paystack (server to server) about a payment reference and checks it
 * against our own order. Used by BOTH the return page and the webhook, so an
 * order is only ever marked paid after the same strict check.
 */
export async function confirmPaystackReference(reference: string): Promise<
  | { ok: true; orderId: string; authorization: Awaited<ReturnType<typeof verifyPaystackTransaction>>["authorization"] }
  | { ok: false; reason: string; paystackStatus: string | null }
> {
  const paid = await verifyPaystackTransaction(reference);
  if (!paid.success || !paid.ourOrderId) return { ok: false, reason: "Paystack has not confirmed this payment.", paystackStatus: paid.paystackStatus };
  const order = await prisma.order.findUnique({ where: { id: paid.ourOrderId }, select: { totalAmount: true } });
  if (!order) return { ok: false, reason: "No matching order.", paystackStatus: paid.paystackStatus };
  const verdict = evaluatePaystackPayment(paid, paid.ourOrderId, Number(order.totalAmount));
  if (!verdict.ok) {
    console.error(`[paystack] payment for order ${paid.ourOrderId} rejected: ${verdict.reason}`);
    return { ok: false, reason: verdict.reason, paystackStatus: paid.paystackStatus };
  }
  return { ok: true, orderId: paid.ourOrderId, authorization: paid.authorization };
}
