/**
 * Which copy of the site is running (live site, staging, or a developer's computer) and the safety rules that depend on it.
 *
 * Vercel sets VERCEL_ENV on every deployment: "production" for the live site (the main branch), "preview" for staging
 * (every other branch) and "development" for `vercel dev`. On a computer with no Vercel at all the variable is missing.
 * This file is pure (it only looks at the values it is given and never prints a key), so every rule here is tested.
 */

export type Deployment = "production" | "preview" | "development";

export interface Env { [name: string]: string | undefined }

const clean = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

export function deploymentOf(env: Env = process.env): Deployment {
  const v = clean(env.VERCEL_ENV)?.toLowerCase();
  if (v === "production" || v === "preview" || v === "development") return v;
  // Not on Vercel: a production build run on some other server counts as production, everything else as development.
  return env.NODE_ENV === "production" ? "production" : "development";
}

export const deploymentLabel = (d: Deployment): string => (d === "production" ? "Live site (Production)" : d === "preview" ? "Staging (Preview)" : "Development");

// ---------------------------------------------------------------------------------------------------------------------
// Payment-key safety
// ---------------------------------------------------------------------------------------------------------------------

export type Provider = "paystack" | "paypal";
export type KeyMode = "test" | "live" | "unknown" | "none";
export type KeySet = "test" | "live";

/** The key set this copy of the site must use. Decided only by the environment (VERCEL_ENV), never by a switch:
 * the live site (Production) uses live keys; staging (Preview) and development use test keys. */
export function expectedKeySet(deployment: Deployment): KeySet {
  return deployment === "production" ? "live" : "test";
}

export interface PaymentSafety {
  provider: Provider;
  /** The key set this environment must use. */
  expected: KeySet;
  /** true = this provider may take payments. */
  allowed: boolean;
  /** true when the provider is switched off by a SAFEGUARD (as opposed to simply not being set up). */
  safeguard: boolean;
  /** Plain-words reason for the admin and Site Health. Never contains a key. */
  reason?: string;
  /** What a customer sees instead of the payment button. */
  customerMessage?: string;
}

const NAME: Record<Provider, string> = { paystack: "Paystack", paypal: "PayPal" };
export const CUSTOMER_PAYMENT_MESSAGE = "Payments are temporarily unavailable while we fix a problem on our side. Nothing has been charged. Please try again a little later.";

/**
 * The rules, in plain words:
 *  - Test keys exist only on Preview, live keys only on Production. If the OTHER set's variables are found in this environment,
 *    or the key itself is the wrong kind, payments for that provider are refused.
 *  - A provider whose own key set is missing is simply "not set up" (not a safeguard).
 */
export function evaluatePaymentSafety(opts: { deployment: Deployment; provider: Provider; hasKeys: boolean; wrongSetNames: string[]; kindMismatch: boolean }): PaymentSafety {
  const expected = expectedKeySet(opts.deployment);
  const n = NAME[opts.provider];
  const base = { provider: opts.provider, expected };
  const where = opts.deployment === "production" ? "the live site (Production)" : opts.deployment === "preview" ? "the staging site (Preview)" : "a development copy";
  if (opts.wrongSetNames.length > 0) {
    return {
      ...base, allowed: false, safeguard: true, customerMessage: CUSTOMER_PAYMENT_MESSAGE,
      reason: `${n} payments are switched off: this is ${where}, which must use ${expected.toUpperCase()} keys only, but ${expected === "live" ? "TEST" : "LIVE"} variables were found here (${opts.wrongSetNames.join(", ")}). In Vercel, untick ${opts.deployment === "production" ? "Production" : "Preview"} on those variables.`,
    };
  }
  if (!opts.hasKeys) return { ...base, allowed: false, safeguard: false, reason: `${n} is not set up for ${expected.toUpperCase()} keys in this environment (its variables are missing in Vercel).` };
  if (opts.kindMismatch) {
    return {
      ...base, allowed: false, safeguard: true, customerMessage: CUSTOMER_PAYMENT_MESSAGE,
      reason: `${n} payments are switched off: the key in the ${expected.toUpperCase()} variable is not a ${expected} key. Check you pasted the right one.`,
    };
  }
  return { ...base, allowed: true, safeguard: false };
}

