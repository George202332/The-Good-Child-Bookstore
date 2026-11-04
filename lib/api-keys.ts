import { prisma } from "@/lib/prisma";
import { normaliseEnabledLevels, type LuluEnvironment, type LuluShippingLevel } from "@/lib/lulu-order";
import { resolveLuluKeys, resolvePaypalKeys, resolvePaystackKeys } from "@/lib/payment-env";
import { deploymentOf, evaluatePaymentSafety, expectedKeySet, type Deployment, type KeySet, type PaymentSafety } from "@/lib/runtime-env";

/**
 * Where every credential comes from: ONLY Vercel environment variables (names in lib/payment-env.ts). Nothing is read from, or
 * stored in, the database. Which key set is used (test or live) is decided only by the environment (VERCEL_ENV): the live site
 * reads the LIVE variables, staging reads the TEST/SANDBOX ones.
 *
 * Safeguard: if the wrong key set is found for the environment (e.g. a TEST variable on Production, a LIVE one on staging, or
 * a key of the wrong kind), that provider reports no key, so checkout offers no way to pay with it and shows the customer a
 * friendly message; Site Health flags it and emails an alert. Webhook checks for a payment that ALREADY happened use the
 * environment's own key as it is.
 */

export async function getPaymentSafety(): Promise<{ paystack: PaymentSafety; paypal: PaymentSafety; deployment: Deployment; set: KeySet }> {
  const deployment = deploymentOf();
  const ps = resolvePaystackKeys(process.env, deployment);
  const pp = resolvePaypalKeys(process.env, deployment);
  return {
    deployment,
    set: expectedKeySet(deployment),
    paystack: evaluatePaymentSafety({ deployment, provider: "paystack", hasKeys: ps.hasKeys, wrongSetNames: ps.wrongSetNames, kindMismatch: ps.kindMismatch }),
    paypal: evaluatePaymentSafety({ deployment, provider: "paypal", hasKeys: pp.hasKeys, wrongSetNames: pp.wrongSetNames, kindMismatch: false }),
  };
}

/** Lulu has one live system and no sandbox. Real print orders are controlled elsewhere (see lib/payments/lulu.ts). */
export async function getLuluEnvironment(): Promise<LuluEnvironment> {
  return "production";
}

/** Shipping methods the store offers customers for printed copies (a plain, non-secret choice, edited in Site Management). */
export async function getEnabledShippingLevels(): Promise<LuluShippingLevel[]> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    const raw = (setting?.value as { apiKeys?: { luluShippingLevels?: unknown } } | undefined)?.apiKeys?.luluShippingLevels;
    return normaliseEnabledLevels(raw);
  } catch {
    return normaliseEnabledLevels(undefined);
  }
}

export async function getLuluCredentials(): Promise<{ clientKey: string | undefined; clientSecret: string | undefined }> {
  return resolveLuluKeys(process.env);
}

/** The Paystack keys, or no key when a safeguard has switched Paystack off. */
export async function getPaystackCredentials(): Promise<{ secretKey: string | undefined; publicKey: string | undefined; mode: "test" | "live"; blocked?: string; customerMessage?: string }> {
  const k = resolvePaystackKeys(process.env, deploymentOf());
  const safety = (await getPaymentSafety()).paystack;
  if (!safety.allowed) return { secretKey: undefined, publicKey: undefined, mode: k.set, blocked: safety.safeguard ? safety.reason : undefined, customerMessage: safety.customerMessage };
  return { secretKey: k.secretKey, publicKey: k.publicKey, mode: k.set };
}

/** The environment's own Paystack secret key, for confirming a payment or webhook that already happened. Server use only. */
export function getPaystackSecretForVerification(): string | undefined {
  return resolvePaystackKeys(process.env, deploymentOf()).secretKey;
}

export async function getPaypalCredentials(): Promise<{ clientId: string | undefined; clientSecret: string | undefined; environment: "sandbox" | "live"; webhookId: string | undefined; blocked?: string; customerMessage?: string }> {
  const k = resolvePaypalKeys(process.env, deploymentOf());
  const safety = (await getPaymentSafety()).paypal;
  if (!safety.allowed) return { clientId: undefined, clientSecret: undefined, environment: k.environment, webhookId: k.webhookId, blocked: safety.safeguard ? safety.reason : undefined, customerMessage: safety.customerMessage };
  return { clientId: k.clientId, clientSecret: k.clientSecret, environment: k.environment, webhookId: k.webhookId };
}

/** The environment's own PayPal webhook id (PAYPAL_SANDBOX_WEBHOOK_ID on staging, PAYPAL_LIVE_WEBHOOK_ID on Production). */
export async function getPaypalWebhookId(): Promise<string | undefined> {
  return resolvePaypalKeys(process.env, deploymentOf()).webhookId;
}

/** Which mode each provider is in (never any key): decided by the environment only. */
export async function getPaymentModes(): Promise<{ paystack: { mode: "test" | "live"; source: string }; paypal: { mode: "sandbox" | "live"; source: string } }> {
  const set = expectedKeySet(deploymentOf());
  return { paystack: { mode: set, source: "environment" }, paypal: { mode: set === "live" ? "live" : "sandbox", source: "environment" } };
}
