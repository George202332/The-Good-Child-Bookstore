import test from "node:test";
import assert from "node:assert/strict";
import { resolveRange, bucketFor, parsePrintJob, summarizeTotals, summarizePerformance, type LuluOrderInput } from "../lib/lulu-report";

test("date ranges: this month, last month and a custom range that includes both end days", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  const t = resolveRange("this-month", undefined, undefined, now);
  assert.equal(t.from.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(t.to.toISOString(), "2026-11-01T00:00:00.000Z");
  const l = resolveRange("last-month", undefined, undefined, now);
  assert.equal(l.from.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(l.to.toISOString(), "2026-10-01T00:00:00.000Z");
  const c = resolveRange("custom", "2026-10-05", "2026-10-07", now);
  assert.equal(c.from.toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(c.to.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(resolveRange("custom", "bad", "2026-10-07", now).preset, "this-month");
  assert.equal(resolveRange("last-month", undefined, undefined, new Date("2026-01-15T00:00:00Z")).from.toISOString(), "2025-12-01T00:00:00.000Z");
});

test("status buckets", () => {
  assert.equal(bucketFor(null, null), "NOT_SENT");
  assert.equal(bucketFor("FAILED", null), "FAILED");
  assert.equal(bucketFor("SUBMITTED", null), "SUBMITTED");
  assert.equal(bucketFor("SUBMITTED", "PRODUCTION_READY"), "SUBMITTED");
  assert.equal(bucketFor("SUBMITTED", "IN_PRODUCTION"), "IN_PRODUCTION");
  assert.equal(bucketFor("SUBMITTED", "SHIPPED"), "SHIPPED");
  assert.equal(bucketFor("SUBMITTED", "REJECTED"), "REJECTED");
  assert.equal(bucketFor("SUBMITTED", "CANCELED"), "REJECTED");
});

test("Lulu's print job is read for status and charged amounts", () => {
  const p = parsePrintJob({
    status: { name: "SHIPPED", changed: "2026-10-10T12:00:00Z" },
    costs: { line_item_costs: [{ total_cost_excl_tax: "3.10" }, { total_cost_excl_tax: "4.40" }], shipping_cost: { total_cost_excl_tax: "5.00" }, fulfillment_cost: { total_cost_excl_tax: "0.75" } },
  });
  assert.equal(p?.status, "SHIPPED");
  assert.equal(p?.production, 7.5);
  assert.equal(p?.shipping, 5);
  assert.equal(p?.fulfillment, 0.75);
  assert.equal(p?.changedAt?.toISOString(), "2026-10-10T12:00:00.000Z");
  assert.equal(parsePrintJob({}), null);
});

const order = (o: Partial<LuluOrderInput>): LuluOrderInput => ({
  orderId: "o", createdAt: new Date("2026-10-01T00:00:00Z"), printJobStatus: "SUBMITTED", luluStatus: null, luluShippedAt: null,
  shippingPaid: 5, luluProduction: null, luluShipping: 5, luluFulfillment: 0.75, lines: [{ paidBooks: 20, printingCost: 6 }], ...o,
});

test("what customers paid vs what Lulu charges, with the difference", () => {
  const t = summarizeTotals([order({}), order({ shippingPaid: 4, luluShipping: 5, luluProduction: 6.5, lines: [{ paidBooks: 15, printingCost: 6 }] })]);
  assert.equal(t.orders, 2);
  assert.equal(t.paidBooks, 35);
  assert.equal(t.paidProduction, 12);
  assert.equal(t.paidShipping, 9);
  assert.equal(t.luluProduction, 12.5); // 6 (saved quote) + 6.5 (Lulu's figure)
  assert.equal(t.luluShipping, 10);
  assert.equal(t.luluFulfillment, 1.5);
  assert.equal(t.productionDifference, -0.5);
  assert.equal(t.shippingDifference, -1);
  assert.equal(t.totalDifference, -1.5);
});

test("performance: counts, flags and the average time to ship", () => {
  const p = summarizePerformance([
    order({ luluStatus: "SHIPPED", luluShippedAt: new Date("2026-10-04T00:00:00Z") }),
    order({ luluStatus: "SHIPPED", luluShippedAt: new Date("2026-10-06T00:00:00Z") }),
    order({ luluStatus: "IN_PRODUCTION" }),
    order({ luluStatus: "REJECTED" }),
    order({ printJobStatus: "FAILED" }),
  ]);
  assert.equal(p.counts.SHIPPED, 2);
  assert.equal(p.counts.IN_PRODUCTION, 1);
  assert.equal(p.flagged, 2);
  assert.equal(p.avgDaysToShip, 4);
});
