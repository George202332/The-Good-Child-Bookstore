"use server";

import { prisma } from "@/lib/prisma";
import { verifyOrderAccessToken, ORDER_LOGIN_MINUTES } from "@/lib/order-access";
import { createOrderLoginToken } from "@/lib/order-login";

/**
 * The "Go to my account" button on the payment success page, for a brand-new
 * customer whose reader account was just created from a guest purchase.
 *
 * It hands back a fresh one-time token (single use, tied to this order, valid
 * for ORDER_LOGIN_MINUTES) which the page immediately exchanges for a sign-in
 * with next-auth. The token travels in the request body, never in the address
 * bar, so it does not end up in browser history. Nothing here ever reveals a
 * password.
 *
 * It refuses unless ALL of these hold: the caller holds this order's secret
 * access key (the one in the success page's link), the order is PAID, the
 * account is a guest-created reader account that has not chosen its own
 * password yet, and the payment was confirmed within the last hour.
 */
export async function startOrderSignIn(orderId: string, accessKey: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (!orderId || !verifyOrderAccessToken(orderId, accessKey)) return { ok: false, error: "This link is not valid." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      createdAt: true,
      reader: { select: { user: { select: { id: true, role: true, suspended: true, guestSetupPending: true } } } },
      paymentLogs: { where: { verified: true }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order || order.status !== "PAID") return { ok: false, error: "This order has not been paid." };

  const user = order.reader.user;
  if (user.role !== "READER" || user.suspended || !user.guestSetupPending) {
    return { ok: false, error: "Please sign in with your email and password." };
  }

  const paidAt = order.paymentLogs[0]?.createdAt ?? order.createdAt;
  if (Date.now() - paidAt.getTime() > ORDER_LOGIN_MINUTES * 60 * 1000) {
    return { ok: false, error: "This sign-in link has expired. Use the link in your email, or choose Forgot password on the sign-in page." };
  }

  const token = await createOrderLoginToken(user.id, orderId);
  return { ok: true, token };
}
