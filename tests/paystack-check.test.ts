import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePaystackPayment, expectedMinorUnits } from "../lib/payments/paystack-check";
import { paystackKeyMode } from "../lib/payments/paystack";

const paid = { success: true, ourOrderId: "o1", amountMinor: 1499, currency: "USD" };

test("USD totals are converted to cents exactly", () => {
  assert.equal(expectedMinorUnits(14.99), 1499);
  assert.equal(expectedMinorUnits(0.29), 29);
  assert.equal(expectedMinorUnits(19.9), 1990);
});

test("a payment is accepted only for the right order, currency and amount", () => {
  assert.deepEqual(evaluatePaystackPayment(paid, "o1", 14.99), { ok: true });
  assert.equal(evaluatePaystackPayment({ ...paid, success: false }, "o1", 14.99).ok, false);
  assert.equal(evaluatePaystackPayment(paid, "o2", 14.99).ok, false);
  assert.equal(evaluatePaystackPayment({ ...paid, currency: "KES" }, "o1", 14.99).ok, false);
  assert.equal(evaluatePaystackPayment({ ...paid, currency: null }, "o1", 14.99).ok, false);
  assert.equal(evaluatePaystackPayment({ ...paid, amountMinor: 149 }, "o1", 14.99).ok, false);
  assert.equal(evaluatePaystackPayment({ ...paid, amountMinor: null }, "o1", 14.99).ok, false);
});

test("key mode is read from the public prefix only", () => {
  assert.equal(paystackKeyMode("sk_live_abc"), "live");
  assert.equal(paystackKeyMode("pk_test_abc"), "test");
  assert.equal(paystackKeyMode("whatever"), "unknown");
  assert.equal(paystackKeyMode(undefined), "unknown");
});
