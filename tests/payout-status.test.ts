import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeWallet } from "../lib/wallet";
import {
  ROLLED_LABEL,
  ROLLED_HELP,
  isRolled,
  isUnderMinimum,
  isRolledLedgerStatus,
  isLedgerRowPayable,
  ledgerStatusLabel,
  resolveMonthlyRollover,
  rolloverIntoMonth,
  computeLiveTotal,
  rolledOverNote,
  ledgerStatusKey,
  ledgerStatusPillStyle,
  authorStatusLabel,
  authorStatusPillStyle,
  PAYOUT_STATUS_PILL_STYLES,
  PAYOUT_STATUS_FILTER_OPTIONS,
  STATUS_COLUMN_HELP,
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
  test("user-facing lifecycle: ON_HOLD reads Rolled, LIVE reads Live, SCHEDULED and queued REQUESTED/APPROVED read Pending", () => {
    assert.equal(ledgerStatusLabel("ON_HOLD", false), "Rolled");
    assert.equal(ledgerStatusLabel("LIVE", false), "Live");
    assert.equal(ledgerStatusLabel("SCHEDULED", false), "Pending");
    assert.equal(ledgerStatusLabel("REQUESTED", false), "Pending");
    assert.equal(ledgerStatusLabel("APPROVED", false), "Pending");
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
    assert.equal(isLedgerRowPayable("APPROVED"), true);
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

describe("labels, colours and filters come from one shared definition", () => {
  test("internal statuses map to the lifecycle keys; DB enum values are untouched", () => {
    assert.equal(ledgerStatusKey("LIVE", false), "live");
    assert.equal(ledgerStatusKey("ON_HOLD", false), "rolled");
    assert.equal(ledgerStatusKey("SCHEDULED", false), "pending");
    assert.equal(ledgerStatusKey("REQUESTED", false), "pending");
    assert.equal(ledgerStatusKey("PAID", true), "paid");
    assert.equal(ledgerStatusKey("REJECTED", false), "rejected");
  });
  test("author history labels: 'Pending payout' reads Pending, the rest keep their word", () => {
    assert.equal(authorStatusLabel("Pending payout"), "Pending");
    assert.equal(authorStatusLabel("Live"), "Live");
    assert.equal(authorStatusLabel("Rolled"), "Rolled");
    assert.equal(authorStatusLabel("Paid"), "Paid");
  });
  test("the admin pill and the author pill use the very same Rolled style, and it is not purple and not shared", () => {
    assert.deepEqual(ledgerStatusPillStyle("ON_HOLD", false), authorStatusPillStyle("Rolled"));
    const rolled = PAYOUT_STATUS_PILL_STYLES.rolled;
    for (const [key, style] of Object.entries(PAYOUT_STATUS_PILL_STYLES)) {
      if (key !== "rolled") assert.notDeepEqual(style, rolled, key);
    }
    assert.ok(!/108,84,160|4B3A85/i.test(JSON.stringify(rolled)), "no longer the old violet");
  });
  test("the status filter lists exactly Live, Rolled, Pending, Paid, Rejected", () => {
    assert.deepEqual(PAYOUT_STATUS_FILTER_OPTIONS.map((o) => o.label), ["Live", "Rolled", "Pending", "Paid", "Rejected"]);
  });
  test("the Status column help explains Rolled, Live and Pending, and no longer On Hold / Scheduled / Queued", () => {
    assert.match(STATUS_COLUMN_HELP, /Rolled/);
    assert.match(STATUS_COLUMN_HELP, /Live/);
    assert.match(STATUS_COLUMN_HELP, /Pending/);
    assert.doesNotMatch(STATUS_COLUMN_HELP, /On Hold|Scheduled|Queued/);
  });
});

describe("Amendment 2: live total = current cycle + rolled over", () => {
  test("rolled $12 + live $8 = $20, with the note", () => {
    const live = computeLiveTotal({ currentCycle: 8, walletAvailables: [12] });
    assert.deepEqual(live, { currentCycle: 8, rolledOver: 12, total: 20 });
    assert.equal(rolledOverNote(live.rolledOver), "includes $12.00 rolled over from earlier months");
  });
  test("nothing rolled: total is just the cycle and there is no note", () => {
    const live = computeLiveTotal({ currentCycle: 8, walletAvailables: [0, 0] });
    assert.equal(live.total, 8);
    assert.equal(rolledOverNote(live.rolledOver), null);
  });
  test("a wallet at $30 or more is Pending (to be paid), not rolled, so it is not folded into the live total", () => {
    assert.equal(computeLiveTotal({ currentCycle: 8, walletAvailables: [30] }).total, 8);
    assert.equal(computeLiveTotal({ currentCycle: 8, walletAvailables: [37] }).rolledOver, 0);
    assert.equal(computeLiveTotal({ currentCycle: 8, walletAvailables: [29.99] }).total, 37.99);
  });
  test("each wallet is tested on its own: author $12 rolled + affiliate $35 pending + live $8 = $20", () => {
    assert.equal(computeLiveTotal({ currentCycle: 8, walletAvailables: [12, 35] }).total, 20);
  });
  test("end to end with the real wallet math: a $12 sale from an earlier month and an $8 sale this month", () => {
    const now = new Date();
    const longAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10); // released
    const wallet = computeWallet(
      [{ createdAt: longAgo, amount: 12 }, { createdAt: now, amount: 8 }],
      0,
      0
    );
    assert.equal(wallet.onHold, 8); // current cycle
    assert.equal(wallet.available, 12); // released, unpaid, under $30 = Rolled
    const live = computeLiveTotal({ currentCycle: wallet.onHold, walletAvailables: [wallet.available] });
    assert.equal(live.total, 20);
  });
  test("no double counting after the cycle closes: the $8 joins the $12 as one $20 balance (still under $30), the live part resets", () => {
    const now = new Date();
    const lines = [
      { createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 10), amount: 12 },
      { createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 10), amount: 8 },
    ];
    const wallet = computeWallet(lines, 0, 0);
    assert.equal(wallet.onHold, 0);
    assert.equal(wallet.available, 20);
    assert.equal(computeLiveTotal({ currentCycle: wallet.onHold, walletAvailables: [wallet.available] }).total, 20);
  });
  test("no double counting after paying: a $37 balance paid out leaves 0 available, so only the new live cycle shows", () => {
    const now = new Date();
    const lines = [
      { createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 10), amount: 37 },
      { createdAt: now, amount: 8 },
    ];
    const afterPay = computeWallet(lines, 37, 0);
    assert.equal(afterPay.available, 0);
    assert.equal(computeLiveTotal({ currentCycle: afterPay.onHold, walletAvailables: [afterPay.available] }).total, 8);
    // and queued (pending) money is netted out too, so it never also appears as rolled
    const queued = computeWallet(lines, 0, 37);
    assert.equal(computeLiveTotal({ currentCycle: queued.onHold, walletAvailables: [queued.available] }).total, 8);
  });
  test("history keeps the original Rolled entry unchanged while the live total is combined", () => {
    // Jan $12 closed and Rolled; February is the open (Live) month with $8.
    const months = [month(2026, 0, 12), month(2026, 1, 8)];
    const now = new Date(2026, 1, 10);
    const r = resolveMonthlyRollover(months, now);
    assert.equal(r.get("2026-01")?.rolled, true); // the $12 entry is still listed as Rolled
    assert.equal(r.has("2026-02"), false); // February is Live
    // The live row's rollover-in is the $12, its own amount stays $8.
    assert.equal(rolloverIntoMonth("2026-02", months, now), 12);
    assert.equal(computeLiveTotal({ currentCycle: 8, walletAvailables: [12] }).total, 20);
  });
});

describe("rolloverIntoMonth (statement rollover line)", () => {
  // Jan $12, Feb $10 (rolled), Mar $15 releases all three at 37.
  const months = [month(2026, 0, 12), month(2026, 1, 10), month(2026, 2, 15)];
  test("the month that releases the cycle carries the earlier rolled months: 12 + 10 = 22", () => {
    assert.equal(rolloverIntoMonth("2026-03", months, new Date(2026, 3, 2)), 22);
  });
  test("a month with nothing rolled before it carries 0", () => {
    assert.equal(rolloverIntoMonth("2026-01", months, new Date(2026, 3, 2)), 0);
  });
  test("a month that is itself still Rolled carries the earlier Rolled months", () => {
    assert.equal(rolloverIntoMonth("2026-02", months, new Date(2026, 2, 2)), 12);
  });
  test("the Live month carries every earlier Rolled month, and none once they were released", () => {
    const live = [month(2026, 0, 12), month(2026, 1, 10)];
    assert.equal(rolloverIntoMonth("2026-03", [...live, month(2026, 2, 5)], new Date(2026, 2, 10)), 22);
    assert.equal(rolloverIntoMonth("2026-04", [...months, month(2026, 3, 5)], new Date(2026, 3, 10)), 0);
  });
});
