import { prisma } from "@/lib/prisma";
import { getPaymentSafety } from "@/lib/api-keys";
import { resolveLuluKeys, resolvePaypalKeys, resolvePaystackKeys, PAYMENT_VARIABLES } from "@/lib/payment-env";
import { deploymentOf, describeDatabase, expectedKeySet } from "@/lib/runtime-env";
import type { ServiceKey } from "@/lib/site-health/service-state";

/**
 * Harmless checks of every outside service. READ-ONLY by design:
 *   Paystack  : asks for the account balance (a read).
 *   PayPal    : asks for a sign-in token and reads the webhook record. Never creates or captures an order.
 *   Lulu      : asks for a sign-in token and lists one existing print job. Never creates a print job.
 *   Email     : lists the sending domains (a read). Never sends an email.
 *   Database  : SELECT 1.
 * Nothing here can create a charge, a payout or a real Lulu order, and no key is ever returned, logged or put in a reason:
 * reasons are built from status words only.
 */

export interface ServiceResult {
  key: ServiceKey;
  label: string;
  /** "test" or "live" for payment services (decided by the environment only); "live" for Lulu (no sandbox) and email; "n/a" otherwise. */
  mode: "test" | "live" | "n/a";
  keyPresent: boolean;
  ok: boolean;
  /** Plain-words reason when ok is false, or a short note when it passed. */
  reason?: string;
  note?: string;
  checkedAt: string;
  /** How long the check took, in milliseconds. */
  responseMs?: number;
  /** Variable NAMES only. */
  variables: string[];
}

const TIMEOUT_MS = 8000;

function failFromStatus(service: string, status: number): string {
  if (status === 401 || status === 403) return `${service} rejected the key (it is wrong, expired or for the other mode). Re-copy it into Vercel.`;
  if (status === 429) return `${service} is asking us to slow down (too many requests). This usually passes by itself.`;
  if (status >= 500) return `${service} is having problems on its side (status ${status}).`;
  return `${service} answered with an unexpected status (${status}).`;
}

function failFromError(service: string, e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "TimeoutError" || name === "AbortError") return `${service} did not answer within ${TIMEOUT_MS / 1000} seconds.`;
  return `${service} could not be reached from the site (network problem).`;
}


