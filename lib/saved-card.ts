import { prisma } from "@/lib/prisma";

// SERVER-ONLY helper (not a "use server" action): called by the Paystack webhook and the checkout return page after a
// payment has been confirmed. It must never be callable from a browser.

/** Called from the checkout return page / webhook after a successful
 * Paystack charge whose card supports reuse — saves the token if it's
 * not already on file for this reader. */
export async function saveCardIfReusable(
  orderId: string,
  authorization: { code: string; cardType: string; last4: string; bank: string } | null
): Promise<void> {
  if (!authorization) return;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { readerId: true } });
    if (!order) return;

    const existing = await prisma.savedPaymentMethod.findFirst({
      where: { readerId: order.readerId, authorizationCode: authorization.code },
    });
    if (existing) return;

    const existingCount = await prisma.savedPaymentMethod.count({ where: { readerId: order.readerId } });
    await prisma.savedPaymentMethod.create({
      data: {
        readerId: order.readerId,
        gateway: "PAYSTACK",
        authorizationCode: authorization.code,
        cardType: authorization.cardType,
        last4: authorization.last4,
        bank: authorization.bank,
        isDefault: existingCount === 0,
      },
    });
  } catch {
    // Non-critical — a failed save here shouldn't affect order confirmation.
  }
}
