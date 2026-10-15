import test from "node:test";
import assert from "node:assert/strict";
import { saleModeLabel, payoutModeLabel, paypalFundingKind } from "../lib/payment-mode";

test("sale mode names the gateway and PayPal funding type", () => {
  assert.equal(saleModeLabel({ gateway: "PAYSTACK", rawPayload: {} }), "Paystack");
  assert.equal(saleModeLabel({ gateway: "PAYPAL", rawPayload: { captured: { payment_source: { card: { last_digits: "1111" } } } } }), "PayPal - Card");
  assert.equal(saleModeLabel({ gateway: "PAYPAL", rawPayload: { captured: { payment_source: { paypal: { email_address: "a@b.c" } } } } }), "PayPal - Email");
  assert.equal(saleModeLabel({ gateway: "PAYPAL", rawPayload: { source: "return_redirect" } }), "PayPal");
  assert.equal(saleModeLabel(null), "—");
});

test("funding kind is unknown without a payment source", () => {
  assert.equal(paypalFundingKind(undefined), null);
});

test("payout mode follows the recipient type", () => {
  assert.equal(payoutModeLabel("email"), "PayPal - Email");
  assert.equal(payoutModeLabel("mpesa"), "M-Pesa");
  assert.equal(payoutModeLabel("bank"), "Bank transfer");
  assert.equal(payoutModeLabel(undefined), "—");
});
