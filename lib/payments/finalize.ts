import { prisma } from "@/lib/prisma";
import { notifyRevenueEarners } from "@/lib/payments/notify-earners";
import { reportSystemError } from "@/lib/site-health/alert";

/** Marks an order PAID and logs the payment — shared by the webhook
 * handlers (app/api/webhooks/*) and the gateway return flow
 * (app/checkout/return), so both paths record identically.
 *
 * The core PAID-marking + payment-log write is the one part of this
 * function that genuinely can't fail silently — a buyer whose payment
 * succeeded but whose order never got marked PAID is exactly the kind
 * of thing Site Health's "payment and checkout" alert exists for — so
 * it's wrapped and reported through reportSystemError() before
 * re-throwing (both callers already handle a thrown error from this
 * function: the webhook route lets it 500 so Paystack retries, and the
 * return-page catch falls back to its own DB-status check). */
export async function finalizeOrderPayment(
  orderId: string,
  gateway: "PAYSTACK",
  rawPayload: unknown
): Promise<void> {
  let order;
  try {
    order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID" },
      include: {
        reader: { include: { user: true } },
      },
    });
    await prisma.paymentLog.create({
      data: { orderId, gateway, rawPayload: rawPayload as object, verified: true },
    });
  } catch (e) {
    await reportSystemError("CHECKOUT", e, { orderId, gateway });
    throw e;
  }

  try {
    await prisma.notification.create({
      data: {
        userId: order.reader.user.id,
        title: "Order confirmed",
        body: `Your order #${orderId.slice(0, 8).toUpperCase()} for $${Number(order.totalAmount).toFixed(2)} is confirmed.`,
        type: "PAYMENT",
      },
    });
  } catch {
    // Non-critical — a failed notification shouldn't block payment confirmation.
  }

  // Notifies the author of each line's book ("You've got a sale" on
  // their Recent Activity, plus the Revenue-tab blink), and any
  // referring/promoting affiliate of their own commission — see
  // lib/payments/notify-earners.ts, now shared with the demo-mode
  // confirmation path (actions/orders.ts confirmOrderPaidDirectly) so
  // the two can't drift out of sync again.
  await notifyRevenueEarners(orderId);

  // Any physical copies in this order get submitted to Lulu as a real
  // print-on-demand job — never allowed to block payment confirmation
  // if it fails, since the customer's payment already succeeded.
  const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
  await submitPrintJobsForOrder(orderId);

  const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
  await sendOrderReceiptEmail(orderId);
}
