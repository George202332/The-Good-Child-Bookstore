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

import { buildVerifyBody, isSuccessfulVerification, planPaypalEvent } from "../lib/payments/paypal-webhook";

test("webhook verification body needs every signature header", () => {
  const full = new Headers({ "paypal-auth-algo": "a", "paypal-cert-url": "c", "paypal-transmission-id": "i", "paypal-transmission-sig": "s", "paypal-transmission-time": "t" });
  const body = buildVerifyBody(full, "WH-1", { id: "E1" });
  assert.equal(body?.webhook_id, "WH-1");
  assert.deepEqual(body?.webhook_event, { id: "E1" });
  const missing = new Headers({ "paypal-auth-algo": "a" });
  assert.equal(buildVerifyBody(missing, "WH-1", {}), null);
});

test("only SUCCESS counts as a verified signature", () => {
  assert.equal(isSuccessfulVerification({ verification_status: "SUCCESS" }), true);
  assert.equal(isSuccessfulVerification({ verification_status: "FAILURE" }), false);
  assert.equal(isSuccessfulVerification(null), false);
});

test("webhook events: approved orders are captured, completed captures are checked, the rest ignored", () => {
  assert.deepEqual(planPaypalEvent({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "PO1" } }), { action: "capture", paypalOrderId: "PO1" });
  assert.deepEqual(planPaypalEvent({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { supplementary_data: { related_ids: { order_id: "PO2" } } } }), { action: "check", paypalOrderId: "PO2" });
  assert.equal(planPaypalEvent({ event_type: "PAYMENT.CAPTURE.DENIED", resource: { id: "x" } }), null);
  assert.equal(planPaypalEvent({ event_type: "CHECKOUT.ORDER.APPROVED" }), null);
});

test("the order asks PayPal to offer both PayPal login and card", () => {
  const b = buildPaypalOrderBody("o", 1, "r", "c");
  assert.equal(b.payment_source.paypal.experience_context.landing_page, "NO_PREFERENCE");
});
