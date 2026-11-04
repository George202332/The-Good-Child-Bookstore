import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  deploymentOf, evaluatePaymentSafety, startupRefusal, realPrintAllowed, emailRouteFor, describeDatabase,
  paystackKeyKind, expectedKeySet, STAGING_EMAIL_ADDRESS, STAGING_LULU_REFERENCE, CUSTOMER_PAYMENT_MESSAGE,
} from "../lib/runtime-env";
import { resolvePaystackKeys, resolvePaypalKeys, resolveLuluKeys, findOldVariableNames } from "../lib/payment-env";
import { printSubmissionDecision } from "../lib/print-submission-guard";
import { decideAlert, buildAlertEmail, REMINDER_HOURS, type ServiceState } from "../lib/site-health/service-state";
import { checkRefund, checkPayoutAdjustment, netPayoutAmount } from "../lib/records";

test("deployment comes from VERCEL_ENV, else NODE_ENV", () => {
  assert.equal(deploymentOf({ VERCEL_ENV: "production" }), "production");
  assert.equal(deploymentOf({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(deploymentOf({ VERCEL_ENV: "development" }), "development");
  assert.equal(deploymentOf({ NODE_ENV: "production" }), "production");
  assert.equal(deploymentOf({ NODE_ENV: "test" }), "development");
  assert.equal(deploymentOf({}), "development");
});

test("the key set is decided only by the environment", () => {
  assert.equal(expectedKeySet("production"), "live");
  assert.equal(expectedKeySet("preview"), "test");
  assert.equal(expectedKeySet("development"), "test");
});

test("payment safeguard: wrong set, wrong kind, missing keys", () => {
  const ev = (deployment: "production" | "preview" | "development", o: { hasKeys?: boolean; wrongSetNames?: string[]; kindMismatch?: boolean } = {}) =>
    evaluatePaymentSafety({ deployment, provider: "paystack", hasKeys: o.hasKeys ?? true, wrongSetNames: o.wrongSetNames ?? [], kindMismatch: o.kindMismatch ?? false });
  assert.equal(ev("preview").allowed, true);
  assert.equal(ev("production").allowed, true);
  const wrongOnProd = ev("production", { wrongSetNames: ["PAYSTACK_TEST_SECRET_KEY"] });
  assert.equal(wrongOnProd.allowed, false);
  assert.equal(wrongOnProd.safeguard, true);
  assert.equal(wrongOnProd.customerMessage, CUSTOMER_PAYMENT_MESSAGE);
  assert.match(wrongOnProd.reason ?? "", /PAYSTACK_TEST_SECRET_KEY/);
  const liveOnStaging = ev("preview", { wrongSetNames: ["PAYSTACK_LIVE_SECRET_KEY"] });
  assert.equal(liveOnStaging.allowed, false);
  assert.equal(liveOnStaging.safeguard, true);
  assert.equal(ev("preview", { kindMismatch: true }).safeguard, true);
  const none = ev("production", { hasKeys: false });
  assert.equal(none.allowed, false);
  assert.equal(none.safeguard, false, "a missing key is 'not set up', not a safeguard");
  assert.match(CUSTOMER_PAYMENT_MESSAGE, /Nothing has been charged/);
});

test("the safeguard reasons never contain a key", () => {
  const r = evaluatePaymentSafety({ deployment: "preview", provider: "paypal", hasKeys: true, wrongSetNames: ["PAYPAL_LIVE_SECRET_KEY"], kindMismatch: false });
  assert.doesNotMatch(r.reason ?? "", /sk_|pk_/);
});

test("startup refusal: staging with any live variable refuses, with test variables it starts, the live site is never stopped", () => {
  assert.match(startupRefusal({ VERCEL_ENV: "preview", PAYSTACK_LIVE_SECRET_KEY: "sk_live_abc" }) ?? "", /PAYSTACK_LIVE_SECRET_KEY/);
  assert.match(startupRefusal({ VERCEL_ENV: "preview", PAYPAL_LIVE_WEBHOOK_ID: "w" }) ?? "", /PAYPAL_LIVE_WEBHOOK_ID/);
  assert.equal(startupRefusal({ VERCEL_ENV: "preview", PAYSTACK_TEST_SECRET_KEY: "sk_test_abc", PAYPAL_SANDBOX_CLIENT_ID: "id" }), null);
  assert.equal(startupRefusal({ VERCEL_ENV: "production", PAYSTACK_LIVE_SECRET_KEY: "sk_live_abc", PAYSTACK_TEST_SECRET_KEY: "sk_test_abc" }), null);
  assert.doesNotMatch(startupRefusal({ VERCEL_ENV: "preview", PAYSTACK_LIVE_SECRET_KEY: "sk_live_VALUE123" }) ?? "", /VALUE123/);
});

test("staging never starts on the production database (when its endpoint name is given)", () => {
  const url = "postgresql://u:p@ep-prod-111-pooler.eu-central-1.aws.neon.tech/neondb";
  assert.match(startupRefusal({ VERCEL_ENV: "preview", DATABASE_URL: url, PRODUCTION_DATABASE_ENDPOINT: "ep-prod-111" }) ?? "", /production database/);
  assert.equal(startupRefusal({ VERCEL_ENV: "preview", DATABASE_URL: url, PRODUCTION_DATABASE_ENDPOINT: "ep-other-222" }), null);
  assert.equal(startupRefusal({ VERCEL_ENV: "production", DATABASE_URL: url, PRODUCTION_DATABASE_ENDPOINT: "ep-prod-111" }), null);
  assert.doesNotMatch(startupRefusal({ VERCEL_ENV: "preview", DATABASE_URL: url, PRODUCTION_DATABASE_ENDPOINT: "ep-prod-111" }) ?? "", /u:p/);
});

test("real Lulu print orders: live site always, staging only with the switch, development never", () => {
  assert.equal(realPrintAllowed("production"), true);
  assert.equal(realPrintAllowed("preview"), false);
  assert.equal(realPrintAllowed("preview", true), true);
  assert.equal(realPrintAllowed("development", true), false);
  assert.equal(STAGING_LULU_REFERENCE, "STAGING TEST, CANCEL");
});

test("staging print jobs still need a confirmed payment, and test-money orders are held without the switch", () => {
  const o = { luluEnvironment: "production" as const, paymentMode: "test" as const, currentPaystackMode: "test" as const, currentPaypalMode: "test" as const, isTestData: false };
  assert.equal(printSubmissionDecision({ ...o, gateway: null, stagingOverride: true }).allow, false);
  assert.equal(printSubmissionDecision({ ...o, gateway: "PAYSTACK", stagingOverride: true }).allow, true);
  assert.equal(printSubmissionDecision({ ...o, gateway: "PAYSTACK" }).allow, false);
});

test("emails: the live site sends, staging and development go only to the one test inbox", () => {
  assert.deepEqual(emailRouteFor("production"), { action: "send" });
  assert.deepEqual(emailRouteFor("preview"), { action: "sink", to: "otieno29@gmail.com" });
  assert.deepEqual(emailRouteFor("development"), { action: "sink", to: STAGING_EMAIL_ADDRESS });
});

test("database line shows the endpoint name only, never the password", () => {
  const d = describeDatabase("postgresql://neondb_owner:S3cretPass@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require", "staging");
  assert.deepEqual(d, { endpoint: "ep-cool-name-123456", database: "neondb", label: "staging" });
  assert.doesNotMatch(JSON.stringify(d), /S3cretPass|neondb_owner/);
  assert.equal(describeDatabase(undefined), null);
});

test("each environment reads only its own key set", () => {
  const all = {
    PAYSTACK_TEST_PUBLIC_KEY: "pk_test_a", PAYSTACK_TEST_SECRET_KEY: "sk_test_a", PAYSTACK_LIVE_PUBLIC_KEY: "pk_live_a", PAYSTACK_LIVE_SECRET_KEY: "sk_live_a",
    PAYPAL_SANDBOX_CLIENT_ID: "si", PAYPAL_SANDBOX_SECRET_KEY: "ss", PAYPAL_SANDBOX_WEBHOOK_ID: "sw",
    PAYPAL_LIVE_CLIENT_ID: "li", PAYPAL_LIVE_SECRET_KEY: "ls", PAYPAL_LIVE_WEBHOOK_ID: "lw",
  };
  const pre = resolvePaystackKeys(all, "preview");
  assert.equal(pre.secretKey, "sk_test_a");
  assert.deepEqual(pre.wrongSetNames.sort(), ["PAYSTACK_LIVE_PUBLIC_KEY", "PAYSTACK_LIVE_SECRET_KEY"]);
  const prod = resolvePaystackKeys(all, "production");
  assert.equal(prod.secretKey, "sk_live_a");
  assert.equal(prod.wrongSetNames.length, 2);
  const clean = { PAYSTACK_TEST_PUBLIC_KEY: "pk_test_a", PAYSTACK_TEST_SECRET_KEY: "sk_test_a" };
  assert.equal(resolvePaystackKeys(clean, "preview").hasKeys, true);
  assert.equal(resolvePaystackKeys(clean, "preview").wrongSetNames.length, 0);
  assert.equal(resolvePaystackKeys(clean, "production").hasKeys, false, "test variables are never used on the live site");
  assert.equal(resolvePaystackKeys({ PAYSTACK_TEST_PUBLIC_KEY: "pk_live_a", PAYSTACK_TEST_SECRET_KEY: "sk_live_a" }, "preview").kindMismatch, true);
  const pp = resolvePaypalKeys(all, "preview");
  assert.equal(pp.environment, "sandbox");
  assert.equal(pp.clientId, "si");
  assert.equal(pp.webhookId, "sw");
  assert.equal(resolvePaypalKeys(all, "production").webhookId, "lw");
  assert.equal(resolvePaypalKeys(all, "production").environment, "live");
  assert.equal(resolvePaypalKeys({ PAYPAL_SANDBOX_CLIENT_ID: "x" }, "production").hasKeys, false);
  assert.deepEqual(resolveLuluKeys({ LULU_CLIENT_KEY: "k", LULU_CLIENT_SECRET: "x" }), { clientKey: "k", clientSecret: "x" });
  assert.equal(paystackKeyKind("rubbish"), "unknown");
});

test("older variable names are no longer read, and are reported by name", () => {
  const old = { PAYSTACK_SECRET_KEY: "sk_test_a", PAYSTACK_PUBLIC_KEY: "pk_test_a", PAYPAL_WEBHOOK_ID: "w", PAYPAL_CLIENT_ID: "i", LULU_API_KEY: "k", LULU_ENV: "sandbox" };
  for (const d of ["preview", "production"] as const) {
    assert.equal(resolvePaystackKeys(old, d).secretKey, undefined);
    assert.equal(resolvePaypalKeys(old, d).clientId, undefined);
    assert.equal(resolvePaypalKeys(old, d).webhookId, undefined);
  }
  assert.equal(resolveLuluKeys(old).clientKey, undefined);
  assert.deepEqual(findOldVariableNames(old).sort(), ["LULU_API_KEY", "LULU_ENV", "PAYPAL_CLIENT_ID", "PAYPAL_WEBHOOK_ID", "PAYSTACK_PUBLIC_KEY", "PAYSTACK_SECRET_KEY"]);
});

test("alerts: one email at first failure, none while it stays down, a reminder after hours, one on recovery", () => {
  const t = (h: number) => new Date(Date.UTC(2026, 10, 5, 0, 0, 0) + h * 3_600_000).toISOString();
  let st: ServiceState | undefined;
  const step = (ok: boolean, h: number) => { const r = decideAlert(st, { ok, reason: ok ? undefined : "Paystack rejected the key" }, t(h)); st = r.next; return r.action; };
  assert.equal(step(true, 0), "none");
  assert.equal(step(true, 0.1), "none");
  assert.equal(step(false, 0.2), "down");
  for (let i = 1; i <= 20; i++) assert.equal(step(false, 0.2 + i * (5 / 60)), "none", "no email per check");
  assert.equal(step(false, 0.2 + REMINDER_HOURS), "reminder");
  assert.equal(step(false, 0.2 + REMINDER_HOURS + 1), "none");
  assert.equal(step(true, 0.2 + REMINDER_HOURS + 2), "recovered");
  assert.equal(step(true, 0.2 + REMINDER_HOURS + 2.1), "none");
  assert.equal(step(false, 20), "down", "a new outage alerts again");
});

test("a blip that never alerted does not send a recovery email", () => {
  const prev: ServiceState = { ok: false, since: "2026-11-05T00:00:00.000Z", lastCheckedAt: "2026-11-05T00:05:00.000Z", alertedDown: false };
  assert.equal(decideAlert(prev, { ok: true }, "2026-11-05T00:10:00.000Z").action, "none");
});

test("alert email says what failed and when, with no secrets", () => {
  const m = buildAlertEmail({ action: "down", label: "Paystack (card payments)", reason: "Paystack rejected the key (it is wrong, expired or for the other mode). Re-copy it into Vercel.", since: "2026-11-05T10:15:00.000Z", nowIso: "2026-11-05T10:15:00.000Z" });
  assert.match(m.subject, /Paystack/);
  assert.match(m.html, /2026-11-05 10:15 UTC/);
  assert.doesNotMatch(m.html, /sk_(live|test)_/);
  const r = buildAlertEmail({ action: "recovered", label: "Lulu", since: "2026-11-05T10:00:00.000Z", nowIso: "2026-11-05T12:00:00.000Z" });
  assert.match(r.subject, /RECOVERED/);
  assert.match(r.html, /2 hours/);
});

test("refunds: reason required, cannot exceed what was paid", () => {
  assert.equal(checkRefund({ orderTotal: 20, alreadyRefunded: 0, amount: 20, reason: "damaged" }).ok, true);
  assert.equal(checkRefund({ orderTotal: 20, alreadyRefunded: 5, amount: 15, reason: "x" }).ok, true);
  assert.equal(checkRefund({ orderTotal: 20, alreadyRefunded: 5, amount: 15.01, reason: "x" }).ok, false);
  assert.equal(checkRefund({ orderTotal: 20, alreadyRefunded: 0, amount: 0, reason: "x" }).ok, false);
  assert.equal(checkRefund({ orderTotal: 20, alreadyRefunded: 0, amount: 5, reason: "  " }).ok, false);
});

test("payout reversing entries: bounded by what the payout stands for", () => {
  assert.equal(checkPayoutAdjustment({ payoutAmount: 50, existing: [], kind: "REVERSAL", amount: 50, reason: "paid twice" }).ok, true);
  assert.equal(checkPayoutAdjustment({ payoutAmount: 50, existing: [{ kind: "REVERSAL", amount: 30 }], kind: "REVERSAL", amount: 25, reason: "x" }).ok, false);
  assert.equal(checkPayoutAdjustment({ payoutAmount: 50, existing: [], kind: "CORRECTION", amount: 10, reason: "short-paid" }).ok, true);
  assert.equal(checkPayoutAdjustment({ payoutAmount: 50, existing: [], kind: "REVERSAL", amount: 5, reason: "" }).ok, false);
  assert.equal(netPayoutAmount(50, [{ kind: "REVERSAL", amount: 20 }, { kind: "CORRECTION", amount: 5 }]), 35);
});

// ---- source scans: the promises that must stay true ----------------------------------------------------------------
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "tests", "scripts", "prisma", ".git", "REPO-ROOT-FILES"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const root = join(__dirname, "..");

test("no code reads or stores a key from the database or the admin any more", () => {
  const banned = ["paystackSecretKey", "paystackPublicKey", "paypalClientSecret", "paypalClientId", "luluClientSecret", "luluClientKey", "resendApiKey", "process.env.PAYSTACK_SECRET_KEY", "process.env.PAYPAL_WEBHOOK_ID", "process.env.LULU_API_KEY", "process.env.LULU_ENV", "process.env.PAYPAL_MODE"];
  const hits: string[] = [];
  for (const f of sourceFiles(root)) {
    const text = readFileSync(f, "utf8");
    for (const b of banned) if (text.includes(b)) hits.push(`${f.replace(root, "")}: ${b}`);
  }
  assert.deepEqual(hits, []);
});

test("the admin delete and clear-data tools are gone", () => {
  const t = readFileSync(join(root, "actions/transactions.ts"), "utf8");
  assert.doesNotMatch(t, /deleteMany|\.delete\(|export async function (deleteTransaction|resetAllOrders)/);
  for (const f of sourceFiles(join(root, "actions")).concat(sourceFiles(join(root, "app")))) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /\b(order|saleLine|paymentLog|payoutRequest|refund|payoutAdjustment|recordChangeLog)\.(delete|deleteMany)\(/, `${f} deletes a money record`);
  }
});

test("a real Lulu print job needs realPrintAllowed (live site, or staging with the switch), and the webhook is registered only by the live site", () => {
  const s = readFileSync(join(root, "lib/payments/lulu.ts"), "utf8");
  const submit = s.slice(s.indexOf("export async function submitLuluPrintJob"), s.indexOf("export async function fetchLuluPrintJob"));
  assert.match(submit, /realPrintAllowed\(/);
  assert.match(submit, /getStagingLuluSwitch/);
  const hook = s.slice(s.indexOf("export async function registerLuluWebhookUrl"), s.indexOf("async function readInteriorPdf"));
  assert.match(hook, /production/);
});

test("staging Lulu orders carry the reference and are left out of Accounting", () => {
  const l = readFileSync(join(root, "lib/payments/lulu.ts"), "utf8");
  assert.match(l, /STAGING_LULU_REFERENCE/);
  assert.match(l, /stagingLuluOrder: true/);
  const a = readFileSync(join(root, "lib/accounting/data.ts"), "utf8");
  assert.ok((a.match(/stagingLuluOrder: false/g) ?? []).length >= 3, "accounting must exclude staging Lulu orders in every query");
});

test("API Management is gone: no route, no menu entry, no key stored", () => {
  assert.throws(() => readFileSync(join(root, "app/admin/api-management/page.tsx"), "utf8"));
  assert.doesNotMatch(readFileSync(join(root, "components/AdminShell.tsx"), "utf8"), /api-management/);
  assert.match(readFileSync(join(root, "components/AdminShell.tsx"), "utf8"), /site-health/);
  assert.match(readFileSync(join(root, "components/InvestorShell.tsx"), "utf8"), /site-health/);
});

test("the staging banner is mounted on every page and the production check is by environment only", () => {
  assert.match(readFileSync(join(root, "app/layout.tsx"), "utf8"), /StagingBanner/);
  assert.match(readFileSync(join(root, "components/StagingBanner.tsx"), "utf8"), /deploymentOf|VERCEL_ENV/);
});

test("sessions read only AUTH_SECRET", () => {
  for (const f of sourceFiles(root).concat([join(root, "proxy.ts")])) {
    try { assert.doesNotMatch(readFileSync(f, "utf8"), /NEXTAUTH_SECRET/, f); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
});

test("the service checks only read", () => {
  const s = readFileSync(join(root, "lib/service-checks.ts"), "utf8");
  assert.doesNotMatch(s, /transaction\/initialize|charge_authorization|v2\/checkout\/orders|\/capture|\/payouts|emails\.send|resend\.emails|method: "DELETE"|method: "PUT"/);
  assert.doesNotMatch(s, /\/print-jobs\/["`]/);
});

// ---- database behind the code (Round 67) ----------------------------------------------------------------------------
import { compareMigrations, migrationWarning } from "../lib/migration-status";

test("a database that lacks a migration the code needs is reported as behind", () => {
  const ok = { finished: true, rolledBack: false };
  const r = compareMigrations(["a", "b", "c"], [{ name: "a", ...ok }, { name: "b", ...ok }]);
  assert.deepEqual(r.missing, ["c"]);
  assert.equal(r.behind, true);
  assert.equal(compareMigrations(["a"], [{ name: "a", ...ok }, { name: "zzz-extra", ...ok }]).behind, false, "extra applied migrations are fine");
  assert.equal(compareMigrations(["a"], [{ name: "a", finished: false, rolledBack: false }]).behind, true, "a half-finished migration counts");
  assert.equal(compareMigrations(["a"], [{ name: "a", finished: true, rolledBack: true }]).behind, true);
  const w = migrationWarning({ checked: true, behind: true, missing: ["x_col"], failed: [], expectedCount: 2, appliedCount: 1 });
  assert.match(w ?? "", /BEHIND/);
  assert.match(w ?? "", /x_col/);
  assert.equal(migrationWarning({ checked: true, behind: false, missing: [], failed: [], expectedCount: 1, appliedCount: 1 }), null);
});

test("the list of expected migrations matches the migration folders (regenerated before every build)", () => {
  const dir = join(root, "prisma", "migrations");
  const folders = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort();
  const listed = JSON.parse(readFileSync(join(root, "lib/expected-migrations.json"), "utf8"));
  assert.deepEqual(listed, folders);
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"prebuild": "node scripts\/write-migration-list.mjs"/);
});

test("checkout error logs hide any address", () => {
  const src = readFileSync(join(root, "actions/orders.ts"), "utf8");
  assert.match(src, /\[address hidden\]/);
});

// ---- payment return address follows the environment (Round 68) -----------------------------------------------------------
import { resolveSiteBase, returnAddressProblem } from "../lib/site-address";

test("staging never uses the live address; the live site never uses a test address", () => {
  const stg = resolveSiteBase({ deployment: "preview", env: {}, requestHost: "the-good-child-bookstore-git-staging-x.vercel.app" });
  assert.equal(stg.url, "https://the-good-child-bookstore-git-staging-x.vercel.app");
  assert.equal(returnAddressProblem("preview", stg.url), null);
  // a live-address override on staging is ignored
  const ign = resolveSiteBase({ deployment: "preview", env: { NEXT_PUBLIC_SITE_URL: "https://thegoodchildbookstore.com", VERCEL_BRANCH_URL: "gcb-git-staging.vercel.app" }, requestHost: null });
  assert.equal(ign.url, "https://gcb-git-staging.vercel.app");
  assert.equal(ign.ignoredOverride, "https://thegoodchildbookstore.com");
  // a request that claims the live host is not trusted on staging
  assert.equal(resolveSiteBase({ deployment: "preview", env: { VERCEL_URL: "gcb-abc.vercel.app" }, requestHost: "thegoodchildbookstore.com" }).url, "https://gcb-abc.vercel.app");
  assert.equal(resolveSiteBase({ deployment: "preview", env: {}, requestHost: null }).url, "");
  assert.match(returnAddressProblem("preview", "https://thegoodchildbookstore.com") ?? "", /staging site/);
  assert.match(returnAddressProblem("preview", "https://www.thegoodchildbookstore.com/") ?? "", /staging site/);
  assert.match(returnAddressProblem("preview", "") ?? "", /switched off/);
  assert.equal(resolveSiteBase({ deployment: "production", env: {}, requestHost: "evil.example" }).url, "https://thegoodchildbookstore.com");
  assert.equal(resolveSiteBase({ deployment: "production", env: { NEXT_PUBLIC_SITE_URL: "https://x.vercel.app" } }).url, "https://thegoodchildbookstore.com");
  assert.match(returnAddressProblem("production", "https://x.vercel.app") ?? "", /live site/);
  assert.equal(returnAddressProblem("production", "https://thegoodchildbookstore.com"), null);
  assert.equal(resolveSiteBase({ deployment: "development", env: {} }).url, "http://localhost:3000");
});

test("payments use the guarded return address, and the confirmation page re-checks by itself", () => {
  const p = readFileSync(join(root, "actions/payment-init.ts"), "utf8");
  assert.match(p, /returnAddressProblem/);
  assert.doesNotMatch(p, /getPublicSiteUrl/);
  assert.match(readFileSync(join(root, "app/checkout/confirmation/page.tsx"), "utf8"), /AutoRefresh/);
  assert.doesNotMatch(readFileSync(join(root, "lib/seo/site-url.ts"), "utf8"), /return "https:\/\/thegoodchildbookstore\.com";\n}/);
});

// ---- checkout shipping step never stalls silently (Round 70) ---------------------------------------------------------------
import { classifyDuration, deliveryBlockers, fieldForAddressDetail, quotePhase, summarizeQuoteDays, SLOW_QUOTE_MS, QUOTE_BUDGET_MS } from "../lib/quote-log";
import { printDetailsProblems, worstLevel } from "../lib/print-details-check";

test("slow and failed quotes are told apart", () => {
  assert.equal(classifyDuration(true, 1200), "ok");
  assert.equal(classifyDuration(true, SLOW_QUOTE_MS), "slow");
  assert.equal(classifyDuration(false, 100), "failed");
  assert.ok(QUOTE_BUDGET_MS < 30000, "the customer never waits half a minute for one try");
});

test("quote counts per day and per failure kind", () => {
  const now = "2026-11-05T12:00:00.000Z";
  const days = { "2026-11-05": { ok: 5, slow: 1, failed: 2 }, "2026-11-01": { ok: 3, slow: 0, failed: 0 }, "2026-10-01": { ok: 99, slow: 9, failed: 9 } };
  const ev = [
    { at: "2026-11-05T10:00:00.000Z", outcome: "failed" as const, kind: "address", ms: 900, country: "KE" },
    { at: "2026-11-05T09:00:00.000Z", outcome: "failed" as const, kind: "address", ms: 800, country: "KE" },
    { at: "2026-09-01T09:00:00.000Z", outcome: "failed" as const, kind: "auth", ms: 800, country: "KE" },
  ];
  const s = summarizeQuoteDays(days, ev, now);
  assert.deepEqual(s.today, { ok: 5, slow: 1, failed: 2 });
  assert.deepEqual(s.last7d, { ok: 8, slow: 1, failed: 2 });
  assert.deepEqual(s.byKind, { address: 2 });
});

test("a Lulu address complaint is shown beside the right field", () => {
  assert.equal(fieldForAddressDetail("Invalid postal code for this country"), "postcode");
  assert.equal(fieldForAddressDetail("phone_number is required"), "phone");
  assert.equal(fieldForAddressDetail("state_code not recognised"), "state");
  assert.equal(fieldForAddressDetail("something else"), null);
});

test("waiting messages and the never-dead button", () => {
  assert.equal(quotePhase({ busy: true, elapsedMs: 1000, stateOk: false, hasProblem: false }), "loading");
  assert.equal(quotePhase({ busy: true, elapsedMs: 6000, stateOk: false, hasProblem: false }), "slow");
  assert.equal(quotePhase({ busy: false, elapsedMs: 0, stateOk: false, hasProblem: true }), "failed");
  const src = readFileSync(join(root, "app/checkout/CheckoutClient.tsx"), "utf8");
  assert.doesNotMatch(src, /type="submit" disabled=\{hasPrintItem && !printPriceConfirmed\}/, "the Continue button is never silently disabled");
  assert.match(src, /Try again/);
  assert.match(src, /getShippingOptions/);
});

test("the field that blocks Next is named in plain words", () => {
  const ok = { fullName: "A B", email: "a@b.co", country: "Kenya", phone: "712345678", address: "1 Road", city: "Nairobi", state: "", postcode: "00100" };
  assert.deepEqual(deliveryBlockers(ok, true), []);
  assert.deepEqual(deliveryBlockers({ ...ok, phone: "" }, true).map((b) => b.fieldId), ["co-phone"]);
  assert.match(deliveryBlockers({ ...ok, phone: "12" }, true)[0].message, /incomplete/);
  assert.deepEqual(deliveryBlockers({ ...ok, phone: "" }, false), [], "phone is optional for digital-only orders");
  assert.deepEqual(deliveryBlockers({ ...ok, country: "United States", state: "", postcode: "ABC" }, true).map((b) => b.fieldId), ["co-state", "co-postcode"]);
  assert.match(deliveryBlockers({ ...ok, email: "nope" }, true)[0].message, /does not look right/);
});

test("incomplete print details are flagged", () => {
  const complete = { submissionMetadata: { pages: 40, trimSizeCode: "0600X0900" }, hasInteriorFile: true, hasPrintFormat: true };
  assert.deepEqual(printDetailsProblems(complete), []);
  assert.equal(worstLevel(printDetailsProblems({ ...complete, submissionMetadata: {}, hasInteriorFile: false })), "error");
  assert.equal(worstLevel(printDetailsProblems({ ...complete, submissionMetadata: {} })), "warning");
  assert.deepEqual(printDetailsProblems({ ...complete, submissionMetadata: null, hasInteriorFile: false, hasPrintFormat: false }), []);
});

test("Lulu calls have time limits, quote failures are logged without personal data, and the test switch is never live", () => {
  const l = readFileSync(join(root, "lib/payments/lulu.ts"), "utf8");
  const ship = l.slice(l.indexOf("export async function quoteLuluShippingDetailed"), l.indexOf("const LULU_REQUEST_TIMEOUT_MS"));
  assert.match(ship, /postLuluQuote\(/);
  assert.doesNotMatch(ship, /await fetch\(/);
  assert.match(l.slice(l.indexOf("async function getAccessToken"), l.indexOf("export type LuluPrintLineItem")), /AbortSignal\.timeout/);
  const a = readFileSync(join(root, "actions/shipping-options.ts"), "utf8");
  assert.match(a, /QUOTE_BUDGET_MS/);
  assert.match(a, /\[quote\] \$\{outcome\} kind=/);
  assert.doesNotMatch(a, /console\.(error|log)\([^)]*(input\.address|input\.phone|input\.name)/);
  assert.match(a, /deploymentOf\(\) === "production"\) return null/);
});

test("the one-time cleanup is a single atomic statement that refuses staging and cannot weaken the lock", () => {
  const run = readFileSync(join(root, "scripts/cleanup-test-data.ts"), "utf8");
  const sql = readFileSync(join(root, "scripts/cleanup-sql.ts"), "utf8");
  assert.doesNotMatch(run, /\$transaction/, "no long step-by-step transaction (Neon drops those: 'Transaction not found')");
  assert.match(run, /ep-royal-unit-ax5doypv/);
  assert.match(run, /DELETE TEST DATA/);
  assert.match(sql, /set_config\('app\.allow_record_delete', 'on', true\)/, "the lock is lifted for that one statement only");
  assert.doesNotMatch(sql + run, /DROP\s+(TABLE|TRIGGER)|TRUNCATE|migrate reset|db push/i);
  for (const kept of ['"User"', '"Book"', '"BookFile"']) assert.ok(!new RegExp(`DELETE FROM ${kept}`).test(sql), `${kept} is never deleted`);
});
