import test from "node:test";
import assert from "node:assert/strict";
import { resolvePaystackMode, resolvePaypalMode, pickPaystackKeys, pickPaypalKeys, paystackKeyKind } from "../lib/payment-env";
import { isbnDigits13, ean13Modules } from "../lib/mockup/barcode";
import { bookDimensions } from "../lib/mockup/spec";

test("Paystack mode: env wins, then admin, then test", () => {
  assert.deepEqual(resolvePaystackMode({ PAYSTACK_MODE: "live" }, "test"), { mode: "live", source: "environment" });
  assert.deepEqual(resolvePaystackMode({}, "live"), { mode: "live", source: "admin settings" });
  assert.deepEqual(resolvePaystackMode({}, null), { mode: "test", source: "default" });
});

test("PayPal mode defaults to sandbox and honours PAYPAL_MODE", () => {
  assert.equal(resolvePaypalMode({}, null).mode, "sandbox");
  assert.equal(resolvePaypalMode({ PAYPAL_MODE: "live" }, "sandbox").mode, "live");
});

test("Paystack keys match the active mode only", () => {
  const env = { PAYSTACK_TEST_SECRET_KEY: "sk_test_a", PAYSTACK_LIVE_SECRET_KEY: "sk_live_b", PAYSTACK_SECRET_KEY: "sk_live_old" };
  assert.equal(pickPaystackKeys("test", env, {}).secretKey, "sk_test_a");
  assert.equal(pickPaystackKeys("live", env, {}).secretKey, "sk_live_b");
  assert.equal(pickPaystackKeys("test", { PAYSTACK_SECRET_KEY: "sk_live_old" }, {}).secretKey, undefined);
  assert.equal(paystackKeyKind("pk_test_x"), "test");
});

test("PayPal keys: sandbox and live side by side", () => {
  const env = { PAYPAL_SANDBOX_CLIENT_ID: "s", PAYPAL_LIVE_CLIENT_ID: "l" };
  assert.equal(pickPaypalKeys("sandbox", env, {}).clientId, "s");
  assert.equal(pickPaypalKeys("live", env, {}).clientId, "l");
});

test("barcode: ISBN-10 converts, bad check digit rejected, 95 modules", () => {
  assert.equal(isbnDigits13("0-306-40615-2"), "9780306406157");
  assert.equal(isbnDigits13("9780306406158"), null);
  assert.equal(ean13Modules("9780306406157").length, 95);
});

test("hardcover is thicker than paperback for the same pages", () => {
  const base = { trimCode: "0600X0900", pages: 200, paperCode: "444" };
  assert.ok(bookDimensions({ ...base, format: "hardcover" }).t > bookDimensions({ ...base, format: "paperback" }).t);
});
