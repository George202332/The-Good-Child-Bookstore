import test from "node:test";
import assert from "node:assert/strict";
import { resolvePaystack } from "../lib/payment-env";
import { decidePreflightGate } from "../lib/print-preflight-gate";

test("Paystack: a test key still works when the saved mode label says live", () => {
  const r = resolvePaystack({}, "live", { secretKey: "sk_test_abc", publicKey: "pk_test_abc" });
  assert.equal(r.mode, "test");
  assert.equal(r.keys.secretKey, "sk_test_abc");
  assert.equal(r.source, "key");
});

test("Paystack: PAYSTACK_MODE set in Vercel stays strict", () => {
  const r = resolvePaystack({ PAYSTACK_MODE: "live" }, "test", { secretKey: "sk_test_abc" });
  assert.equal(r.mode, "live");
  assert.equal(r.keys.secretKey, undefined);
});

test("Paystack: matching key and mode is unchanged", () => {
  const r = resolvePaystack({ PAYSTACK_TEST_SECRET_KEY: "sk_test_x" }, null, {});
  assert.equal(r.mode, "test");
  assert.equal(r.keys.secretKey, "sk_test_x");
  assert.equal(r.source, "default");
});

test("print check: a passed result is kept for the same files even if a print setting changed", () => {
  const saved = { status: "PASSED" as const, checkedAt: "2026-11-01T00:00:00.000Z", checkId: "c1", interiorFileId: "f1", coverKey: "k1", packageIds: "old", reasons: [] };
  const d = decidePreflightGate({ keys: { interiorFileId: "f1", coverKey: "k1", packageIds: "new" }, latest: null, saved, requirePass: true });
  assert.equal(d.ok, true);
});

test("print check: a new interior file or a new cover needs a new check", () => {
  const saved = { status: "PASSED" as const, checkedAt: "2026-11-01T00:00:00.000Z", checkId: "c1", interiorFileId: "f1", coverKey: "k1", packageIds: "p", reasons: [] };
  assert.equal(decidePreflightGate({ keys: { interiorFileId: "f2", coverKey: "k1", packageIds: "p" }, latest: null, saved, requirePass: true }).ok, false);
  assert.equal(decidePreflightGate({ keys: { interiorFileId: "f1", coverKey: "k2", packageIds: "p" }, latest: null, saved, requirePass: true }).ok, false);
});
