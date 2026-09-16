/**
 * Payoneer integration — the second of two payout gateways (alongside
 * Wise). An author/affiliate chooses one or the other as their payout
 * method (see WiseRecipient.gateway); each payout is tied to exactly
 * one recipient, so it only ever goes through exactly one gateway —
 * combined with the atomic claim in approvePayoutRequest
 * (actions/admin.ts), this is what actually makes double-paying the
 * same payout through both systems impossible, not just unlikely.
 *
 * Follows Payoneer's real, documented Payouts API: an OAuth2
 * client-credentials token exchange, then a payout request against an
 * already-registered payee id. Same honest caveat as the Wise
 * integration when it was first built: this is real, correct
 * integration code written against Payoneer's own API documentation,
 * not exercised against a live Payoneer sandbox account, since this
 * environment has no network access to Payoneer and no real
 * credentials configured. Wire it in by setting a Payoneer client ID
 * and secret in Admin → Site Settings → Payment Integrations, and make
 * sure the gateway is switched on there before relying on it.
 */

import { getPayoneerCredentials } from "@/lib/api-keys";

const PAYONEER_BASE_URL = process.env.PAYONEER_ENV === "live"
  ? "https://api.payoneer.com"
  : "https://api.sandbox.payoneer.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const { clientId, clientSecret } = await getPayoneerCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("No Payoneer credentials configured — set them in Admin \u2192 Site Settings \u2192 Payment Integrations.");
  }

  const res = await fetch(`${PAYONEER_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "payouts" }),
  });
  if (!res.ok) throw new Error(`Payoneer authentication failed (${res.status}).`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3300) * 1000 };
  return cachedToken.token;
}

async function payoneerFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYONEER_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Payoneer API error (${res.status}) at ${path}: ${body}`);
  }
  return res.json();
}

/** Sends a payout to an already-registered Payoneer payee — matches
 * executeWisePayout's signature exactly, so the two gateways are
 * interchangeable from the caller's point of view. */
export async function executePayoneerPayout(
  amountUsd: number,
  targetCurrency: string,
  payoneerRecipientId: string,
  ourPayoutRequestId: string
): Promise<{ ok: boolean; transferId?: string; error?: string }> {
  try {
    const data = await payoneerFetch("/v2/programs/payouts", {
      method: "POST",
      body: JSON.stringify({
        payee_id: payoneerRecipientId,
        amount: amountUsd.toFixed(2),
        currency: targetCurrency,
        description: `Payout ${ourPayoutRequestId}`,
        client_reference_id: ourPayoutRequestId,
      }),
    });
    return { ok: true, transferId: String(data.payout_id ?? data.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Payoneer payout failed." };
  }
}

/** Registers a payee with Payoneer (the destination for future
 * payouts) — mirrors createWiseRecipient's role for the Wise gateway. */
export async function createPayoneerRecipient(input: {
  currency: string;
  accountHolderName: string;
  email: string;
  details: Record<string, unknown>;
}): Promise<{ payoneerRecipientId: string }> {
  const data = await payoneerFetch("/v2/programs/payees", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      name: input.accountHolderName,
      currency: input.currency,
      ...input.details,
    }),
  });
  return { payoneerRecipientId: String(data.payee_id ?? data.id) };
}
