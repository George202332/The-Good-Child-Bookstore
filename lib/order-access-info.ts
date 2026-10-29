import { prisma } from "@/lib/prisma";
import { ORDER_LOGIN_MINUTES } from "@/lib/order-access";

/**
 * What the payment success page needs to know about WHO an order belongs to.
 * Server-only (deliberately not a server action, so it can never be called from
 * a browser) and used only after the page has already checked that the visitor
 * holds the order's secret key or is signed in as its owner.
 */
export interface OrderAccessInfo {
  buyerUserId: string;
  /** The order created a brand-new reader account for a guest who has not yet chosen a password. */
  newGuestAccount: boolean;
  /** The payment was confirmed recently enough for the one-click sign-in to still work. */
  signInWindowOpen: boolean;
}

export async function getOrderAccessInfo(orderId: string): Promise<OrderAccessInfo | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        createdAt: true,
        reader: { select: { user: { select: { id: true, role: true, suspended: true, guestSetupPending: true } } } },
        paymentLogs: { where: { verified: true }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!order) return null;
    const u = order.reader.user;
    const paidAt = order.paymentLogs[0]?.createdAt ?? order.createdAt;
    return {
      buyerUserId: u.id,
      newGuestAccount: order.status === "PAID" && u.role === "READER" && !u.suspended && u.guestSetupPending,
      signInWindowOpen: Date.now() - paidAt.getTime() <= ORDER_LOGIN_MINUTES * 60 * 1000,
    };
  } catch {
    return null;
  }
}
