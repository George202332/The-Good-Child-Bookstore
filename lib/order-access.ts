import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Secure, order-specific access that needs no sign-in, used by the payment
 * success page and its receipt download.
 *
 *  - orderAccessToken(orderId): a keyed fingerprint (HMAC-SHA256) of the order id,
 *    made with a server-only secret. It cannot be worked out from an order number
 *    and is different for every order, so a receipt cannot be reached by guessing
 *    order numbers. It is handed only to the buyer: in the link the payment
 *    return page redirects them to.
 *  - login tokens: random, single-use, hashed before they are stored (see
 *    lib/order-login.ts).
 *
 * The secret is read from the existing AUTH_SECRET environment variable. If no
 * secret is configured, everything here fails closed (no token is ever valid).
 */

/** How long a "sign me in" link/button stays valid after the payment is confirmed. */
export const ORDER_LOGIN_MINUTES = 60;

function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.SETTINGS_ENCRYPTION_KEY || null;
}

export function orderAccessToken(orderId: string): string {
  const key = secret();
  if (!key) return "";
  return createHmac("sha256", key).update(`order-access:v1:${orderId}`).digest("base64url");
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = orderAccessToken(orderId);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Where the buyer lands after a confirmed payment. The secret `k` is what lets a
 * guest (who has no login) open this page and download the receipt. */
export function confirmationUrl(orderId: string): string {
  const k = orderAccessToken(orderId);
  return `/checkout/confirmation?order=${encodeURIComponent(orderId)}${k ? `&k=${k}` : ""}`;
}

export function receiptUrl(orderId: string): string {
  const k = orderAccessToken(orderId);
  return `/api/receipts/${encodeURIComponent(orderId)}${k ? `?t=${k}` : ""}`;
}

export function newLoginToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashLoginToken(token) };
}

export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
