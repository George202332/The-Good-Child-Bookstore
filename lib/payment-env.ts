/**
 * The Vercel variable names the site reads. Test keys exist ONLY on Preview (staging); live keys ONLY on Production.
 * Which set is used is decided only by the environment (VERCEL_ENV) - there is no switch anywhere.
 *
 *   Paystack  Preview : PAYSTACK_TEST_PUBLIC_KEY, PAYSTACK_TEST_SECRET_KEY
 *             Production : PAYSTACK_LIVE_PUBLIC_KEY, PAYSTACK_LIVE_SECRET_KEY
 *             (Paystack signs its webhooks with the secret key of the same mode: no separate webhook secret.)
 *   PayPal    Preview : PAYPAL_SANDBOX_CLIENT_ID, PAYPAL_SANDBOX_SECRET_KEY, PAYPAL_SANDBOX_WEBHOOK_ID
 *             Production : PAYPAL_LIVE_CLIENT_ID, PAYPAL_LIVE_SECRET_KEY, PAYPAL_LIVE_WEBHOOK_ID
 *   Lulu      both : LULU_CLIENT_KEY, LULU_CLIENT_SECRET (plain pair; the code makes the base64 form at request time)
 *   Email     both : RESEND_API_KEY, FROM_EMAIL
 *
 * Retired (no longer read): PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, PAYPAL_WEBHOOK_ID, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
 * PAYPAL_MODE, PAYPAL_ENV, PAYSTACK_MODE, LULU_API_KEY, LULU_ENV.
 * This file is pure (no database, no secret is ever printed) so it can be tested.
 */

import { expectedKeySet, paystackKeyKind, type Deployment, type Env, type KeySet } from "@/lib/runtime-env";

const clean = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

export const PAYMENT_VARIABLES = {
  paystack: {
    test: ["PAYSTACK_TEST_PUBLIC_KEY", "PAYSTACK_TEST_SECRET_KEY"],
    live: ["PAYSTACK_LIVE_PUBLIC_KEY", "PAYSTACK_LIVE_SECRET_KEY"],
  },
  paypal: {
    test: ["PAYPAL_SANDBOX_CLIENT_ID", "PAYPAL_SANDBOX_SECRET_KEY", "PAYPAL_SANDBOX_WEBHOOK_ID"],
    live: ["PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_SECRET_KEY", "PAYPAL_LIVE_WEBHOOK_ID"],
  },
} as const;

/** The variables of the OTHER key set that are present in this environment (names only). Should always be empty. */
function wrongSet(provider: "paystack" | "paypal", set: KeySet, env: Env): string[] {
  const other: KeySet = set === "live" ? "test" : "live";
  return PAYMENT_VARIABLES[provider][other].filter((n) => !!clean(env[n]));
}

export interface PaystackKeys { set: KeySet; secretKey: string | undefined; publicKey: string | undefined; hasKeys: boolean; kindMismatch: boolean; wrongSetNames: string[] }
export function resolvePaystackKeys(env: Env, deployment: Deployment): PaystackKeys {
  const set = expectedKeySet(deployment);
  const up = set === "live" ? "LIVE" : "TEST";
  const secretKey = clean(env[`PAYSTACK_${up}_SECRET_KEY`]);
  const publicKey = clean(env[`PAYSTACK_${up}_PUBLIC_KEY`]);
  const kindMismatch = (!!secretKey && paystackKeyKind(secretKey) !== set) || (!!publicKey && paystackKeyKind(publicKey) !== set);
  return { set, secretKey, publicKey, hasKeys: !!secretKey && !!publicKey, kindMismatch, wrongSetNames: wrongSet("paystack", set, env) };
}

export interface PaypalKeys { set: KeySet; environment: "sandbox" | "live"; clientId: string | undefined; clientSecret: string | undefined; webhookId: string | undefined; hasKeys: boolean; wrongSetNames: string[] }
export function resolvePaypalKeys(env: Env, deployment: Deployment): PaypalKeys {
  const set = expectedKeySet(deployment);
  const up = set === "live" ? "LIVE" : "SANDBOX";
  const clientId = clean(env[`PAYPAL_${up}_CLIENT_ID`]);
  const clientSecret = clean(env[`PAYPAL_${up}_SECRET_KEY`]);
  return {
    set, environment: set === "live" ? "live" : "sandbox", clientId, clientSecret, webhookId: clean(env[`PAYPAL_${up}_WEBHOOK_ID`]),
    hasKeys: !!clientId && !!clientSecret, wrongSetNames: wrongSet("paypal", set, env),
  };
}

export interface LuluKeys { clientKey: string | undefined; clientSecret: string | undefined }
export function resolveLuluKeys(env: Env): LuluKeys {
  return { clientKey: clean(env.LULU_CLIENT_KEY), clientSecret: clean(env.LULU_CLIENT_SECRET) };
}

/** Older variable names the site no longer reads. Do NOT delete them in Vercel until the new code is tested on staging. */
export const OLD_VARIABLE_NAMES = [
  "PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY", "PAYSTACK_MODE", "PAYPAL_WEBHOOK_ID", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
  "PAYPAL_MODE", "PAYPAL_ENV", "LULU_API_KEY", "LULU_ENV",
] as const;

export function findOldVariableNames(env: Env): string[] {
  return OLD_VARIABLE_NAMES.filter((n) => clean(env[n]));
}

/** Every variable the site cares about, grouped, for the Site Health "present / missing" table (names only, never values). */
export function variableGroups(deployment: Deployment): { group: string; names: string[] }[] {
  const set = expectedKeySet(deployment);
  return [
    { group: `Paystack (${set} keys)`, names: [...PAYMENT_VARIABLES.paystack[set]] },
    { group: `PayPal (${set === "live" ? "live" : "sandbox"} keys)`, names: [...PAYMENT_VARIABLES.paypal[set]] },
    { group: "Lulu", names: ["LULU_CLIENT_KEY", "LULU_CLIENT_SECRET"] },
    { group: "Email", names: ["RESEND_API_KEY", "FROM_EMAIL"] },
    { group: "Database and sign-in", names: ["DATABASE_URL", "AUTH_SECRET"] },
    { group: "Scheduled checks", names: ["CRON_SECRET"] },
    { group: "Optional", names: ["PRODUCTION_DATABASE_ENDPOINT", "DATABASE_LABEL", "NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXT_PUBLIC_GTM_ID", "GOOGLE_SITE_VERIFICATION"] },
  ];
}
