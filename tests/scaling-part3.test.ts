import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tunedDatabaseUrl, isPooledUrl } from "../lib/db-url";
import { RULES, windowStartOf, shortHash } from "../lib/rate-limit-core";
import { backoffDelay, shouldRetryStatus } from "../lib/http";
import { relatedCandidates } from "../lib/related-candidates";
import { capacityWarnings, percentile } from "../lib/site-health/capacity";
import { noteSlowQuery, recentSlowQueries } from "../lib/site-health/slow-queries";
import type { Book } from "../lib/data/catalog";

const read = (p: string) => readFileSync(p, "utf8");

test("pooled address gets pgbouncer and a small connection limit; others keep working", () => {
  const u = new URL(tunedDatabaseUrl("postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/db?sslmode=require", {})!);
  assert.equal(u.searchParams.get("pgbouncer"), "true");
  assert.equal(u.searchParams.get("connection_limit"), "5");
  assert.equal(u.searchParams.get("sslmode"), "require");
  const d = new URL(tunedDatabaseUrl("postgresql://u:p@ep-x.eu.aws.neon.tech/db", {})!);
  assert.equal(d.searchParams.get("pgbouncer"), null);
  assert.equal(d.searchParams.get("connection_limit"), "10");
  const own = new URL(tunedDatabaseUrl("postgresql://u:p@ep-x-pooler.h/db?connection_limit=2&pgbouncer=true", {})!);
  assert.equal(own.searchParams.get("connection_limit"), "2");
  assert.equal(tunedDatabaseUrl(undefined, {}), undefined);
  assert.equal(tunedDatabaseUrl("not a url", {}), "not a url");
  assert.ok(isPooledUrl("postgresql://a@ep-1-pooler.x/db"));
  assert.ok(!isPooledUrl("postgresql://a@ep-1.x/db"));
});

test("rate limit windows line up and visitor keys are hashed", () => {
  const t = Date.UTC(2026, 10, 5, 12, 3, 41);
  assert.equal(windowStartOf(t, 300).toISOString(), "2026-11-05T12:00:00.000Z");
  assert.equal(windowStartOf(t, 60).toISOString(), "2026-11-05T12:03:00.000Z");
  assert.equal(shortHash("1.2.3.4").length, 20);
  assert.notEqual(shortHash("1.2.3.4"), shortHash("1.2.3.5"));
  assert.ok(!shortHash("1.2.3.4").includes("1.2.3"));
  assert.ok(RULES.login.limit <= 10 && RULES.search.limit >= 30);
});

test("retry rules: only server trouble is retried, waits grow", () => {
  for (const s of [429, 500, 502, 503, 504]) assert.ok(shouldRetryStatus(s));
  for (const s of [200, 201, 400, 401, 404]) assert.ok(!shouldRetryStatus(s));
  const mid = () => 0.5;
  assert.ok(backoffDelay(1, 300, mid) > backoffDelay(0, 300, mid));
  assert.equal(backoffDelay(0, 300, mid), 300);
});

test("related candidates keep same-category books, skip the book itself, and stay small", () => {
  const mk = (id: string, series: string, category = "x"): Book => ({ id, series, category, subcategory: "" } as unknown as Book);
  const all = Array.from({ length: 400 }, (_, i) => mk(`b${i}`, i % 2 ? "A" : "B", i % 2 ? "A" : "B"));
  const out = relatedCandidates(all[1], all);
  assert.ok(out.length <= 162);
  assert.ok(!out.some((b) => b.id === "b1"));
  assert.ok(out.filter((b) => b.series === "A").length >= 100);
});

test("capacity warnings and percentile", () => {
  assert.equal(percentile([1, 2, 3, 4, 100], 95), 100);
  assert.equal(percentile([], 95), 0);
  assert.equal(capacityWarnings({ connections: { used: 90, max: 100, percent: 90 }, errorsLastHour: 0, responseTimes: [] }).length, 1);
  assert.equal(capacityWarnings({ connections: null, errorsLastHour: null, responseTimes: [] }).length, 0);
  assert.equal(capacityWarnings({ connections: null, errorsLastHour: 25, responseTimes: [{ service: "Lulu", avgMs: 1, p95Ms: 4000, samples: 9 }] }).length, 2);
});

test("slow queries are kept only when slow", () => {
  noteSlowQuery("SELECT 1", 5);
  noteSlowQuery("SELECT   slow", 2500);
  const q = recentSlowQueries();
  assert.equal(q.length, 1);
  assert.equal(q[0].text, "SELECT slow");
});

test("wiring: webhooks answer fast, cron is secret-protected, load test is staging only, no crawler limits on pages", () => {
  assert.match(read("app/api/webhooks/paystack/route.ts"), /defer: true/);
  assert.match(read("app/api/webhooks/paypal/route.ts"), /defer: true/);
  assert.match(read("lib/payments/finalize.ts"), /opts\.defer/);
  const cron = read("app/api/cron/order-retry/route.ts");
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /timingSafeEqual/);
  const lt = read("scripts/load-test-staging.mjs");
  assert.match(lt, /noindex/);
  assert.match(lt, /Type STAGING/);
  assert.doesNotMatch(lt, /method:\s*["']POST/);
  assert.doesNotMatch(read("proxy.ts"), /rateLimit/);
  assert.match(read("lib/prisma.ts"), /tunedDatabaseUrl/);
});

test("migration only adds things", () => {
  const sql = read("prisma/migrations/20261108090000_scaling_indexes_and_rate_limits/migration.sql");
  assert.doesNotMatch(sql, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bALTER\s+TABLE/i);
  for (const line of sql.split("\n").filter((l) => /^CREATE/.test(l))) assert.match(line, /IF NOT EXISTS/);
});
