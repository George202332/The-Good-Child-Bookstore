import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPayoutMethodTypeAvailable, isLegacyPayoutType, PAYPAL_PAYOUTS_ENABLED } from "../lib/payout-method-availability";

describe("payout method availability", () => {
  test("bank transfer is the only method that can be chosen", () => {
    assert.equal(isPayoutMethodTypeAvailable("bank"), true);
    assert.equal(isPayoutMethodTypeAvailable("email"), false);
    assert.equal(isPayoutMethodTypeAvailable(" MPESA "), false);
    assert.equal(PAYPAL_PAYOUTS_ENABLED, false);
  });
  test("old PayPal and M-Pesa records are flagged so the user is asked to choose Bank Transfer", () => {
    assert.equal(isLegacyPayoutType("email"), true);
    assert.equal(isLegacyPayoutType("mpesa"), true);
    assert.equal(isLegacyPayoutType("bank"), false);
  });
});
