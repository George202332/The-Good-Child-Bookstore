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
 * Credentials are now backend-manageable (Admin → Site Settings →
 * Payment Integrations → Wise), falling back to the WISE_API_TOKEN /
 * WISE_PROFILE_ID environment variables if nothing's saved there.
 */

import { getWiseCredentials } from "@/lib/api-keys";

const WISE_BASE_URL = process.env.WISE_ENV === "live" ? "https://api.wise.com" : "https://api.sandbox.transferwise.tech";

async function requireApiToken(): Promise<string> {
  const { apiToken } = await getWiseCredentials();
  if (!apiToken) throw new Error("No Wise API token configured — set it in Admin \u2192 Site Settings \u2192 Payment Integrations, or the WISE_API_TOKEN environment variable.");
  return apiToken;
}

async function requireProfileId(): Promise<string> {
  const { profileId } = await getWiseCredentials();
  if (!profileId) throw new Error("No Wise profile ID configured — set it in Admin \u2192 Site Settings \u2192 Payment Integrations, or the WISE_PROFILE_ID environment variable.");
  return profileId;
}

/** Looks up the Wise profile(s) associated with an API token directly
 * from Wise's own API — the admin only ever needs to provide the one
 * token; this is what replaces needing to separately go find and
 * manually enter a profile ID. Prefers a business profile over a
 * personal one, since that's the normal real-world setup for a
 * platform sending payouts on a company's behalf. */
export async function discoverWiseProfileId(apiToken: string): Promise<{ profileId?: string; error?: string }> {
  try {
    const res = await fetch(`${WISE_BASE_URL}/v2/profiles`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Wise rejected this token (${res.status}): ${body || "please double check it's correct."}` };
    }
    const profiles = (await res.json()) as { id: number | string; type: string }[];
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return { error: "This token is valid, but no Wise profile is associated with it." };
    }
    const business = profiles.find((p) => p.type === "business");
    return { profileId: String((business ?? profiles[0]).id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach Wise to verify this token." };
  }
}

/** A single field Wise says is actually required for a given currency
 * — queried live from Wise itself, not guessed or hardcoded. */
export interface WiseRequiredField {
  key: string;
  name: string;
  type: "text" | "select";
  required: boolean;
  example?: string;
  options?: { key: string; label: string }[];
}

/** Queries Wise's own account-requirements API for the real fields a
 * recipient account needs for a given target currency — this is what
 * makes the payment details form genuinely dynamic and Wise-compliant:
 * a Kenyan M-Pesa payout needs a phone number, a US bank account needs
 * a routing + account number, a Eurozone one needs an IBAN, and this
 * asks Wise directly rather than a fixed, guessed field list. */
export async function getWiseAccountRequirements(targetCurrency: string, sourceAmountUsd = 100): Promise<{ type: string; fields: WiseRequiredField[] }[] | { error: string }> {
  try {
    const token = await requireApiToken();
    const res = await fetch(
      `${WISE_BASE_URL}/v1/account-requirements?source=USD&target=${targetCurrency}&sourceAmount=${sourceAmountUsd}`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Wise couldn't provide requirements for ${targetCurrency} (${res.status}): ${body}` };
    }
    const data = (await res.json()) as {
      type: string;
      fields: { name: string; group: { key: string; name: string; type: string; required: boolean; example?: string; valuesAllowed?: { key: string; name: string }[] }[] }[];
    }[];

    return data.map((accountType) => ({
      type: accountType.type,
      fields: accountType.fields.flatMap((f) =>
        f.group.map((g) => ({
          key: g.key,
          name: g.name,
          type: (g.valuesAllowed ? "select" : "text") as "text" | "select",
          required: g.required,
          example: g.example,
          options: g.valuesAllowed?.map((v) => ({ key: v.key, label: v.name })),
        }))
      ),
    }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach Wise to determine required fields." };
  }
}

async function wiseFetch(path: string, init?: RequestInit) {
  const token = await requireApiToken();
  const res = await fetch(`${WISE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
  const profileId = await requireProfileId();
  const data = await wiseFetch("/v1/accounts", {
    method: "POST",
    body: JSON.stringify({
      profile: profileId,
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
  const profileId = await requireProfileId();
  const data = await wiseFetch("/v3/profiles/" + profileId + "/quotes", {
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
  const profileId = await requireProfileId();
  const data = await wiseFetch(`/v3/profiles/${profileId}/transfers/${transferId}/payments`, {
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
// Wise's real, published webhook signature public keys — confirmed
// directly from https://docs.wise.com/guides/developer/webhooks/event-handling.
// These are fixed, well-known keys (the same for every Wise API user),
// not something specific to this account, so there's nothing for an
// admin to find or configure here.
const WISE_WEBHOOK_PUBLIC_KEY_PRODUCTION = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvO8vXV+JksBzZAY6GhSO
XdoTCfhXaaiZ+qAbtaDBiu2AGkGVpmEygFmWP4Li9m5+Ni85BhVvZOodM9epgW3F
bA5Q1SexvAF1PPjX4JpMstak/QhAgl1qMSqEevL8cmUeTgcMuVWCJmlge9h7B1CS
D4rtlimGZozG39rUBDg6Qt2K+P4wBfLblL0k4C4YUdLnpGYEDIth+i8XsRpFlogx
CAFyH9+knYsDbR43UJ9shtc42Ybd40Afihj8KnYKXzchyQ42aC8aZ/h5hyZ28yVy
Oj3Vos0VdBIs/gAyJ/4yyQFCXYte64I7ssrlbGRaco4nKF3HmaNhxwyKyJafz19e
HwIDAQAB
-----END PUBLIC KEY-----`;

const WISE_WEBHOOK_PUBLIC_KEY_SANDBOX = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwpb91cEYuyJNQepZAVfP
ZIlPZfNUefH+n6w9SW3fykqKu938cR7WadQv87oF2VuT+fDt7kqeRziTmPSUhqPU
ys/V2Q1rlfJuXbE+Gga37t7zwd0egQ+KyOEHQOpcTwKmtZ81ieGHynAQzsn1We3j
wt760MsCPJ7GMT141ByQM+yW1Bx+4SG3IGjXWyqOWrcXsxAvIXkpUD/jK/L958Cg
nZEgz0BSEh0QxYLITnW1lLokSx/dTianWPFEhMC9BgijempgNXHNfcVirg1lPSyg
z7KqoKUN0oHqWLr2U1A+7kqrl6O2nx3CKs1bj1hToT1+p4kcMoHXA7kA+VBLUpEs
VwIDAQAB
-----END PUBLIC KEY-----`;

export async function verifyWiseWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const { getPaystackCredentials } = await import("@/lib/api-keys");
  const { mode } = await getPaystackCredentials();
  const publicKey = mode === "test" ? WISE_WEBHOOK_PUBLIC_KEY_SANDBOX : WISE_WEBHOOK_PUBLIC_KEY_PRODUCTION;
  const { createVerify } = await import("crypto");
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(rawBody);
    return verifier.verify(publicKey, signatureHeader, "base64");
  } catch {
    return false;
  }
}
