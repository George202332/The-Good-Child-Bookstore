import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  consolidateLedgerRows,
  actionableIds,
  outstandingAmount,
  ledgerPeriodKey,
  type LedgerRowLike,
} from "../lib/payout-ledger-dedupe";

/**
 * The "one row per account per payout period" guarantee for the admin
 * payout ledger (the duplicate otieno29@gmail.com rows). See the module
 * comment in lib/payout-ledger-dedupe.ts for the rules these pin down.
 */

function row(over: Partial<LedgerRowLike> & { id: string }): LedgerRowLike {
  return {
    userId: "u1",
    status: "REQUESTED",
    paid: false,
    requestedAt: "2026-10-03T10:00:00.000Z",
    resolvedAt: null,
    isAffiliate: false,
    reportMonthKey: "2026-09",
    bookSalesEarnings: 0,
    referralEarnings: 0,
    commissionEarnings: 0,
    combinedTotal: 0,
    ...over,
  };
}
const author = (id: string, amount: number, over: Partial<LedgerRowLike> = {}) =>
  row({ id, bookSalesEarnings: amount, combinedTotal: amount, ...over });
const affiliate = (id: string, referral: number, commission: number, over: Partial<LedgerRowLike> = {}) =>
  row({ id, isAffiliate: true, referralEarnings: referral, commissionEarnings: commission, combinedTotal: referral + commission, ...over });
const paid = { status: "PAID", paid: true, resolvedAt: "2026-10-04T10:00:00.000Z" };

describe("identical duplicates collapse to one", () => {
  test("two identical AUTHOR payouts become one row (not summed), keeping both ids, flagged suspicious", () => {
    const { rows, events } = consolidateLedgerRows([author("a", 50), author("b", 50)]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 50);
    assert.equal(rows[0].bookSalesEarnings, 50);
    assert.deepEqual(rows[0].componentIds, ["a", "b"]);
    assert.equal(events.length, 1);
    assert.equal(events[0].reason, "identical");
    assert.equal(events[0].suspicious, true);
  });

  test("a third row no longer blocks merging (2 AUTHOR twins + 1 AFFILIATE = one row)", () => {
    const { rows } = consolidateLedgerRows([author("a", 50), author("b", 50), affiliate("c", 10, 30)]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 90);
    assert.equal(rows[0].referralEarnings, 10);
    assert.equal(rows[0].commissionEarnings, 30);
    assert.deepEqual(rows[0].componentIds, ["a", "b", "c"]);
  });

  test("identical synthetic rows for one user collapse too, with no componentIds", () => {
    const live = { status: "LIVE", reportMonthKey: "2026-10" };
    const { rows } = consolidateLedgerRows([author("live-u1", 12, live), author("live-u1", 12, live)]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 12);
    assert.equal(rows[0].componentIds, undefined);
  });
});

describe("dual-role pairs merge once", () => {
  test("an AUTHOR + AFFILIATE pair from the same cycle is one row with a column each and the summed total", () => {
    const { rows, events } = consolidateLedgerRows([author("a", 50), affiliate("b", 10, 30)]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.bookSalesEarnings, 50);
    assert.equal(r.referralEarnings, 10);
    assert.equal(r.commissionEarnings, 30);
    assert.equal(r.combinedTotal, 90);
    assert.equal(r.isAffiliate, true);
    assert.deepEqual(r.componentIds, ["a", "b"]);
    assert.deepEqual(actionableIds(r), ["a", "b"]);
    assert.equal(events[0].reason, "dual-role");
    assert.equal(events[0].suspicious, false);
  });

  test("equal amounts on the two DIFFERENT types are not twins — both are kept and summed", () => {
    const { rows } = consolidateLedgerRows([author("a", 40), affiliate("b", 0, 40)]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 80);
  });

  test("merging twice is stable (running it on its own output changes nothing)", () => {
    const once = consolidateLedgerRows([author("a", 50), affiliate("b", 10, 30), author("c", 50)]).rows;
    const twice = consolidateLedgerRows(once).rows;
    assert.deepEqual(twice, once);
  });
});

describe("distinct users and periods are untouched", () => {
  test("different users, and one user's different periods, all stay separate and in order", () => {
    const input = [
      author("live-u1", 12, { status: "LIVE", reportMonthKey: "2026-10", requestedAt: "2026-10-06T00:00:00.000Z" }),
      author("pending-u1", 12, { status: "ON_HOLD", reportMonthKey: "2026-09", requestedAt: "2026-10-06T00:00:00.000Z" }),
      author("h1", 50, { userId: "u2" }),
      author("h2", 50, { reportMonthKey: "2026-08", requestedAt: "2026-09-03T10:00:00.000Z" }),
      author("h3", 50, { reportMonthKey: "2026-07", requestedAt: "2026-08-03T10:00:00.000Z" }),
    ];
    const { rows, events } = consolidateLedgerRows(input);
    assert.deepEqual(rows.map((r) => r.id), ["live-u1", "pending-u1", "h1", "h2", "h3"]);
    assert.deepEqual(rows, input);
    assert.equal(events.length, 0);
  });

  test("a live row and a rolled row with the SAME figures are different periods and both stay", () => {
    const { rows } = consolidateLedgerRows([
      author("live-u1", 12, { status: "LIVE", reportMonthKey: "2026-10" }),
      author("pending-u1", 12, { status: "ON_HOLD", reportMonthKey: "2026-09" }),
    ]);
    assert.equal(rows.length, 2);
  });

  test("every row's period key is stable by kind", () => {
    assert.equal(ledgerPeriodKey({ status: "LIVE", reportMonthKey: "2026-10" }), "live:2026-10");
    assert.equal(ledgerPeriodKey({ status: "ON_HOLD", reportMonthKey: "2026-09" }), "unqueued");
    assert.equal(ledgerPeriodKey({ status: "SCHEDULED", reportMonthKey: "2026-09" }), "unqueued");
    assert.equal(ledgerPeriodKey({ status: "REJECTED", reportMonthKey: "2026-09" }), "rejected:2026-09");
    assert.equal(ledgerPeriodKey({ status: "PAID", reportMonthKey: "2026-09" }), "cycle:2026-09");
  });
});

