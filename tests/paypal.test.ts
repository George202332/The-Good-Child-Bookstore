import test from "node:test";
import assert from "node:assert/strict";
import { paypalAmountString, buildPaypalOrderBody, pickApprovalLink, evaluatePaypalCapture, paypalBaseUrl } from "../lib/payments/paypal";

test("amounts are sent to PayPal with exactly two decimals", () => {
  assert.equal(paypalAmountString(9), "9.00");
  assert.equal(paypalAmountString(12.5), "12.50");
  assert.equal(paypalAmountString(0.1 + 0.2), "0.30");
});

test("the order body carries our order id and total, and no shipping prompt", () => {
  const b = buildPaypalOrderBody("ord1", 14.99, "https://x/return", "https://x/cancel");
  assert.equal(b.intent, "CAPTURE");
  assert.equal(b.purchase_units[0].custom_id, "ord1");
  assert.equal(b.purchase_units[0].amount.value, "14.99");
  assert.equal(b.payment_source.paypal.experience_context.shipping_preference, "NO_SHIPPING");
});

test("the approval link is found, preferring payer-action", () => {
  assert.equal(pickApprovalLink([{ rel: "self", href: "a" }, { rel: "approve", href: "b" }]), "b");
  assert.equal(pickApprovalLink([{ rel: "approve", href: "b" }, { rel: "payer-action", href: "c" }]), "c");
  assert.equal(pickApprovalLink([]), null);
});

const good = {
  status: "COMPLETED",
  purchase_units: [{ custom_id: "ord1", payments: { captures: [{ status: "COMPLETED", amount: { currency_code: "USD", value: "14.99" } }] } }],
};

test("a capture is trusted only for the right order, currency and amount", () => {
  assert.deepEqual(evaluatePaypalCapture(good, "ord1", 14.99), { ok: true });
  assert.equal(evaluatePaypalCapture(good, "other", 14.99).ok, false);
  assert.equal(evaluatePaypalCapture(good, "ord1", 20).ok, false);
  assert.equal(evaluatePaypalCapture({ ...good, status: "APPROVED" }, "ord1", 14.99).ok, false);
  const eur = { ...good, purchase_units: [{ custom_id: "ord1", payments: { captures: [{ status: "COMPLETED", amount: { currency_code: "EUR", value: "14.99" } }] } }] };
  assert.equal(evaluatePaypalCapture(eur, "ord1", 14.99).ok, false);
});

test("sandbox and live use different PayPal addresses", () => {
  assert.match(paypalBaseUrl("sandbox"), /sandbox/);
  assert.doesNotMatch(paypalBaseUrl("live"), /sandbox/);
});