/** Paystack keys carry their kind in their first characters (sk_test_ / sk_live_ / pk_test_ / pk_live_). */
export function paystackKeyKind(key: string | undefined): "test" | "live" | "unknown" {
  if (!key) return "unknown";
  if (/^(sk|pk)_live_/.test(key)) return "live";
  if (/^(sk|pk)_test_/.test(key)) return "test";
  return "unknown";
}

/** Preview/development must refuse to start when any LIVE payment variable is present, or when the database is the production one (if PRODUCTION_DATABASE_ENDPOINT is set). Returns the plain-words reason, or null. */
export function startupRefusal(env: Env, deployment: Deployment = deploymentOf(env)): string | null {
  if (deployment === "production") return null;
  const prodEndpoint = clean(env.PRODUCTION_DATABASE_ENDPOINT);
  const here = describeDatabase(env.DATABASE_URL);
  if (prodEndpoint && here && here.endpoint === prodEndpoint) {
    return `Refusing to start: this is the ${deployment === "preview" ? "staging (Preview)" : "development"} site but its DATABASE_URL points at the production database (${prodEndpoint}). In Vercel, set a Preview-only DATABASE_URL for the staging database, then redeploy.`;
  }
  const liveNames = ["PAYSTACK_LIVE_SECRET_KEY", "PAYSTACK_LIVE_PUBLIC_KEY", "PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_SECRET_KEY", "PAYPAL_LIVE_WEBHOOK_ID"];
  const found = liveNames.filter((n) => clean(env[n]));
  if (found.length === 0) return null;
  return `Refusing to start: this is the ${deployment === "preview" ? "staging (Preview)" : "development"} site but live payment variables were found (${found.join(", ")}). In Vercel, untick Preview on them, then redeploy.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Print orders and email
// ---------------------------------------------------------------------------------------------------------------------

/** The live site may create real Lulu print jobs (after a confirmed, real-money payment). Staging may too, but ONLY when the admin
 * switch "Allow real Lulu orders from staging" is on (default OFF), and only after a confirmed payment. Development never. */
export function realPrintAllowed(deployment: Deployment = deploymentOf(), stagingSwitchOn = false): boolean {
  return deployment === "production" || (deployment === "preview" && stagingSwitchOn);
}

export function printBlockedMessage(deployment: Deployment): string {
  return deployment === "preview"
    ? "Not sent to Lulu: this is the staging site and the switch \"Allow real Lulu orders from staging\" is OFF. Nothing was printed or charged."
    : "Not sent to Lulu: this is a development copy, which never creates real print orders. Nothing was printed or charged.";
}

/** Reference put on every print order that leaves staging, so it can be found and cancelled in the Lulu dashboard. */
export const STAGING_LULU_REFERENCE = "STAGING TEST, CANCEL";

/** The only inbox staging ever emails. */
export const STAGING_EMAIL_ADDRESS = "otieno29@gmail.com";

export type EmailRoute = { action: "send" } | { action: "sink"; to: string };

/** The live site sends to the real recipient. Staging and development send EVERYTHING to the one test inbox, never to anyone else. */
export function emailRouteFor(deployment: Deployment): EmailRoute {
  return deployment === "production" ? { action: "send" } : { action: "sink", to: STAGING_EMAIL_ADDRESS };
}

// ---------------------------------------------------------------------------------------------------------------------
// Database name (never the password)
// ---------------------------------------------------------------------------------------------------------------------

/** The Neon endpoint name and database name from a connection string. Username, password and query are never returned. */
export function describeDatabase(url: string | undefined, label?: string): { endpoint: string; database: string; label?: string } | null {
  const raw = clean(url);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const first = host.split(".")[0] ?? host;
    const endpoint = first.replace(/-pooler$/, "");
    const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "(default)";
    return { endpoint, database, ...(clean(label) ? { label: clean(label) } : {}) };
  } catch {
    return { endpoint: "(unreadable address)", database: "" };
  }
}
