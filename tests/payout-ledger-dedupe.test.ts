import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  consolidateLedgerRows,
  actionableIds,
  outstandingAmount,
  ledgerPeriodKey,
  ledgerPeriodLabel,
  payableNowAmount,
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
  test("different users, and one user's different real payout periods, stay separate and in order; the open balance is one row", () => {
    const input = [
      author("live-u1", 12, { status: "LIVE", reportMonthKey: "2026-10", requestedAt: "2026-10-06T00:00:00.000Z" }),
      author("h1", 50, { userId: "u2" }),
      author("h2", 50, { reportMonthKey: "2026-08", requestedAt: "2026-09-03T10:00:00.000Z" }),
      author("h3", 50, { reportMonthKey: "2026-07", requestedAt: "2026-08-03T10:00:00.000Z" }),
    ];
    const { rows, events } = consolidateLedgerRows(input);
    assert.deepEqual(rows.map((r) => r.id), ["live-u1", "h1", "h2", "h3"]);
    assert.deepEqual(rows, input);
    assert.equal(events.length, 0);
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

// ---------------------------------------------------------------------------
// Round 21 Amendment 1: rolled + on-hold = ONE row
// ---------------------------------------------------------------------------

const live = (amount: number, over: Partial<LedgerRowLike> = {}) =>
  author("live-u1", amount, { status: "LIVE", reportMonthKey: "2026-10", ...over });
const rolled = (amount: number, over: Partial<LedgerRowLike> = {}) =>
  author("pending-u1", amount, { status: "ON_HOLD", reportMonthKey: "2026-09", ...over });
const scheduled = (amount: number, over: Partial<LedgerRowLike> = {}) =>
  author("pending-u1", amount, { status: "SCHEDULED", reportMonthKey: "2026-09", ...over });

describe("rolled + on hold merge into one row", () => {
  test("a rolled $12 and a live $8 for the same account are ONE row totalling $20", () => {
    const { rows, events } = consolidateLedgerRows([live(8), rolled(12)]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.combinedTotal, 20);
    assert.equal(r.bookSalesEarnings, 20);
    assert.equal(r.status, "LIVE"); // current month still in progress: stays On Hold
    assert.equal(r.id, "pending-u1"); // the id the pay actions understand
    assert.equal(r.unreleasedAmount, 8);
    assert.equal(r.periodLabel, "Oct 2026 and earlier");
    assert.equal(ledgerPeriodLabel(r), "Oct 2026 and earlier");
    assert.equal(events.length, 1);
    assert.equal(events[0].reason, "open-balance");
    assert.equal(events[0].suspicious, false); // a normal state, not an alert
  });

  test("order of the inputs does not matter", () => {
    const a = consolidateLedgerRows([live(8), rolled(12)]).rows;
    const b = consolidateLedgerRows([rolled(12), live(8)]).rows;
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.equal(b[0].combinedTotal, 20);
    assert.equal(b[0].id, a[0].id);
  });

  test("the component breakdown is summed per column (royalties / referral / commission)", () => {
    const { rows } = consolidateLedgerRows([
      live(8, { referralEarnings: 2, commissionEarnings: 1, combinedTotal: 11, isAffiliate: true }),
      rolled(12, { referralEarnings: 3, commissionEarnings: 4, combinedTotal: 19, isAffiliate: true }),
    ]);
    const r = rows[0];
    assert.equal(r.bookSalesEarnings, 20);
    assert.equal(r.referralEarnings, 5);
    assert.equal(r.commissionEarnings, 5);
    assert.equal(r.combinedTotal, 30);
    assert.equal(r.isAffiliate, true);
  });

  test("a rolled $12 and a live $12 with IDENTICAL figures are not twins: they add up to $24", () => {
    const { rows } = consolidateLedgerRows([live(12), rolled(12)]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 24);
  });

  test("a payable (SCHEDULED) released balance plus a live month stays Scheduled, and only the released part is payable now", () => {
    const { rows } = consolidateLedgerRows([live(8), scheduled(37)]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.status, "SCHEDULED");
    assert.equal(r.combinedTotal, 45);
    assert.equal(r.unreleasedAmount, 8);
    assert.equal(r.payableAmount, 37); // never the live $8
    assert.equal(payableNowAmount(r), 37);
    assert.deepEqual(actionableIds(r), ["pending-u1"]); // pays exactly once via payScheduledBalance
  });

  test("released-only (no live month): stays Rolled/ON_HOLD, untouched", () => {
    const input = [rolled(12)];
    const { rows, events } = consolidateLedgerRows(input);
    assert.deepEqual(rows, input);
    assert.equal(events.length, 0);
  });

  test("works across the month boundary: the closed month moved into the released balance, a new live month starts", () => {
    // 1 Nov: October is now released (rolled $20 total), November just began ($3 live).
    const { rows } = consolidateLedgerRows([
      live(3, { reportMonthKey: "2026-11" }),
      rolled(20, { reportMonthKey: "2026-10" }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].combinedTotal, 23);
    assert.equal(rows[0].periodLabel, "Nov 2026 and earlier");
  });

  test("another user's rows are never pulled in", () => {
    const { rows } = consolidateLedgerRows([
      live(8),
      rolled(12),
      author("live-u2", 5, { userId: "u2", status: "LIVE", reportMonthKey: "2026-10" }),
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => [r.userId, r.combinedTotal]), [["u1", 20], ["u2", 5]]);
  });
});

describe("rolled + rolled", () => {
  test("two rolled rows for one account with different amounts are one row (summed); identical ones are twins (not summed)", () => {
    const sum = consolidateLedgerRows([rolled(12), rolled(7)]);
    assert.equal(sum.rows.length, 1);
    assert.equal(sum.rows[0].combinedTotal, 19);
    assert.equal(sum.rows[0].status, "ON_HOLD");
    assert.equal(sum.events[0].suspicious, true); // two released balances is a data problem

    const twin = consolidateLedgerRows([rolled(12), rolled(12)]);
    assert.equal(twin.rows.length, 1);
    assert.equal(twin.rows[0].combinedTotal, 12);
  });
});

describe("the merge never double counts", () => {
  test("total equals the sum of the distinct components, in every ordering", () => {
    const parts = [live(8), rolled(12)];
    for (const input of [parts, [...parts].reverse()]) {
      const { rows } = consolidateLedgerRows(input);
      assert.equal(rows.reduce((s, r) => s + r.combinedTotal, 0), 20);
    }
  });

  test("a rolled-back REJECTED payout is hidden only against the RELEASED part, never the live month", () => {
    // Rejected $15. Released carried $12 + live $8 = $20 merged, but only $12 is released, so $15 is not carried: it stays visible.
    const stays = consolidateLedgerRows([live(8), rolled(12), author("r1", 15, { status: "REJECTED", resolvedAt: "2026-10-04T10:00:00.000Z" })]);
    assert.equal(stays.rows.length, 2);
    // Released carried $15 covers a $15 rejection: hidden, and the merged total is not inflated by it.
    const hidden = consolidateLedgerRows([live(8), rolled(15), author("r1", 15, { status: "REJECTED", resolvedAt: "2026-10-04T10:00:00.000Z" })]);
    assert.equal(hidden.rows.length, 1);
    assert.equal(hidden.rows[0].combinedTotal, 23);
  });

  test("real payouts (queued, legacy PROCESSING, paid) stay separate facts and are never added into the open balance", () => {
    const { rows } = consolidateLedgerRows([
      live(8),
      rolled(12),
      author("q1", 50, { reportMonthKey: "2026-08" }),
      author("p1", 40, { status: "PROCESSING", reportMonthKey: "2026-07" }),
      author("d1", 31, { ...paid, reportMonthKey: "2026-06" }),
    ]);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].combinedTotal, 20);
    assert.deepEqual(rows.slice(1).map((r) => r.combinedTotal), [50, 40, 31]);
  });

  test("a mixed paid/unpaid real row keeps its paid component excluded from paying again", () => {
    const { rows } = consolidateLedgerRows([author("a", 50, paid), affiliate("b", 10, 30), live(8), rolled(12)]);
    const real = rows.find((r) => r.componentIds)!;
    assert.deepEqual(actionableIds(real), ["b"]);
    const open = rows.find((r) => !r.componentIds)!;
    assert.deepEqual(actionableIds(open), ["pending-u1"]);
  });
});

describe("idempotent", () => {
  test("consolidating the merged output again changes nothing", () => {
    const input = [live(8), scheduled(37), author("a", 50, paid), affiliate("b", 10, 30), author("r1", 5, { status: "REJECTED" })];
    const once = consolidateLedgerRows(input).rows;
    const twice = consolidateLedgerRows(once).rows;
    assert.deepEqual(twice, once);
    const thrice = consolidateLedgerRows(twice).rows;
    assert.deepEqual(thrice, once);
  });

  test("the rolled + on hold merge is stable too", () => {
    const once = consolidateLedgerRows([live(8), rolled(12)]).rows;
    const twice = consolidateLedgerRows(once);
    assert.deepEqual(twice.rows, once);
    assert.equal(twice.events.length, 0);
  });
});

describe("payableNowAmount", () => {
  test("a SCHEDULED row pays only each wallet that individually clears $30", () => {
    const r = row({ id: "pending-u1", status: "SCHEDULED", bookSalesEarnings: 35, referralEarnings: 6, commissionEarnings: 4, combinedTotal: 45 });
    assert.equal(payableNowAmount(r), 35);
    const both = row({ id: "pending-u1", status: "SCHEDULED", bookSalesEarnings: 35, referralEarnings: 20, commissionEarnings: 15, combinedTotal: 70 });
    assert.equal(payableNowAmount(both), 70);
  });
  test("REQUESTED pays what is outstanding; Rolled/Live/Paid/Rejected pay nothing", () => {
    assert.equal(payableNowAmount(author("a", 50)), 50);
    assert.equal(payableNowAmount(author("a", 50, paid)), 0);
    assert.equal(payableNowAmount(rolled(12)), 0);
    assert.equal(payableNowAmount(live(12)), 0);
    assert.equal(payableNowAmount(author("a", 50, { status: "REJECTED" })), 0);
  });
});

describe("extra per-account fields survive consolidation", () => {
  test("joinedAt and role (detail pop-up fields) are kept on a merged row", () => {
    const extra = { joinedAt: "2025-01-02T00:00:00.000Z", role: "AUTHOR" };
    const { rows } = consolidateLedgerRows([
      { ...author("a", 50), ...extra },
      { ...affiliate("b", 10, 5), ...extra },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].joinedAt, extra.joinedAt);
    assert.equal(rows[0].role, "AUTHOR");
  });
});
