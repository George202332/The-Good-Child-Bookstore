import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROLLED_LABEL,
  ROLLED_HELP,
  isRolled,
  isUnderMinimum,
  isRolledLedgerStatus,
  isLedgerRowPayable,
  ledgerStatusLabel,
  resolveMonthlyRollover,
  type MonthlyAmounts,
} from "../lib/payout-status";

/**
 * The single shared definition of the "Rolled" payout status (see
 * lib/payout-status.ts) — every surface that shows a per-month status
 * uses these helpers, so these tests are the contract for all of them.
 */

function month(year: number, m: number, author: number, affiliate = 0): MonthlyAmounts {
  return { monthKey: `${year}-${String(m + 1).padStart(2, "0")}`, year, month: m, author, affiliate };
}

describe("Rolled label", () => {
  test("the display text is exactly 'Rolled' and the help text explains the $30 rollover", () => {
    assert.equal(ROLLED_LABEL, "Rolled");
    assert.equal(ROLLED_HELP, "Under $30, so this balance rolls into next month's payout cycle");
  });
});

describe("isRolled", () => {
  test("released, unpaid and under $30 is Rolled", () => {
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 12, paid: false }), true);
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 29.99, paid: false }), true);
  });
  test("exactly $30 or more is not Rolled", () => {
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 30, paid: false }), false);
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 37, paid: false }), false);
  });
  test("before the release date (still-open month) it is not Rolled", () => {
    assert.equal(isRolled({ releaseDatePassed: false, payableBalance: 12, paid: false }), false);
  });
  test("a paid balance is never Rolled, and neither is a zero balance", () => {
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 12, paid: true }), false);
    assert.equal(isRolled({ releaseDatePassed: true, payableBalance: 0, paid: false }), false);
    assert.equal(isUnderMinimum(0), false);
  });
});

describe("admin ledger statuses", () => {
  test("Category A (ON_HOLD) reads Rolled; the others keep their wording", () => {
    assert.equal(ledgerStatusLabel("ON_HOLD", false), "Rolled");
    assert.equal(ledgerStatusLabel("LIVE", false), "On Hold");
    assert.equal(ledgerStatusLabel("SCHEDULED", false), "Scheduled");
    assert.equal(ledgerStatusLabel("REQUESTED", false), "Queued");
    assert.equal(ledgerStatusLabel("PAID", true), "Paid");
    assert.equal(ledgerStatusLabel("REJECTED", false), "Rejected");
    assert.equal(isRolledLedgerStatus("ON_HOLD"), true);
    assert.equal(isRolledLedgerStatus("SCHEDULED"), false);
  });
  test("a Rolled (or Live, Paid, Rejected) row is never payable", () => {
    assert.equal(isLedgerRowPayable("ON_HOLD"), false);
    assert.equal(isLedgerRowPayable("LIVE"), false);
    assert.equal(isLedgerRowPayable("PAID"), false);
    assert.equal(isLedgerRowPayable("REJECTED"), false);
    assert.equal(isLedgerRowPayable("REQUESTED"), true);
    assert.equal(isLedgerRowPayable("SCHEDULED"), true);
  });
});

describe("resolveMonthlyRollover — the worked example", () => {
  // Jan $12, Feb $10, Mar $15 (author wallet).
  const months = [month(2026, 0, 12), month(2026, 1, 10), month(2026, 2, 15)];

  test("in March (Jan and Feb closed, March still open): 12 then 22, both Rolled", () => {
    const r = resolveMonthlyRollover(months, new Date(2026, 2, 10));
    assert.equal(r.get("2026-01")?.rolled, true);
    assert.equal(r.get("2026-02")?.rolled, true);
    assert.equal(r.has("2026-03"), false); // still open — not resolved here (it is "Live")
  });

  test("once March closes: 22 + 15 = 37 >= 30, all three released together, none Rolled", () => {
    const r = resolveMonthlyRollover(months, new Date(2026, 3, 2));
    for (const key of ["2026-01", "2026-02", "2026-03"]) {
      assert.equal(r.get(key)?.rolled, false, key);
      assert.equal(r.get(key)?.releasedWithMonthKey, "2026-03", key);
    }
  });

  test("right after January closes: $12 is Rolled", () => {
    const r = resolveMonthlyRollover(months, new Date(2026, 1, 2));
    assert.equal(r.get("2026-01")?.rolled, true);
  });
});

describe("resolveMonthlyRollover — other rules", () => {
  test("a single month of exactly $30 releases on its own", () => {
    const r = resolveMonthlyRollover([month(2026, 0, 30)], new Date(2026, 5, 1));
    assert.equal(r.get("2026-01")?.rolled, false);
    assert.equal(r.get("2026-01")?.releasedWithMonthKey, "2026-01");
  });

  test("the running total resets after a release: $40 releases, the next $5 is Rolled", () => {
    const r = resolveMonthlyRollover([month(2026, 0, 40), month(2026, 1, 5)], new Date(2026, 5, 1));
    assert.equal(r.get("2026-01")?.rolled, false);
    assert.equal(r.get("2026-02")?.rolled, true);
  });

  test("author and affiliate are separate wallets, each with its own $30 test", () => {
    // Author $35 releases; the affiliate's $10 in the same month is a different wallet, still under $30.
    const r = resolveMonthlyRollover([month(2026, 0, 35, 10)], new Date(2026, 5, 1));
    assert.equal(r.get("2026-01")?.rolled, false);
    // An affiliate-only $10 month is Rolled.
    const r2 = resolveMonthlyRollover([month(2026, 0, 0, 10)], new Date(2026, 5, 1));
    assert.equal(r2.get("2026-01")?.rolled, true);
    // $20 author + $15 affiliate is NOT one $35 balance — both wallets stay under $30.
    const r3 = resolveMonthlyRollover([month(2026, 0, 20, 15)], new Date(2026, 5, 1));
    assert.equal(r3.get("2026-01")?.rolled, true);
  });

  test("the still-open current month is never Rolled", () => {
    const now = new Date(2026, 5, 10);
    const r = resolveMonthlyRollover([month(2026, 5, 5)], now);
    assert.equal(r.has("2026-06"), false);
  });
});
