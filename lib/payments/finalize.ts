import { prisma } from "@/lib/prisma";

/** Marks an order PAID and logs the payment — shared by the webhook
 * handlers (app/api/webhooks/*) and the gateway return flow
 * (app/checkout/return), so both paths record identically. */
export async function finalizeOrderPayment(
  orderId: string,
  gateway: "PAYSTACK",
  rawPayload: unknown
): Promise<void> {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
    include: {
      reader: { include: { user: true } },
      lines: { include: { book: { include: { author: { include: { user: true } } } } } },
    },
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
        type: "PAYMENT",
      },
    });
  } catch {
    // Non-critical — a failed notification shouldn't block payment confirmation.
  }

  // Notify each author whose book was just sold — "You've got a sale"
  // on their Recent Activity (see recentActivityLine in
  // lib/notification-types.ts). One notification per SaleLine (a
  // format like ebook/paperback of the same title in one order is its
  // own SaleLine, and its own real sale) — each tagged with that
  // line's id as relatedRecordId, so deleting that specific transaction
  // later (actions/transactions.ts's deleteTransaction) can find and
  // remove exactly this notification, never leaving a trace behind.
  try {
    for (const line of order.lines) {
      const authorUserId = line.book.author?.user?.id;
      if (!authorUserId) continue;
      await prisma.notification.create({
        data: { userId: authorUserId, title: line.book.title, body: `A copy of "${line.book.title}" just sold.`, type: "SALE", relatedRecordId: line.id },
      });
    }
  } catch {
    // Non-critical.
  }

  // Any physical copies in this order get submitted to Lulu as a real
  // print-on-demand job — never allowed to block payment confirmation
  // if it fails, since the customer's payment already succeeded.
  const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
  await submitPrintJobsForOrder(orderId);

  const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
  await sendOrderReceiptEmail(orderId);
}