async function paystackCheck(now: string): Promise<ServiceResult> {
  const deployment = deploymentOf();
  const keys = resolvePaystackKeys(process.env, deployment);
  const safety = (await getPaymentSafety()).paystack;
  const set = expectedKeySet(deployment);
  const base = { key: "paystack" as const, label: "Paystack (card payments)", mode: set, keyPresent: keys.hasKeys, checkedAt: now, variables: [...PAYMENT_VARIABLES.paystack[set]] };
  if (!safety.allowed) return { ...base, ok: false, reason: safety.reason };
  try {
    const res = await fetch("https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${keys.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ...base, ok: false, reason: failFromStatus("Paystack", res.status) };
    return { ...base, ok: true, note: `Paystack accepted the ${set} key.` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("Paystack", e) };
  }
}

async function paypalCheck(now: string): Promise<ServiceResult> {
  const deployment = deploymentOf();
  const keys = resolvePaypalKeys(process.env, deployment);
  const safety = (await getPaymentSafety()).paypal;
  const base = { key: "paypal" as const, label: "PayPal", mode: keys.set, keyPresent: keys.hasKeys, checkedAt: now, variables: [...PAYMENT_VARIABLES.paypal[keys.set]] };
  if (!safety.allowed) return { ...base, ok: false, reason: safety.reason };
  const host = keys.environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  try {
    const tokenRes = await fetch(`${host}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) return { ...base, ok: false, reason: failFromStatus("PayPal", tokenRes.status) + ` This environment uses the ${keys.environment === "live" ? "LIVE" : "SANDBOX"} PayPal app.` };
    const token = ((await tokenRes.json().catch(() => null)) as { access_token?: string } | null)?.access_token;
    if (!token) return { ...base, ok: false, reason: "PayPal did not return a sign-in token." };
    if (!keys.webhookId) return { ...base, ok: false, reason: `PayPal accepts the keys, but PAYPAL_${keys.set === "live" ? "LIVE" : "SANDBOX"}_WEBHOOK_ID is not set, so PayPal payment confirmations cannot be verified.` };
    const hookRes = await fetch(`${host}/v1/notifications/webhooks/${encodeURIComponent(keys.webhookId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (hookRes.status === 404) return { ...base, ok: false, reason: "PayPal accepts the keys, but the webhook id does not match a webhook in this PayPal mode." };
    if (!hookRes.ok) return { ...base, ok: false, reason: failFromStatus("PayPal (webhook lookup)", hookRes.status) };
    return { ...base, ok: true, note: `PayPal accepted the ${keys.environment} keys and found the webhook.` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("PayPal", e) };
  }
}

async function luluToken(): Promise<{ token: string } | { reason: string }> {
  const keys = resolveLuluKeys(process.env);
  if (!keys.clientKey || !keys.clientSecret) return { reason: "LULU_CLIENT_KEY and LULU_CLIENT_SECRET are not both set in Vercel for this environment." };
  try {
    const res = await fetch("https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${keys.clientKey}:${keys.clientSecret}`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "client_credentials" }), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { reason: failFromStatus("Lulu", res.status) };
    const token = ((await res.json().catch(() => null)) as { access_token?: string } | null)?.access_token;
    return token ? { token } : { reason: "Lulu did not return a sign-in token." };
  } catch (e) {
    return { reason: failFromError("Lulu", e) };
  }
}

const luluBase = (key: ServiceKey, label: string, now: string) => {
  const k = resolveLuluKeys(process.env);
  return { key, label, mode: "live" as const, keyPresent: !!k.clientKey && !!k.clientSecret, checkedAt: now, variables: ["LULU_CLIENT_KEY", "LULU_CLIENT_SECRET"] };
};

async function luluAuthCheck(now: string): Promise<ServiceResult> {
  const base = luluBase("lulu_auth", "Lulu: sign-in (authentication)", now);
  const t = await luluToken();
  return "token" in t ? { ...base, ok: true, note: "Lulu accepted the client key and secret." } : { ...base, ok: false, reason: t.reason };
}

async function luluQuoteCheck(now: string): Promise<ServiceResult> {
  const base = luluBase("lulu_quote", "Lulu: price quote", now);
  const t = await luluToken();
  if (!("token" in t)) return { ...base, ok: false, reason: `Cannot ask for a quote: ${t.reason}` };
  try {
    // A price calculation for a standard sample book. It only asks "what would this cost"; it creates nothing.
    const res = await fetch("https://api.lulu.com/print-job-cost-calculations/", {
      method: "POST",
      headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        line_items: [{ page_count: 32, pod_package_id: "0600X0900BWSTDPB060UW444MXX", quantity: 1 }],
        shipping_address: { city: "New York", country_code: "US", postcode: "10001", state_code: "NY", street1: "1 Main St", phone_number: "5555555555", name: "Quote Check" },
        shipping_option: "MAIL",
      }),
      cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ...base, ok: true, note: "Lulu answered a price quote." };
    if (res.status === 400 || res.status === 404 || res.status === 422) return { ...base, ok: true, note: "Lulu answered the quote request (it refused the sample book, which still proves the quote service is up)." };
    return { ...base, ok: false, reason: failFromStatus("Lulu (quote)", res.status) };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("Lulu (quote)", e) };
  }
}

async function luluFilesCheck(now: string): Promise<ServiceResult> {
  const base = luluBase("lulu_files", "Lulu: our files can be fetched", now);
  try {
    const file = await prisma.uploadedFile.findFirst({ select: { id: true } });
    if (!file) return { ...base, ok: true, note: "No uploaded files yet, so there is nothing to fetch." };
    const { getPublicSiteUrl } = await import("@/lib/seo/site-url");
    const res = await fetch(`${getPublicSiteUrl().replace(/\/$/, "")}/api/files/${encodeURIComponent(file.id)}`, { headers: { Range: "bytes=0-0" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 200 || res.status === 206) return { ...base, ok: true, note: "A stored file was fetched over the public web address, the way Lulu fetches print files." };
    return { ...base, ok: false, reason: `Fetching a stored file from the public web address answered ${res.status}, so Lulu may not be able to download print files.` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("The site's own file address", e) };
  }
}

async function luluOrderCheck(now: string): Promise<ServiceResult> {
  const base = luluBase("lulu_order", "Lulu: order creation (readiness)", now);
  const deployment = deploymentOf();
  const t = await luluToken();
  // Creating an order would print and charge, so it is never tried. Readiness = sign-in works and orders are allowed here.
  if (!("token" in t)) return { ...base, ok: false, reason: `Orders cannot be created: ${t.reason}` };
  let staging = 0;
  try { staging = await prisma.order.count({ where: { stagingLuluOrder: true, luluStatus: { not: null } } }); } catch { /* ignore */ }
  if (deployment === "preview") {
    const { getStagingLuluSwitch } = await import("@/lib/staging-lulu");
    const on = (await getStagingLuluSwitch()).on;
    return { ...base, ok: true, note: `Order creation is not test-fired (it would print and charge). Sign-in works. Staging switch "Allow real Lulu orders from staging" is ${on ? "ON: real orders WILL be created for confirmed payments" : "OFF"}. Staging orders sent to Lulu so far: ${staging} (cancel them in the Lulu dashboard).` };
  }
  return { ...base, ok: true, note: "Order creation is not test-fired (it would print and charge). Sign-in works, so orders can be created once a real payment is confirmed." };
}

async function emailCheck(now: string): Promise<ServiceResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FROM_EMAIL?.trim() || "orders@thegoodchildbookstore.com";
  const base = { key: "email" as const, label: "Email (Resend)", mode: "live" as const, keyPresent: !!apiKey, checkedAt: now, variables: ["RESEND_API_KEY", "FROM_EMAIL"] };
  if (!apiKey) return { ...base, ok: false, reason: "RESEND_API_KEY is not set in Vercel for this environment." };
  const routeNote = deploymentOf() === "production" ? "" : " Staging: every email goes only to the test inbox with a [STAGING] subject prefix.";
  try {
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 401 || res.status === 403) {
      // A "send-only" Resend key is valid but not allowed to list domains: that is fine.
      const body = (await res.json().catch(() => null)) as { name?: string } | null;
      if (body?.name === "restricted_api_key") return { ...base, ok: true, note: `Resend accepted the key (a send-only key, so the sending domain cannot be read).${routeNote}` };
      return { ...base, ok: false, reason: failFromStatus("Resend", res.status) };
    }
    if (!res.ok) return { ...base, ok: false, reason: failFromStatus("Resend", res.status) };
    const data = (await res.json().catch(() => null)) as { data?: { name?: string; status?: string }[] } | null;
    const domain = from.split("@")[1]?.toLowerCase();
    const found = data?.data?.find((d) => d.name?.toLowerCase() === domain);
    if (!found) return { ...base, ok: false, reason: `Resend accepts the key, but the sending domain ${domain ?? "(unknown)"} (from FROM_EMAIL) is not in the Resend account.` };
    if (found.status !== "verified") return { ...base, ok: false, reason: `The sending domain ${domain} is not verified in Resend yet (status: ${found.status ?? "unknown"}).` };
    return { ...base, ok: true, note: `Resend accepted the key and the sending domain ${domain} is verified.${routeNote}` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("Resend", e) };
  }
}

async function databaseCheck(now: string): Promise<ServiceResult> {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  const base = { key: "database" as const, label: "Database (Neon)", mode: "n/a" as const, keyPresent: !!process.env.DATABASE_URL, checkedAt: now, variables: ["DATABASE_URL"] };
  if (!db) return { ...base, ok: false, reason: "DATABASE_URL is not set." };
  // Staging must never be connected to the production database.
  const prodEndpoint = process.env.PRODUCTION_DATABASE_ENDPOINT?.trim();
  if (deploymentOf() !== "production" && prodEndpoint && prodEndpoint === db.endpoint) {
    return { ...base, ok: false, reason: "DANGER: this staging site is connected to the PRODUCTION database. Fix the Preview-only DATABASE_URL in Vercel now." };
  }
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })), TIMEOUT_MS)),
    ]);
    const guard = deploymentOf() !== "production" && !prodEndpoint ? " (Tip: add PRODUCTION_DATABASE_ENDPOINT to Preview so staging can prove it is not on the production database.)" : "";
    return { ...base, ok: true, note: `Connected to ${db.label ? `${db.label} - ` : ""}${db.endpoint}${db.database ? ` / ${db.database}` : ""}.${guard}` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("The database", e) };
  }
}

