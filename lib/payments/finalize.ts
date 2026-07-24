import { prisma } from "@/lib/prisma";

/** Marks an order PAID and logs the payment — shared by the webhook
 * handlers (app/api/webhooks/*) and the gateway return flow
 * (app/checkout/return), so both paths record identically. */
export async function finalizeOrderPayment(
  orderId: string,
  gateway: "PAYPAL" | "PAYSTACK",
  rawPayload: unknown
): Promise<void> {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
    include: { reader: { include: { user: true } } },
  });
  await prisma.paymentLog.create({
    data: { orderId, gateway, rawPayload: rawPayload as object, verified: true },
  });

  try {
    await prisma.notification.create({
      data: {
        userId: order.reader.user.id,
        title: "Order confirmed",
        body: `Your order #${orderId.slice(0, 8).toUpperCase()} for $${Number(order.totalAmount).toFixed(2)} is confirmed.`,
      },
    });
  } catch {
    // Non-critical — a failed notification shouldn't block payment confirmation.
  }
  // Confirmation email would be sent here once an email service is wired up.
}
