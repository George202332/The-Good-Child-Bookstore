import { prisma } from "@/lib/prisma";

/** Marks an order PAID and logs the payment — shared by the webhook
 * handlers (app/api/webhooks/*) and the gateway return flow
 * (app/checkout/return), so both paths record identically. */
export async function finalizeOrderPayment(
  orderId: string,
  gateway: "PAYPAL" | "PAYSTACK",
  rawPayload: unknown
): Promise<void> {
  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  await prisma.paymentLog.create({
    data: { orderId, gateway, rawPayload: rawPayload as object, verified: true },
  });
  // Confirmation email would be sent here once an email service is wired up.
}
