import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAYOUT_METHOD_TOGGLES,
  PAYOUT_METHOD_UNAVAILABLE_MESSAGE,
  isPayoutMethodTypeAvailable,
  resolvePayoutMethodToggles,
} from "../lib/payout-method-availability";

describe("payout method availability", () => {
  test("message text is exact", () => {
    assert.equal(PAYOUT_METHOD_UNAVAILABLE_MESSAGE, "Currently, we do not accept payouts using this method.");
  });

  test("defaults are both OFF", () => {
    assert.deepEqual(DEFAULT_PAYOUT_METHOD_TOGGLES, { paypalPayoutsEnabled: false, mpesaPayoutsEnabled: false });
    assert.deepEqual(resolvePayoutMethodToggles(undefined), DEFAULT_PAYOUT_METHOD_TOGGLES);
    assert.deepEqual(resolvePayoutMethodToggles({}), DEFAULT_PAYOUT_METHOD_TOGGLES);
  });

  test("only a literal true switches a toggle on", () => {
    assert.deepEqual(resolvePayoutMethodToggles({ paypalPayoutsEnabled: "true", mpesaPayoutsEnabled: 1 }), DEFAULT_PAYOUT_METHOD_TOGGLES);
    assert.deepEqual(resolvePayoutMethodToggles({ paypalPayoutsEnabled: true }), { paypalPayoutsEnabled: true, mpesaPayoutsEnabled: false });
  });

  test("bank is always available; PayPal and M-Pesa follow their own toggle", () => {
    const off = DEFAULT_PAYOUT_METHOD_TOGGLES;
    assert.equal(isPayoutMethodTypeAvailable("bank", off), true);
    assert.equal(isPayoutMethodTypeAvailable("iban", off), true);
    assert.equal(isPayoutMethodTypeAvailable("email", off), false);
    assert.equal(isPayoutMethodTypeAvailable("mpesa", off), false);
    assert.equal(isPayoutMethodTypeAvailable("email", { ...off, paypalPayoutsEnabled: true }), true);
    assert.equal(isPayoutMethodTypeAvailable("mpesa", { ...off, paypalPayoutsEnabled: true }), false);
    assert.equal(isPayoutMethodTypeAvailable(" MPESA ", { ...off, mpesaPayoutsEnabled: true }), true);
  });
});
