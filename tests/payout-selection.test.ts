import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRowPayable, skipReason, selectableIds, pruneSelection, toggleRow, toggleAll, summarizeSelection, describeSkipped } from "../lib/payout-selection";
import { ledgerStatusLabel } from "../lib/payout-status";

type R = Parameters<typeof isRowPayable>[0];
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

const emptyActionable = r("pending-e", "SCHEDULED", 45, { componentIds: ["a"], paidComponentIds: ["a"] });

describe("payout table checkboxes", () => {
  test("every Pending row is payable (Scheduled, Queued and Approved all read Pending)", () => {
    for (const row of [sched, queued, approved]) {
      assert.equal(ledgerStatusLabel(row.status, row.paid), "Pending");
      assert.equal(isRowPayable(row), true, row.id);
      assert.equal(skipReason(row), null, row.id);
    }
  });

  test("Rolled, Live, Paid and Rejected rows are not payable, each with a skip reason", () => {
    for (const row of [rolled, live, paid, rejected]) {
      assert.equal(isRowPayable(row), false, row.id);
      assert.ok((skipReason(row) ?? "").length > 0, row.id);
    }
    assert.match(skipReason(rolled) ?? "", /Rolled/);
    assert.match(skipReason(live) ?? "", /Live/);
  });

  test("every row in the list is selectable, payable or not", () => {
    assert.deepEqual(selectableIds(all), all.map((x) => x.id));
  });

  test("ticking a Rolled row works, and unticking it again", () => {
    let sel = toggleRow(new Set(), all, "pending-u2");
    assert.deepEqual([...sel], ["pending-u2"]);
    sel = toggleRow(sel, all, "pending-u2");
    assert.equal(sel.size, 0);
  });

  test("Live, Paid and Rejected rows can be ticked too", () => {
    const sel = ["live-u3", "paid1", "rej1"].reduce((acc, id) => toggleRow(acc, all, id), new Set<string>());
    assert.deepEqual([...sel].sort(), ["live-u3", "paid1", "rej1"]);
  });

  test("a Pending row with no actionable ids is selectable but not payable", () => {
    const rows = [emptyActionable, sched];
    assert.equal(isRowPayable(emptyActionable), false);
    const sel = toggleRow(new Set(), rows, "pending-e");
    assert.deepEqual([...sel], ["pending-e"]);
    const s = summarizeSelection(sel, rows);
    assert.equal(s.count, 1);
    assert.equal(s.payableCount, 0);
    assert.equal(s.skippedCount, 1);
    assert.deepEqual(s.ids, []);
    assert.equal(s.total, 0);
    assert.match(skipReason(emptyActionable) ?? "", /Nothing left to pay/);
  });

  test("ids outside the rows can never be ticked, and are pruned from an existing selection", () => {
    assert.equal(toggleRow(new Set(), all, "no-such-id").size, 0);
    const pruned = pruneSelection(new Set(["req1", "gone"]), all);
    assert.deepEqual([...pruned], ["req1"]);
    const same = new Set(["req1"]);
    assert.equal(pruneSelection(same, all), same);
    assert.equal(summarizeSelection(new Set(["gone"]), all).count, 0);
  });

  test("select-all ticks every row in view, payable or not, and a second click clears them", () => {
    let sel = toggleAll(new Set(), all);
    assert.equal(sel.size, all.length);
    assert.equal(summarizeSelection(sel, all).allSelected, true);
    sel = toggleAll(sel, all);
    assert.equal(sel.size, 0);
  });

  test("select-all with a partial selection completes it (does not clear it)", () => {
    const sel = toggleAll(new Set(["req1"]), all);
    assert.equal(sel.size, all.length);
  });

  test("select-all acts on the filtered view only and keeps selections made outside it", () => {
    const filtered = [queued, rolled];
    const sel = toggleAll(new Set(["pending-u1"]), filtered);
    assert.deepEqual([...sel].sort(), ["pending-u1", "pending-u2", "req1"]);
  });

  test("the select-all box reports the indeterminate state when only some rows are ticked", () => {
    const s = summarizeSelection(new Set(["req1"]), all);
    assert.equal(s.someSelected, true);
    assert.equal(s.allSelected, false);
  });

  test("the bulk summary counts only payable rows for its ids and total", () => {
    const sel = new Set(["pending-u1", "req1", "pending-u2", "live-u3", "paid1", "rej1"]);
    const s = summarizeSelection(sel, all);
    assert.equal(s.count, 6);
    assert.equal(s.payableCount, 2);
    assert.equal(s.skippedCount, 4);
    assert.equal(s.total, 95); // 45 + 50, the Rolled/Live/Paid/Rejected amounts are not included
    assert.deepEqual(s.ids, ["pending-u1", "req1"]);
    assert.deepEqual(s.payableRowIds, ["pending-u1", "req1"]);
    assert.equal(describeSkipped(s.skipped), "1 Rolled, 1 Live, 1 Paid, 1 Rejected");
  });

  test("a selection of only non-payable rows has zero payable rows (the bulk button stays disabled)", () => {
    const s = summarizeSelection(new Set(["pending-u2", "paid1"]), all);
    assert.equal(s.count, 2);
    assert.equal(s.payableCount, 0);
    assert.deepEqual(s.ids, []);
  });

  test("a Scheduled row's total is the payable-now part only, never the live month or an under-$30 wallet", () => {
    const merged = r("pending-u4", "SCHEDULED", 45, { bookSalesEarnings: 35, referralEarnings: 10 });
    assert.equal(summarizeSelection(new Set(["pending-u4"]), [merged]).total, 35);
  });
});
