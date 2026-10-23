import { createHmac } from "crypto";
import { getPaystackCredentials } from "@/lib/api-keys";

/**
 * Paystack integration — Transactions API. The brief's other "live"
 * gateway (cards: Visa, Mastercard, Amex, Verve). Credentials (separate
 * test/live secret+public key pairs) come from Site Settings if saved
 * there, falling back to PAYSTACK_SECRET_KEY/PUBLIC_KEY env vars — see
 * lib/api-keys.ts getPaystackCredentials(). Not exercised against a live
 * Paystack account in this sandbox (no network access).
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/** The store charges in US dollars. Paystack must be told the currency
 * explicitly: without it Paystack assumes the account's own default currency
 * (for example KES or NGN) and treats our USD cents as that currency's minor
 * unit, so the customer would be charged the wrong amount. */
export const PAYSTACK_CURRENCY = "USD";

/** Pulls Paystack's own explanation out of a failed response, e.g.
 * "Currency not supported by merchant". Never includes any key. */
export async function readPaystackError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body?.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    // Not JSON - fall through.
  }
  return `HTTP ${res.status}`;
}

/** Which kind of key this is ("live" / "test"), judged from its public prefix,
 * so diagnostics can say "live key" without ever showing the key itself. */
export function paystackKeyMode(key: string | undefined): "live" | "test" | "unknown" {
  if (!key) return "unknown";
  if (/^(sk|pk)_live_/.test(key)) return "live";
  if (/^(sk|pk)_test_/.test(key)) return "test";
  return "unknown";
}

async function requireSecretKey(): Promise<string> {
  const { secretKey } = await getPaystackCredentials();
  if (!secretKey) throw new Error("Paystack isn't configured yet — set it up in Site Settings or the PAYSTACK_SECRET_KEY environment variable.");
  return secretKey;
}

/** The public key is safe to expose to the browser (e.g. for Paystack's
 * inline JS popup, if that's used instead of the hosted redirect flow). */
export async function getPaystackPublicKey(): Promise<string | undefined> {
  const { publicKey } = await getPaystackCredentials();
  return publicKey;
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
  const secretKey = await requireSecretKey();
  // A fresh reference per attempt: if a customer retries the same order, Paystack
  // refuses a reference it has already seen ("Duplicate Transaction Reference").
  const reference = `gcb-${ourOrderId}-${Date.now().toString(36)}`;
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: amountMinorUnits,
      currency: PAYSTACK_CURRENCY,
      reference,
      callback_url: callbackUrl,
      channels: options?.channels,
      metadata: { ourOrderId },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const reason = await readPaystackError(res);
    // Server log only: the real reason, the amount and currency we sent - never the key.
    console.error(`[paystack] initialize failed: HTTP ${res.status} - ${reason} (currency ${PAYSTACK_CURRENCY}, amount ${amountMinorUnits}, order ${ourOrderId})`);
    throw new Error(`Paystack declined to start the payment: ${reason}`);
  }
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
  /** What Paystack says was actually paid: minor units (cents) and currency. */
  amountMinor: number | null;
  currency: string | null;
  authorization: { code: string; reusable: boolean; cardType: string; last4: string; bank: string } | null;
}> {
  const secretKey = await requireSecretKey();
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  if (!res.ok) return { success: false, ourOrderId: null, amountMinor: null, currency: null, authorization: null };
  const data = await res.json();
  const success = data.data?.status === "success";
  const ourOrderId = data.data?.metadata?.ourOrderId ?? null;
  const auth = data.data?.authorization;
  const authorization =
    auth && auth.reusable
      ? { code: auth.authorization_code, reusable: true, cardType: auth.card_type, last4: auth.last4, bank: auth.bank }
      : null;
  const amountMinor = typeof data.data?.amount === "number" ? data.data.amount : null;
  const currency = typeof data.data?.currency === "string" ? data.data.currency : null;
  return { success, ourOrderId, amountMinor, currency, authorization };
}

/** Charges a previously-saved, reusable authorization token directly —
 * no hosted redirect needed, since the card was already verified once.
 * This is how "pay with saved card" works at checkout. */
export async function chargeAuthorization(
  authorizationCode: string,
  email: string,
  amountMinorUnits: number,
  ourOrderId: string
): Promise<{ success: boolean; reference?: string; amountMinor?: number; currency?: string; error?: string }> {
  const secretKey = await requireSecretKey();
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/charge_authorization`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      authorization_code: authorizationCode,
      email,
      amount: amountMinorUnits,
      currency: PAYSTACK_CURRENCY,
      metadata: { ourOrderId },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const reason = await readPaystackError(res);
    console.error(`[paystack] saved-card charge failed: HTTP ${res.status} - ${reason} (order ${ourOrderId})`);
    return { success: false, error: reason };
  }
  const data = await res.json();
  return {
    success: data.data?.status === "success",
    reference: data.data?.reference,
    amountMinor: typeof data.data?.amount === "number" ? data.data.amount : undefined,
    currency: typeof data.data?.currency === "string" ? data.data.currency : undefined,
  };
}

/** Verifies the `x-paystack-signature` header via HMAC-SHA512 of the raw
 * body with the secret key — Paystack's documented webhook verification.
 * Async since the secret key may come from the database. */
export async function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const secretKey = await requireSecretKey();
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return expected === signatureHeader;
}
