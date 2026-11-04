import { deploymentOf, type Deployment, type Env } from "@/lib/runtime-env";

/**
 * Which web address THIS copy of the site must use when it sends a customer to Paystack / PayPal and back, and in links.
 * Decided from the environment, never hardcoded for every copy:
 *   - Production (the live site): the real domain (NEXT_PUBLIC_SITE_URL if set to a sensible address, else thegoodchildbookstore.com).
 *   - Preview (staging): the staging site's OWN address (the address the customer is actually on, else Vercel's branch / deployment
 *     address). A NEXT_PUBLIC_SITE_URL that points at the production domain is IGNORED on staging.
 *   - Development: http://localhost:3000.
 * Pure (no network, no secrets) so every rule is tested.
 */

export const PRODUCTION_DOMAIN = "thegoodchildbookstore.com";

const clean = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const isProductionHost = (host: string | null): boolean => !!host && (host === PRODUCTION_DOMAIN || host === `www.${PRODUCTION_DOMAIN}`);
const isLocalOrVercelHost = (host: string | null): boolean => !!host && (host === "localhost" || host.endsWith(".vercel.app"));
const validHost = (h: string | undefined): h is string => !!h && /^[a-z0-9.-]+(:\d+)?$/i.test(h);
const strip = (u: string) => u.replace(/\/+$/, "");

export interface SiteBase {
  /** Address with no trailing slash, or "" when none could be worked out (payments must then be refused). */
  url: string;
  /** Plain words: where it came from. */
  source: string;
  /** A configured NEXT_PUBLIC_SITE_URL that was ignored because it is wrong for this environment (names only, plus the address). */
  ignoredOverride?: string;
}

export function resolveSiteBase(opts: { deployment?: Deployment; env?: Env; requestHost?: string | null } = {}): SiteBase {
  const env = opts.env ?? process.env;
  const deployment = opts.deployment ?? deploymentOf(env);
  const override = clean(env.NEXT_PUBLIC_SITE_URL);
  const overrideHost = hostOf(override);

  if (deployment === "production") {
    if (override && overrideHost && !isLocalOrVercelHost(overrideHost)) return { url: strip(override), source: "NEXT_PUBLIC_SITE_URL (Production)" };
    return { url: `https://${PRODUCTION_DOMAIN}`, source: "the live domain", ...(override ? { ignoredOverride: override } : {}) };
  }

  if (deployment === "preview") {
    let ignored: string | undefined;
    if (override && overrideHost) {
      if (isProductionHost(overrideHost)) ignored = override;
      else return { url: strip(override), source: "NEXT_PUBLIC_SITE_URL (Preview)" };
    }
    const reqHost = clean(opts.requestHost ?? undefined)?.toLowerCase();
    if (validHost(reqHost) && !isProductionHost(hostOf(reqHost))) return { url: `https://${reqHost}`, source: "the address the customer is on", ...(ignored ? { ignoredOverride: ignored } : {}) };
    const branch = clean(env.VERCEL_BRANCH_URL);
    if (branch) return { url: `https://${branch}`, source: "Vercel's branch address", ...(ignored ? { ignoredOverride: ignored } : {}) };
    const dep = clean(env.VERCEL_URL);
    if (dep) return { url: `https://${dep}`, source: "Vercel's deployment address", ...(ignored ? { ignoredOverride: ignored } : {}) };
    return { url: "", source: "none available", ...(ignored ? { ignoredOverride: ignored } : {}) };
  }

  return { url: override && overrideHost ? strip(override) : "http://localhost:3000", source: "development" };
}

/** The safety guard: refuse to send a customer to the wrong environment's address. Returns a plain-words reason, or null when fine. */
export function returnAddressProblem(deployment: Deployment, url: string): string | null {
  const host = hostOf(url);
  if (!url || !host) return "No website address could be worked out for this copy of the site, so payments are switched off.";
  if (deployment === "preview" && isProductionHost(host)) return `This is the staging site but the payment return address points at the live site (${host}). Payments are switched off so a customer is never sent to the wrong site.`;
  if (deployment === "production" && isLocalOrVercelHost(host)) return `This is the live site but the payment return address points at a test address (${host}). Payments are switched off so a customer is never sent to the wrong site.`;
  return null;
}