describe("paid vs unpaid within one group (the safe status rule)", () => {
  test("unpaid wins: a paid AUTHOR + a still-queued AFFILIATE reads Queued, never Paid", () => {
    const { rows } = consolidateLedgerRows([author("a", 50, paid), affiliate("b", 10, 30)]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.status, "REQUESTED");
    assert.equal(r.paid, false);
    assert.equal(r.resolvedAt, null);
    assert.equal(r.combinedTotal, 90);
  });

  test("...but the paid part is never hidden: it is listed, counted, and excluded from anything that pays again", () => {
    const { rows } = consolidateLedgerRows([author("a", 50, paid), affiliate("b", 10, 30)]);
    const r = rows[0];
    assert.deepEqual(r.paidComponentIds, ["a"]);
    assert.equal(r.paidAmount, 50);
    assert.deepEqual(actionableIds(r), ["b"]);
    assert.equal(outstandingAmount(r), 40);
  });

  test("a PAID twin of a still-REQUESTED identical payout: one row at the single amount, unpaid status, only the unpaid id actionable", () => {
    const { rows, events } = consolidateLedgerRows([author("a", 50, paid), author("b", 50)]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.combinedTotal, 50); // never 100
    assert.equal(r.status, "REQUESTED");
    assert.equal(r.paidAmount, 50);
    assert.deepEqual(actionableIds(r), ["b"]);
    assert.equal(events[0].suspicious, true);
  });

  test("everything paid stays Paid, with no paid-part bookkeeping and the latest resolved date", () => {
    const { rows } = consolidateLedgerRows([
      author("a", 50, { ...paid, resolvedAt: "2026-10-04T10:00:00.000Z" }),
      affiliate("b", 10, 30, { ...paid, resolvedAt: "2026-10-05T10:00:00.000Z" }),
    ]);
    const r = rows[0];
    assert.equal(r.status, "PAID");
    assert.equal(r.paid, true);
    assert.equal(r.resolvedAt, "2026-10-05T10:00:00.000Z");
    assert.equal(r.paidAmount, undefined);
    assert.equal(r.paidComponentIds, undefined);
  });

  test("synthetic precedence: the payable SCHEDULED state wins over ON_HOLD", () => {
    const { rows } = consolidateLedgerRows([
      author("pending-u1", 20, { status: "ON_HOLD", reportMonthKey: "2026-09" }),
      author("pending-u1", 35, { status: "SCHEDULED", reportMonthKey: "2026-09" }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "SCHEDULED");
  });
});

describe("rejected payouts and the money that rolled back", () => {
  test("a REJECTED row is hidden while an unqueued row carries at least that money (same user)", () => {
    const { rows, events } = consolidateLedgerRows([
      author("pending-u1", 50, { status: "SCHEDULED", reportMonthKey: "2026-09" }),
      author("r1", 50, { status: "REJECTED", resolvedAt: "2026-10-04T10:00:00.000Z" }),
    ]);
    assert.deepEqual(rows.map((r) => r.id), ["pending-u1"]);
    assert.equal(events.some((e) => e.reason === "superseded-rejected"), true);
  });

  test("it stays visible when nothing carries that money, or the carrier is smaller, or it is another user's", () => {
    const rejected = author("r1", 50, { status: "REJECTED", resolvedAt: "2026-10-04T10:00:00.000Z" });
    assert.equal(consolidateLedgerRows([rejected]).rows.length, 1);
    assert.equal(consolidateLedgerRows([author("pending-u1", 20, { status: "ON_HOLD" }), rejected]).rows.length, 2);
    assert.equal(consolidateLedgerRows([author("pending-u2", 80, { userId: "u2", status: "SCHEDULED" }), rejected]).rows.length, 2);
  });

  test("hiding can be switched off", () => {
    const { rows } = consolidateLedgerRows(
      [author("pending-u1", 50, { status: "SCHEDULED" }), author("r1", 50, { status: "REJECTED" })],
      { hideSupersededRejected: false }
    );
    assert.equal(rows.length, 2);
  });

  test("a rejected row never merges with a live payout of the same cycle", () => {
    const { rows } = consolidateLedgerRows([author("a", 50, paid), author("r1", 50, { status: "REJECTED" })]);
    assert.equal(rows.length, 2);
  });
});
