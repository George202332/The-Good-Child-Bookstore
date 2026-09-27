import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeWallet, nextReleaseDate, releaseDateFor } from "../lib/wallet";

/**
 * Regression coverage for the on-hold/available wallet math shared by
 * the author Revenue page, the affiliate Earnings view, and the
 * Payout Settings stat cards (lib/wallet.ts) — this is the part of
 * the app where a silent miscalculation would matter most (real
 * money), and it previously had no automated coverage at all.
 */

describe("releaseDateFor", () => {
  test("a sale releases on the 15th of the FOLLOWING month", () => {
    assert.deepEqual(releaseDateFor(new Date(2026, 0, 5)), new Date(2026, 1, 15));
  });

  test("December sales roll over into January of the next year", () => {
    assert.deepEqual(releaseDateFor(new Date(2026, 11, 31)), new Date(2027, 0, 15));
  });
});

describe("computeWallet", () => {
  test("a sale before its release date sits entirely On Hold", () => {
    const now = new Date();
    // A sale made "now" always releases in a future month, so it's
    // still on hold regardless of what day this test runs.
    const wallet = computeWallet([{ createdAt: now, amount: 100 }], 0, 0);
    assert.equal(wallet.onHold, 100);
    assert.equal(wallet.available, 0);
    assert.equal(wallet.totalEarned, 100);
  });

  test("a sale from well over a year ago is fully released and available", () => {
    const longAgo = new Date(2000, 0, 1);
    const wallet = computeWallet([{ createdAt: longAgo, amount: 100 }], 0, 0);
    assert.equal(wallet.onHold, 0);
    assert.equal(wallet.available, 100);
    assert.equal(wallet.totalEarned, 100);
  });

  test("already-paid-out and pending amounts are subtracted from Available, never below zero", () => {
    const longAgo = new Date(2000, 0, 1);
    const wallet = computeWallet([{ createdAt: longAgo, amount: 100 }], 60, 0);
    assert.equal(wallet.available, 40);

    const walletFullyClaimed = computeWallet([{ createdAt: longAgo, amount: 100 }], 60, 60);
    assert.equal(walletFullyClaimed.available, 0, "available must floor at 0, never go negative");
  });

  test("On Hold and Available are tracked separately across a mix of old and recent sales", () => {
    const longAgo = new Date(2000, 0, 1);
    const now = new Date();
    const wallet = computeWallet(
      [
        { createdAt: longAgo, amount: 100 },
        { createdAt: now, amount: 50 },
      ],
      0,
      0
    );
    assert.equal(wallet.onHold, 50);
    assert.equal(wallet.available, 100);
    assert.equal(wallet.totalEarned, 150);
  });
});

describe("nextReleaseDate", () => {
  test("returns null when nothing is on hold", () => {
    const longAgo = new Date(2000, 0, 1);
    assert.equal(nextReleaseDate([{ createdAt: longAgo, amount: 100 }]), null);
  });

  test("returns the SOONER release date when multiple lines are on hold", () => {
    const now = new Date();
    const earlierThisPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
    const lines = [
      { createdAt: now, amount: 10 },
      { createdAt: earlierThisPeriod, amount: 10 },
    ];
    const result = nextReleaseDate(lines);
    assert.ok(result);
    // Both lines fall in the current still-open month, so both share
    // the same release date — the 15th of next month.
    assert.deepEqual(result, releaseDateFor(earlierThisPeriod));
  });
});
