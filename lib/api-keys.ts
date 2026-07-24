import { prisma } from "@/lib/prisma";
import type { ApiKeys } from "@/lib/site-settings";

/**
 * Resolves live payment credentials, preferring what's saved in Site
 * Settings (backend-editable, see actions/site-settings.ts) over
 * environment variables — lets George manage these from the admin panel
 * instead of needing help editing Vercel's environment variables.
 *
 * Both PayPal and Paystack issue separate test/live credential pairs;
 * apiKeys.paymentMode picks which pair is actually used, so switching
 * environments is one toggle rather than re-entering keys. Falls back to
 * the equivalent environment variables (still mode-aware, e.g.
 * PAYPAL_ENV) if nothing's saved in the database yet.
 */

async function getStoredApiKeys(): Promise<ApiKeys | null> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    return (setting?.value as { apiKeys?: ApiKeys } | undefined)?.apiKeys ?? null;
  } catch {
    return null;
  }
}

export async function getLuluApiKey(): Promise<string | undefined> {
  const stored = await getStoredApiKeys();
  return stored?.luluApiKey?.trim() || process.env.LULU_API_KEY;
}

export async function getPayPalCredentials(): Promise<{ clientId: string | undefined; clientSecret: string | undefined; live: boolean }> {
  const stored = await getStoredApiKeys();
  const mode = stored?.paymentMode ?? (process.env.PAYPAL_ENV === "live" ? "live" : "test");
  const live = mode === "live";

  if (live) {
    return {
      clientId: stored?.paypalLiveClientId?.trim() || process.env.PAYPAL_CLIENT_ID,
      clientSecret: stored?.paypalLiveClientSecret?.trim() || process.env.PAYPAL_CLIENT_SECRET,
      live: true,
    };
  }
  return {
    clientId: stored?.paypalSandboxClientId?.trim() || process.env.PAYPAL_CLIENT_ID,
    clientSecret: stored?.paypalSandboxClientSecret?.trim() || process.env.PAYPAL_CLIENT_SECRET,
    live: false,
  };
}

export async function getPaystackCredentials(): Promise<{ secretKey: string | undefined; publicKey: string | undefined; live: boolean }> {
  const stored = await getStoredApiKeys();
  const mode = stored?.paymentMode ?? "test";
  const live = mode === "live";

  if (live) {
    return {
      secretKey: stored?.paystackLiveSecretKey?.trim() || process.env.PAYSTACK_SECRET_KEY,
      publicKey: stored?.paystackLivePublicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY,
      live: true,
    };
  }
  return {
    secretKey: stored?.paystackTestSecretKey?.trim() || process.env.PAYSTACK_SECRET_KEY,
    publicKey: stored?.paystackTestPublicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY,
    live: false,
  };
}
