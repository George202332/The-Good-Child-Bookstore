import { createHmac } from "crypto";

/**
 * Paystack integration — Transactions API. The brief's other "live"
 * gateway (cards: Visa, Mastercard, Amex, Verve). Same caveat as
 * lib/payments/paypal.ts: real, correct integration code against
 * Paystack's documented REST API, not exercised against a live account
 * in this sandbox (no network access, no real PAYSTACK_SECRET_KEY).
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function requireSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

/** Initializes a transaction and returns Paystack's hosted checkout URL.
 * Amount is in the smallest currency unit (kobo for NGN, cents for USD).
 * Pass `channels: ["mobile_money"]` to restrict the hosted page to
 * M-Pesa — Paystack supports M-Pesa directly as a mobile money channel,
 * converting from USD to KES at their own standard rates when settling,
 * so charges stay in USD on our side (no manual conversion). */
export async function initializePaystackTransaction(
  email: string,
  amountMinorUnits: number,
  ourOrderId: string,
  callbackUrl: string,
  options?: { channels?: string[] }
): Promise<{ authorizationUrl: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: amountMinorUnits,
      callback_url: callbackUrl,
      channels: options?.channels,
      metadata: { ourOrderId },
    }),
  });
  if (!res.ok) throw new Error(`Paystack initialize failed: ${res.status}`);
  const data = await res.json();
  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

/** Verifies a transaction by reference — call this from the webhook
 * handler (charge.success) rather than trusting the client redirect alone.
 * Also returns the reusable authorization token (if the card supports it)
 * so it can be saved as a SavedPaymentMethod — Paystack's own tokenization,
 * never raw card data. */
export async function verifyPaystackTransaction(reference: string): Promise<{
  success: boolean;
  ourOrderId: string | null;
  authorization: { code: string; reusable: boolean; cardType: string; last4: string; bank: string } | null;
}> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${requireSecretKey()}` },
  });
  if (!res.ok) return { success: false, ourOrderId: null, authorization: null };
  const data = await res.json();
  const success = data.data?.status === "success";
  const ourOrderId = data.data?.metadata?.ourOrderId ?? null;
  const auth = data.data?.authorization;
  const authorization =
    auth && auth.reusable
      ? { code: auth.authorization_code, reusable: true, cardType: auth.card_type, last4: auth.last4, bank: auth.bank }
      : null;
  return { success, ourOrderId, authorization };
}

/** Charges a previously-saved, reusable authorization token directly —
 * no hosted redirect needed, since the card was already verified once.
 * This is how "pay with saved card" works at checkout. */
export async function chargeAuthorization(
  authorizationCode: string,
  email: string,
  amountMinorUnits: number,
  ourOrderId: string
): Promise<{ success: boolean; reference?: string }> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/charge_authorization`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      authorization_code: authorizationCode,
      email,
      amount: amountMinorUnits,
      metadata: { ourOrderId },
    }),
  });
  if (!res.ok) return { success: false };
  const data = await res.json();
  return { success: data.data?.status === "success", reference: data.data?.reference };
}

/** Verifies the `x-paystack-signature` header via HMAC-SHA512 of the raw
 * body with the secret key — Paystack's documented webhook verification. */
export function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha512", requireSecretKey()).update(rawBody).digest("hex");
  return expected === signatureHeader;
}
