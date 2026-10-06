import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRowSelectable, unselectableReason, selectableIds, toggleRow, toggleAll, summarizeSelection } from "../lib/payout-selection";
import { ledgerStatusLabel } from "../lib/payout-status";

type R = Parameters<typeof isRowSelectable>[0];
function r(id: string, status: string, total: number, over: Partial<R> = {}): R {
  return {
    id,
    status,
    paid: status === "PAID",
    combinedTotal: total,
    bookSalesEarnings: total,
    referralEarnings: 0,
    commissionEarnings: 0,
    ...over,
  };
}

const sched = r("pending-u1", "SCHEDULED", 45);
const queued = r("req1", "REQUESTED", 50);
const approved = r("req2", "APPROVED", 32);
const rolled = r("pending-u2", "ON_HOLD", 12);
const live = r("live-u3", "LIVE", 8);
const paid = r("paid1", "PAID", 100);
const rejected = r("rej1", "REJECTED", 40);
const all = [sched, queued, approved, rolled, live, paid, rejected];

describe("payout table checkboxes", () => {
  test("every Pending row is selectable (Scheduled, Queued and Approved all read Pending)", () => {
    for (const row of [sched, queued, approved]) {
      assert.equal(ledgerStatusLabel(row.status, row.paid), "Pending");
      assert.equal(isRowSelectable(row), true, row.id);
      assert.equal(unselectableReason(row), null, row.id);
    }
  });

  test("Rolled, Live, Paid and Rejected rows are disabled, each with a reason", () => {
    for (const row of [rolled, live, paid, rejected]) {
      assert.equal(isRowSelectable(row), false, row.id);
      assert.ok((unselectableReason(row) ?? "").length > 0, row.id);
    }
    assert.match(unselectableReason(rolled) ?? "", /Rolled/);
    assert.match(unselectableReason(live) ?? "", /Live/);
  });

  test("selectable ids are never empty when a Pending row exists", () => {
    assert.deepEqual(selectableIds(all), ["pending-u1", "req1", "req2"]);
  });

  test("a queued row whose every component is already paid has nothing to act on and is not selectable", () => {
    assert.equal(isRowSelectable(r("req9", "REQUESTED", 50, { componentIds: ["a"], paidComponentIds: ["a"] })), false);
  });

  test("clicking a row checkbox toggles it on and off", () => {
    let sel = new Set<string>();
    sel = toggleRow(sel, all, "req1");
    assert.deepEqual([...sel], ["req1"]);
    sel = toggleRow(sel, all, "req1");
    assert.equal(sel.size, 0);
  });

  test("a disabled row can never enter the selection, even by id", () => {
    const sel = toggleRow(new Set(), all, "pending-u2");
    assert.equal(sel.size, 0);
    assert.equal(toggleRow(new Set(), all, "no-such-id").size, 0);
  });

  test("select-all selects every selectable row, and a second click clears them", () => {
    let sel = toggleAll(new Set(), all);
    assert.deepEqual([...sel].sort(), ["pending-u1", "req1", "req2"]);
    assert.equal(summarizeSelection(sel, all).allSelected, true);
    sel = toggleAll(sel, all);
    assert.equal(sel.size, 0);
  });

  test("select-all with a partial selection completes it (does not clear it)", () => {
    const sel = toggleAll(new Set(["req1"]), all);
    assert.equal(sel.size, 3);
  });

  test("select-all acts on the filtered view only and keeps selections made outside it", () => {
    const filtered = [queued, rolled];
    const sel = toggleAll(new Set(["pending-u1"]), filtered);
    assert.deepEqual([...sel].sort(), ["pending-u1", "req1"]);
  });

  test("the bulk bar shows the count and the payable-now total of what is ticked", () => {
    const sel = new Set(["pending-u1", "req1"]);
    const s = summarizeSelection(sel, all);
    assert.equal(s.count, 2);
    assert.equal(s.total, 95); // 45 + 50
    assert.deepEqual(s.ids, ["pending-u1", "req1"]);
    assert.equal(s.someSelected, true);
    assert.equal(s.allSelected, false);
  });

  test("a Scheduled row's total is the payable-now part only, never the live month or an under-$30 wallet", () => {
    const merged = r("pending-u4", "SCHEDULED", 45, { bookSalesEarnings: 35, referralEarnings: 10 });
    assert.equal(summarizeSelection(new Set(["pending-u4"]), [merged]).total, 35);
  });
});