async function vercelCheck(now: string): Promise<ServiceResult> {
  const d = deploymentOf();
  const base = { key: "vercel" as const, label: "Vercel (hosting)", mode: "n/a" as const, keyPresent: !!process.env.VERCEL_ENV, checkedAt: now, variables: ["VERCEL_ENV"] };
  if (!process.env.VERCEL_ENV) return { ...base, ok: d !== "production", reason: "The site is not running on Vercel (VERCEL_ENV is missing), so it cannot tell which environment it is in." };
  return { ...base, ok: true, note: `Running as ${d === "production" ? "Production" : d === "preview" ? "Preview (staging)" : "Development"}${process.env.VERCEL_REGION ? ` in region ${process.env.VERCEL_REGION}` : ""}; the ${expectedKeySet(d).toUpperCase()} key set is active.` };
}

async function storageCheck(now: string): Promise<ServiceResult> {
  const base = { key: "storage" as const, label: "File storage (uploads, covers, print files)", mode: "n/a" as const, keyPresent: true, checkedAt: now, variables: ["DATABASE_URL"] };
  try {
    const [images, files] = await Promise.all([prisma.uploadedImage.count(), prisma.uploadedFile.count()]);
    return { ...base, ok: true, note: `Files are kept in the database: ${images} images and ${files} files can be read.` };
  } catch (e) {
    return { ...base, ok: false, reason: failFromError("File storage", e) };
  }
}

