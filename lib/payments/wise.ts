/**
 * Wise integration — ALL author/affiliate payouts go through Wise now
 * (explicit instruction: Paystack's payout coverage is too limited
 * internationally). This follows Wise's real, documented multi-step
 * transfer flow: create/reuse a recipient account → create a quote →
 * create a transfer against that quote → fund the transfer. Supports
 * any account type Wise itself supports (bank transfer, mobile money
 * including M-Pesa in Kenya, email, etc.) — the `type`/`details` shape
 * is passed straight through to Wise's Recipient Accounts API, so
 * whatever Wise adds support for works here without code changes.
 *
 * Same caveat as the PayPal/Paystack integrations: real, correct
 * integration code against Wise's documented API, not exercised against
 * a live Wise sandbox account, since this environment has no network
 * access and no real API token configured. Wire it in by setting
 * WISE_API_TOKEN and WISE_PROFILE_ID (see .env.example).
 */

const WISE_BASE_URL = process.env.WISE_ENV === "live" ? "https://api.wise.com" : "https://api.sandbox.transferwise.tech";

function requireApiToken(): string {
  const token = process.env.WISE_API_TOKEN;
  if (!token) throw new Error("WISE_API_TOKEN is not set.");
  return token;
}

function requireProfileId(): string {
  const profileId = process.env.WISE_PROFILE_ID;
  if (!profileId) throw new Error("WISE_PROFILE_ID is not set.");
  return profileId;
}

async function wiseFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${WISE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireApiToken()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Wise API error (${res.status}) at ${path}: ${body}`);
  }
  return res.json();
}

export interface CreateWiseRecipientInput {
  currency: string;
  type: string; // e.g. "mpesa", "iban", "sort_code", "email" — matches Wise's own account type names
  accountHolderName: string;
  details: Record<string, unknown>; // e.g. { phoneNumber: "+254712345678" } for mpesa
}

/** Registers a recipient account with Wise (the destination for future
 * payouts) and returns Wise's own recipient id to store alongside our
 * WiseRecipient row. */
export async function createWiseRecipient(input: CreateWiseRecipientInput): Promise<{ wiseRecipientId: string }> {
  const data = await wiseFetch("/v1/accounts", {
    method: "POST",
    body: JSON.stringify({
      profile: requireProfileId(),
      currency: input.currency,
      type: input.type,
      accountHolderName: input.accountHolderName,
      details: input.details,
    }),
  });
  return { wiseRecipientId: String(data.id) };
}

/** Step 1 of paying out: a quote locks in the exchange rate and fee for
 * moving `sourceAmount` USD into the recipient's currency. */
export async function createWiseQuote(sourceAmountUsd: number, targetCurrency: string): Promise<{ quoteId: string }> {
  const data = await wiseFetch("/v3/profiles/" + requireProfileId() + "/quotes", {
    method: "POST",
    body: JSON.stringify({
      sourceCurrency: "USD",
      targetCurrency,
      sourceAmount: sourceAmountUsd,
    }),
  });
  return { quoteId: String(data.id) };
}

/** Step 2: creates the transfer itself against a quote + recipient,
 * tagged with our own PayoutRequest id as the customer transaction id
 * (Wise's idempotency key) so retries never double-pay. */
export async function createWiseTransfer(
  quoteId: string,
  wiseRecipientId: string,
  ourPayoutRequestId: string
): Promise<{ transferId: string }> {
  const data = await wiseFetch("/v1/transfers", {
    method: "POST",
    body: JSON.stringify({
      targetAccount: wiseRecipientId,
      quoteUuid: quoteId,
      customerTransactionId: ourPayoutRequestId,
      details: { reference: `Payout ${ourPayoutRequestId}` },
    }),
  });
  return { transferId: String(data.id) };
}

/** Step 3: funds the transfer from our Wise balance — the money actually
 * moves once this succeeds. */
export async function fundWiseTransfer(transferId: string): Promise<{ funded: boolean }> {
  const data = await wiseFetch(`/v3/profiles/${requireProfileId()}/transfers/${transferId}/payments`, {
    method: "POST",
    body: JSON.stringify({ type: "BALANCE" }),
  });
  return { funded: data.status === "COMPLETED" };
}

/** Runs all three steps in sequence — the normal path for
 * approvePayoutRequest() (actions/admin.ts). */
export async function executeWisePayout(
  amountUsd: number,
  targetCurrency: string,
  wiseRecipientId: string,
  ourPayoutRequestId: string
): Promise<{ ok: boolean; transferId?: string; error?: string }> {
  try {
    const { quoteId } = await createWiseQuote(amountUsd, targetCurrency);
    const { transferId } = await createWiseTransfer(quoteId, wiseRecipientId, ourPayoutRequestId);
    const { funded } = await fundWiseTransfer(transferId);
    return { ok: funded, transferId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Wise payout failed." };
  }
}

/** Verifies a Wise webhook's signature — Wise signs events with an
 * RSA-SHA256 signature over the raw body, verifiable with their public
 * key (delivered alongside your webhook subscription). */
export async function verifyWiseWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const publicKey = process.env.WISE_WEBHOOK_PUBLIC_KEY;
  if (!publicKey || !signatureHeader) return false;
  const { createVerify } = await import("crypto");
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(rawBody);
    return verifier.verify(publicKey, signatureHeader, "base64");
  } catch {
    return false;
  }
}
