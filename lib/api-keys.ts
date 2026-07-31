import { prisma } from "@/lib/prisma";
import type { ApiKeys } from "@/lib/site-settings";

/**
 * Resolves live credentials, preferring what's saved in Site Settings
 * (backend-editable, see actions/site-settings.ts) over environment
 * variables — lets George manage these from the admin panel instead of
 * needing help editing Vercel's environment variables.
 *
 * Rebuilt per explicit instruction: PayPal removed. Paystack now uses a
 * single secret/public pair (not separate test/live pairs) — paymentMode
 * is just a label for which kind of key is currently entered. Wise and
 * Lulu are both backend-manageable now too.
 */

async function getStoredApiKeys(): Promise<ApiKeys | null> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    return (setting?.value as { apiKeys?: ApiKeys } | undefined)?.apiKeys ?? null;
  } catch {
    return null;
  }
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
  return {
    secretKey: stored?.paystackSecretKey?.trim() || process.env.PAYSTACK_SECRET_KEY,
    publicKey: stored?.paystackPublicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY,
    mode: stored?.paymentMode ?? "test",
  };
}

export async function getWiseCredentials(): Promise<{ apiToken: string | undefined; profileId: string | undefined }> {
  const stored = await getStoredApiKeys();
  return {
    apiToken: stored?.wiseApiToken?.trim() || process.env.WISE_API_TOKEN,
    profileId: stored?.wiseProfileId?.trim() || process.env.WISE_PROFILE_ID,
  };
}