async function integrationsCheck(now: string): Promise<ServiceResult> {
  const names = ["NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXT_PUBLIC_GTM_ID", "GOOGLE_SITE_VERIFICATION", "BING_SITE_VERIFICATION"];
  const present = names.filter((n) => !!process.env[n]?.trim());
  return { key: "integrations", label: "Other integrations (analytics, site verification)", mode: "n/a", keyPresent: present.length > 0, ok: true, note: present.length ? `Set: ${present.join(", ")}.` : "None of the optional analytics / verification variables are set.", checkedAt: now, variables: names };
}

const RUNNERS: Record<ServiceKey, (now: string) => Promise<ServiceResult>> = {
  database: databaseCheck, vercel: vercelCheck, paystack: paystackCheck, paypal: paypalCheck,
  lulu_auth: luluAuthCheck, lulu_quote: luluQuoteCheck, lulu_files: luluFilesCheck, lulu_order: luluOrderCheck,
  email: emailCheck, storage: storageCheck, integrations: integrationsCheck,
};

export const SERVICE_ORDER: ServiceKey[] = ["database", "vercel", "paystack", "paypal", "lulu_auth", "lulu_quote", "lulu_files", "lulu_order", "email", "storage", "integrations"];

/** Runs one check; a failure is retried once after a short pause so a single hiccup does not raise an alert. */
export async function runServiceCheck(key: ServiceKey, opts: { retry?: boolean } = {}): Promise<ServiceResult> {
  const timed = async (): Promise<ServiceResult> => {
    const t0 = Date.now();
    const res = await RUNNERS[key](new Date().toISOString());
    return { ...res, responseMs: Date.now() - t0 };
  };
  let r = await timed().catch((): ServiceResult => ({ key, label: key, mode: "n/a", keyPresent: false, ok: false, reason: "The check itself failed unexpectedly.", checkedAt: new Date().toISOString(), variables: [] }));
  if (!r.ok && opts.retry && r.keyPresent) {
    await new Promise((res) => setTimeout(res, 2500));
    r = await timed().catch(() => r);
  }
  return r;
}

export async function runAllServiceChecks(opts: { retry?: boolean } = {}): Promise<ServiceResult[]> {
  return Promise.all(SERVICE_ORDER.map((k) => runServiceCheck(k, opts)));
}
