import { prisma } from "@/lib/prisma";
import { newLoginToken, hashLoginToken, ORDER_LOGIN_MINUTES } from "@/lib/order-access";

/**
 * One-time sign-in tokens for a new guest buyer (see lib/order-access.ts and
 * the OrderLoginToken model). Server-only.
 */

export async function createOrderLoginToken(userId: string, orderId: string): Promise<string> {
  const { token, hash } = newLoginToken();
  await prisma.orderLoginToken.create({
    data: { tokenHash: hash, userId, orderId, expiresAt: new Date(Date.now() + ORDER_LOGIN_MINUTES * 60 * 1000) },
  });
  return token;
}

/** Read-only look, so a page can say "this link has expired" without using it up
 * (mail scanners and link previews open links; only the button press consumes). */
export async function peekOrderLoginToken(token: string): Promise<"valid" | "used" | "expired" | "unknown"> {
  if (!token) return "unknown";
  const row = await prisma.orderLoginToken.findUnique({ where: { tokenHash: hashLoginToken(token) }, select: { usedAt: true, expiresAt: true } });
  if (!row) return "unknown";
  if (row.usedAt) return "used";
  if (row.expiresAt < new Date()) return "expired";
  return "valid";
}

/** Uses the token up (atomically, so two simultaneous clicks cannot both win) and
 * returns who it signs in, or null when it is unknown, used or expired. */
export async function consumeOrderLoginToken(token: string): Promise<{ userId: string; orderId: string } | null> {
  if (!token) return null;
  const hash = hashLoginToken(token);
  const claimed = await prisma.orderLoginToken.updateMany({
    where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  const row = await prisma.orderLoginToken.findUnique({ where: { tokenHash: hash }, select: { userId: true, orderId: true } });
  return row;
}
