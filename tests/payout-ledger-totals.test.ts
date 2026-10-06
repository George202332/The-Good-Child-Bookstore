import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { PayoutLedgerRow } from "../actions/payout-ledger";
import { consolidateLedgerRows } from "../lib/payout-ledger-dedupe";
import { computePayoutTotals, pendingDueAmount } from "../lib/payout-ledger-totals";

function row(over: Partial<PayoutLedgerRow> & { id: string; userId: string }): PayoutLedgerRow {
  return {
    accountNumber: "ACC",
    accountHolderName: "Name",
    userName: "Name",
    bank: { bankName: "", accountHolder: "", accountNumber: "", swiftOrRouting: "", country: "" },
    email: "a@example.com",
    role: "AUTHOR",
    paymentMethod: "Bank transfer",
    accountDetails: "—",
    currency: "USD",
    bookSalesEarnings: 0,
    referralEarnings: 0,
    commissionEarnings: 0,
    combinedTotal: 0,
    reportMonthKey: "2026-09",
    status: "REQUESTED",
    paid: false,
    requestedAt: "2026-10-03T10:00:00.000Z",
    resolvedAt: null,
    isAffiliate: false,
    ...over,
  };
}
const author = (id: string, userId: string, amount: number, over: Partial<PayoutLedgerRow> = {}) =>
  row({ id, userId, bookSalesEarnings: amount, combinedTotal: amount, ...over });

describe("Scheduled card (computePayoutTotals.categoryB): everything pending payment by the 15th", () => {
  const rows = [
    author("pending-u1", "u1", 45, { status: "SCHEDULED" }), //            Scheduled            -> 45
    author("pending-u2", "u2", 35, { status: "SCHEDULED" }), //            Scheduled + Live     -> 35 (released part only)
    author("live-u2", "u2", 8, { status: "LIVE", reportMonthKey: "2026-10" }),
    row({ id: "pending-u3", userId: "u3", status: "SCHEDULED", bookSalesEarnings: 35, referralEarnings: 10, combinedTotal: 45 }), // only the wallet at $30+ -> 35
    author("req1", "u4", 50, { status: "REQUESTED" }), //                  Queued               -> 50
    author("pending-u5", "u5", 12, { status: "ON_HOLD" }), //              Rolled               -> not counted
    author("live-u6", "u6", 8, { status: "LIVE", reportMonthKey: "2026-10" }), // Live         -> not counted
    author("paid1", "u7", 100, { status: "PAID", paid: true, resolvedAt: "2026-10-04T10:00:00.000Z" }), // Paid -> not counted
    author("rej1", "u8", 40, { status: "REJECTED" }), //                   Rejected             -> not counted
  ];
  const { rows: merged } = consolidateLedgerRows(rows);

  test("Scheduled 45 + Scheduled-with-live 35 + dual-wallet 35 + Queued 50 = 165; Rolled, Live, Paid, Rejected add nothing", () => {
    const t = computePayoutTotals(merged);
    assert.equal(t.categoryB, 165);
    assert.equal(t.categoryBCount, 4);
    assert.equal(t.categoryBScheduled, 115);
    assert.equal(t.categoryBQueued, 50);
  });

  test("the other cards keep their meaning: Rolled card = 12, This Cycle = live parts 8 + 8", () => {
    const t = computePayoutTotals(merged);
    assert.equal(t.categoryA, 12);
    assert.equal(t.categoryACount, 1);
    assert.equal(t.liveTotal, 16);
    assert.equal(t.paidTotal, 100);
  });

  test("the regression: queued payouts alone used to leave the card at $0, now they count", () => {
    const t = computePayoutTotals([author("req1", "u4", 50, { status: "REQUESTED" }), author("req2", "u5", 31.5, { status: "REQUESTED" })]);
    assert.equal(t.categoryB, 81.5);
    assert.equal(t.categoryBCount, 2);
  });

  test("a partly paid queued row counts only what is still owed", () => {
    const r = author("req1", "u4", 80, { status: "REQUESTED", paidAmount: 30 });
    assert.equal(pendingDueAmount(r), 50);
  });

  test("a row that is already paid contributes nothing even if its status says REQUESTED", () => {
    assert.equal(pendingDueAmount(author("x", "u1", 50, { status: "REQUESTED", paid: true })), 0);
  });

  test("no rows at all: the card is a real zero", () => {
    assert.equal(computePayoutTotals([]).categoryB, 0);
  });
});
