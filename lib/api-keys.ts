import { prisma } from "@/lib/prisma";
import type { ApiKeys } from "@/lib/site-settings";
import { resolveLuluEnvironment, normaliseEnabledLevels, type LuluEnvironment, type LuluShippingLevel } from "@/lib/lulu-order";
import { pickPaypalKeys, pickPaystackKeys, resolvePaypalMode, resolvePaystackMode, type PaypalMode, type PaystackMode } from "@/lib/payment-env";

/**
 * Resolves live credentials, preferring what's saved in Site Settings
 * (backend-editable, see actions/site-settings.ts) over environment
 * variables — lets George manage these from the admin panel instead of
 * needing help editing Vercel's environment variables.
 *
 * Rebuilt per explicit instruction: PayPal removed. Paystack now uses a
 * single secret/public pair (not separate test/live pairs) — paymentMode
 * is just a label for which kind of key is currently entered. Lulu is
 * backend-manageable too. Payouts (author/affiliate) are executed
 * manually by an admin outside this system — see actions/admin.ts and
 * actions/payouts.ts — so there's no payout-gateway credential here.
 */

async function getStoredApiKeys(): Promise<ApiKeys | null> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    return (setting?.value as { apiKeys?: ApiKeys } | undefined)?.apiKeys ?? null;
  } catch {
    return null;
  }
}

/** Which Lulu system (sandbox or production) print orders go to — see
 * resolveLuluEnvironment in lib/lulu-order.ts for the precedence. */
export async function getLuluEnvironment(): Promise<LuluEnvironment> {
  const stored = await getStoredApiKeys();
  return resolveLuluEnvironment({ stored: stored?.luluEnvironment, envVar: process.env.LULU_ENV, paymentMode: stored?.paymentMode });
}

/** Shipping methods the store offers customers for printed copies (set in
 * Admin → API Management). Defaults to all of them. */
export async function getEnabledShippingLevels(): Promise<LuluShippingLevel[]> {
  const stored = await getStoredApiKeys();
  return normaliseEnabledLevels(stored?.luluShippingLevels);
}

export async function getLuluCredentials(): Promise<{ clientKey: string | undefined; clientSecret: string | undefined }> {
  const stored = await getStoredApiKeys();
  return {
    clientKey: stored?.luluClientKey?.trim() || process.env.LULU_CLIENT_KEY || process.env.LULU_API_KEY,
    clientSecret: stored?.luluClientSecret?.trim() || process.env.LULU_CLIENT_SECRET,
  };
}

export async function getPaystackCredentials(): Promise<{ secretKey: string | undefined; publicKey: string | undefined; mode: "test" | "live" }> {
  const stored = await getStoredApiKeys();
  const { mode } = resolvePaystackMode(process.env, stored?.paymentMode);
  const keys = pickPaystackKeys(mode, process.env, { secretKey: stored?.paystackSecretKey, publicKey: stored?.paystackPublicKey });
  return { secretKey: keys.secretKey, publicKey: keys.publicKey, mode };
}

/** Which mode each provider is in and where that choice came from (never any key). Used for the admin-only notice. */
export async function getPaymentModes(): Promise<{ paystack: { mode: PaystackMode; source: string }; paypal: { mode: PaypalMode; source: string } }> {
  const stored = await getStoredApiKeys();
  return {
    paystack: resolvePaystackMode(process.env, stored?.paymentMode),
    paypal: resolvePaypalMode(process.env, stored?.paypalEnvironment),
  };
}

/** The id PayPal gives a webhook when you add it in the PayPal dashboard - one per mode
 * (PAYPAL_SANDBOX_WEBHOOK_ID / PAYPAL_LIVE_WEBHOOK_ID). Only ever read from environment variables, never stored in the database. */
export async function getPaypalWebhookId(): Promise<string | undefined> {
  return (await getPaypalCredentials()).webhookId;
}

export async function getPaypalCredentials(): Promise<{ clientId: string | undefined; clientSecret: string | undefined; environment: "sandbox" | "live"; webhookId: string | undefined }> {
  const stored = await getStoredApiKeys();
  const { mode } = resolvePaypalMode(process.env, stored?.paypalEnvironment);
  return pickPaypalKeys(mode, process.env, { clientId: stored?.paypalClientId, clientSecret: stored?.paypalClientSecret, environment: stored?.paypalEnvironment });
}
