/**
 * One mode setting per payment provider, and the matching keys.
 *
 * Paystack: PAYSTACK_MODE = "test" | "live"
 *   keys   : PAYSTACK_TEST_SECRET_KEY / PAYSTACK_TEST_PUBLIC_KEY and PAYSTACK_LIVE_SECRET_KEY / PAYSTACK_LIVE_PUBLIC_KEY
 *   webhook: Paystack signs every webhook with the SECRET key of the same mode, so the matching secret key is also
 *            the webhook secret (nothing extra to store).
 * PayPal : PAYPAL_MODE = "sandbox" | "live"
 *   keys   : PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET / PAYPAL_SANDBOX_WEBHOOK_ID and the PAYPAL_LIVE_ versions
 *   address: sandbox -> https://api-m.sandbox.paypal.com, live -> https://api-m.paypal.com
 *
 * The older single-key variables (PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
 * PAYPAL_ENV, PAYPAL_WEBHOOK_ID) and keys typed into Admin -> API Management still work, but only when they belong to
 * the active mode. A test key is never used in live mode and a live key is never used in test mode.
 *
 * This file is pure (no database, no secrets printed) so it can be tested.
 */

export type PaystackMode = "test" | "live";
export type PaypalMode = "sandbox" | "live";

export interface Env { [name: string]: string | undefined }

const clean = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Which kind of Paystack key this is, judged from its public prefix only. */
export function paystackKeyKind(key: string | undefined): "test" | "live" | "unknown" {
  if (!key) return "unknown";
  if (/^(sk|pk)_live_/.test(key)) return "live";
  if (/^(sk|pk)_test_/.test(key)) return "test";
  return "unknown";
}

export function parsePaystackMode(v: string | null | undefined): PaystackMode | undefined {
  const t = clean(v)?.toLowerCase();
  if (t === "live" || t === "production") return "live";
  if (t === "test" || t === "sandbox") return "test";
  return undefined;
}

export function parsePaypalMode(v: string | null | undefined): PaypalMode | undefined {
  const t = clean(v)?.toLowerCase();
  if (t === "live" || t === "production") return "live";
  if (t === "sandbox" || t === "test") return "sandbox";
  return undefined;
}

export interface ModeChoice<M> { mode: M; source: "environment" | "admin settings" | "default" }

/** PAYSTACK_MODE (Vercel) decides when it is set; otherwise the mode chosen in Admin -> API Management; otherwise test. */
export function resolvePaystackMode(env: Env, adminMode?: string | null): ModeChoice<PaystackMode> {
  const fromEnv = parsePaystackMode(env.PAYSTACK_MODE);
  if (fromEnv) return { mode: fromEnv, source: "environment" };
  const fromAdmin = parsePaystackMode(adminMode);
  if (fromAdmin) return { mode: fromAdmin, source: "admin settings" };
  return { mode: "test", source: "default" };
}

/** PAYPAL_MODE (Vercel) decides when it is set; then the admin choice; then the old PAYPAL_ENV; otherwise sandbox. */
export function resolvePaypalMode(env: Env, adminMode?: string | null): ModeChoice<PaypalMode> {
  const fromEnv = parsePaypalMode(env.PAYPAL_MODE);
  if (fromEnv) return { mode: fromEnv, source: "environment" };
  const fromAdmin = parsePaypalMode(adminMode);
  if (fromAdmin) return { mode: fromAdmin, source: "admin settings" };
  const legacy = parsePaypalMode(env.PAYPAL_ENV);
  if (legacy) return { mode: legacy, source: "environment" };
  return { mode: "sandbox", source: "default" };
}

export interface PaystackKeys { mode: PaystackMode; secretKey: string | undefined; publicKey: string | undefined }

/** The Paystack keys for the active mode. Order: this mode's own variables, then keys saved in admin, then the old single variables. */
export function pickPaystackKeys(mode: PaystackMode, env: Env, stored: { secretKey?: string; publicKey?: string }): PaystackKeys {
  const up = mode === "live" ? "LIVE" : "TEST";
  const fits = (k: string | undefined) => (k && paystackKeyKind(k) === mode ? k : undefined);
  const secretKey = clean(env[`PAYSTACK_${up}_SECRET_KEY`]) ?? fits(clean(stored.secretKey)) ?? fits(clean(env.PAYSTACK_SECRET_KEY));
  const publicKey = clean(env[`PAYSTACK_${up}_PUBLIC_KEY`]) ?? fits(clean(stored.publicKey)) ?? fits(clean(env.PAYSTACK_PUBLIC_KEY));
  return { mode, secretKey, publicKey };
}

export interface PaypalKeys { environment: PaypalMode; clientId: string | undefined; clientSecret: string | undefined; webhookId: string | undefined }

/** The PayPal credentials for the active mode. The old single variables only count when they were meant for this mode. */
export function pickPaypalKeys(
  mode: PaypalMode,
  env: Env,
  stored: { clientId?: string; clientSecret?: string; environment?: string | null },
): PaypalKeys {
  const up = mode === "live" ? "LIVE" : "SANDBOX";
  const legacyMode = parsePaypalMode(env.PAYPAL_ENV) ?? "sandbox";
  const storedMode = parsePaypalMode(stored.environment) ?? "sandbox";
  const storedFits = storedMode === mode;
  const legacyFits = legacyMode === mode;
  return {
    environment: mode,
    clientId: clean(env[`PAYPAL_${up}_CLIENT_ID`]) ?? (storedFits ? clean(stored.clientId) : undefined) ?? (legacyFits ? clean(env.PAYPAL_CLIENT_ID) : undefined),
    clientSecret: clean(env[`PAYPAL_${up}_CLIENT_SECRET`]) ?? (storedFits ? clean(stored.clientSecret) : undefined) ?? (legacyFits ? clean(env.PAYPAL_CLIENT_SECRET) : undefined),
    webhookId: clean(env[`PAYPAL_${up}_WEBHOOK_ID`]) ?? (legacyFits ? clean(env.PAYPAL_WEBHOOK_ID) : undefined),
  };
}

/** Names of the variables to create (never values), for the admin help text and the report. */
export const PAYMENT_ENV_NAMES = {
  paystack: ["PAYSTACK_MODE", "PAYSTACK_TEST_SECRET_KEY", "PAYSTACK_TEST_PUBLIC_KEY", "PAYSTACK_LIVE_SECRET_KEY", "PAYSTACK_LIVE_PUBLIC_KEY"],
  paypal: ["PAYPAL_MODE", "PAYPAL_SANDBOX_CLIENT_ID", "PAYPAL_SANDBOX_CLIENT_SECRET", "PAYPAL_SANDBOX_WEBHOOK_ID", "PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_CLIENT_SECRET", "PAYPAL_LIVE_WEBHOOK_ID"],
} as const;
