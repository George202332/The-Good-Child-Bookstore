import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildRevenueBreakdown, ROLLOVER_SOURCE, ROLLOVER_DESCRIPTION } from "../lib/payout-statement-breakdown";

const base = { organicRevenue: 20, affiliateChannelRevenue: 5, referralCommission: 3.5, promotionCommission: 1.25 };

describe("monthly payout statement: Revenue Breakdown", () => {
  test("with a rollover: it is listed FIRST, counted in the sum and in the total", () => {
    const b = buildRevenueBreakdown({ ...base, rolloverAmount: 12 });
    assert.equal(b.rows[0].source, ROLLOVER_SOURCE);
    assert.equal(b.rows[0].description, ROLLOVER_DESCRIPTION);
    assert.equal(b.rows[0].description, "Balance under $30 carried over from earlier months");
    assert.equal(b.rows[0].amount, 12);
    assert.equal(b.rows.length, 5);
    // 12 + 20 + 5 + 3.50 + 1.25 = 41.75, and the total equals the sum of the rows.
    assert.equal(b.total, 41.75);
    assert.equal(Math.round(b.rows.reduce((s, r) => s + r.amount, 0) * 100) / 100, b.total);
  });

  test("without a rollover the row is omitted and the total is just the four categories", () => {
    for (const rolloverAmount of [undefined, 0]) {
      const b = buildRevenueBreakdown({ ...base, rolloverAmount });
      assert.equal(b.rows.length, 4);
      assert.ok(!b.rows.some((r) => r.source === ROLLOVER_SOURCE));
      assert.equal(b.total, 29.75);
    }
  });

  test("the four regular rows keep their order after the rollover", () => {
    const b = buildRevenueBreakdown({ ...base, rolloverAmount: 12 });
    assert.deepEqual(b.rows.map((r) => r.source), ["Rollover", "Direct sales: organic", "Direct sales: affiliate", "Referral commission", "Promotion commission"]);
  });

  test("the total is exact to the cent despite floating point (0.1 + 0.2)", () => {
    const b = buildRevenueBreakdown({ organicRevenue: 0.1, affiliateChannelRevenue: 0.2, referralCommission: 0, promotionCommission: 0, rolloverAmount: 0.7 });
    assert.equal(b.total, 1);
  });
});
