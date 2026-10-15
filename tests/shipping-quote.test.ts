import test from "node:test";
import assert from "node:assert/strict";
import { parseLuluShippingOptions, estimateShipping, pickShippingQuote, orderTotalWithShipping } from "../lib/shipping-quote";
import { supersededWhere } from "../lib/notification-cleanup";

const NOW = new Date("2026-10-15T00:00:00Z");

test("Lulu shipping options are read, with cost, level and delivery days", () => {
  const q = parseLuluShippingOptions(
    [
      { level: "MAIL", total_cost_incl_tax: "5.40", min_delivery_date: "2026-10-22", max_delivery_date: "2026-10-29" },
      { level: "express", total_cost_excl_tax: "31.00" },
      { level: "SOMETHING_ELSE", total_cost_incl_tax: "1.00" },
      { level: "GROUND" },
      null,
    ],
    NOW,
  );
  assert.deepEqual(q.map((x) => [x.level, x.amount]), [["MAIL", 5.4], ["EXPRESS", 31]]);
  assert.equal(q[0].minDays, 7);
  assert.equal(q[0].maxDays, 14);
  assert.equal(q[0].source, "lulu");
});

test("a wrapped or unusable reply gives no quotes", () => {
  assert.equal(parseLuluShippingOptions({ results: [{ level: "MAIL", total_cost_incl_tax: 4 }] }, NOW).length, 1);
  assert.equal(parseLuluShippingOptions({ detail: "bad" }, NOW).length, 0);
  assert.equal(parseLuluShippingOptions("nope", NOW).length, 0);
});

test("estimate: domestic vs international and extra copies", () => {
  assert.equal(estimateShipping("MAIL", "US", 1).amount, 4.99);
  assert.equal(estimateShipping("MAIL", "KE", 1).amount, 9.99);
  assert.equal(estimateShipping("MAIL", "KE", 3).amount, 12.99);
  assert.equal(estimateShipping("MAIL", "KE", 1).source, "estimate");
});

test("the chosen method uses Lulu's quote when there is one, else the estimate", () => {
  const lulu = parseLuluShippingOptions([{ level: "MAIL", total_cost_incl_tax: "6.25" }], NOW);
  assert.equal(pickShippingQuote("MAIL", lulu, "KE", 1).amount, 6.25);
  assert.equal(pickShippingQuote("EXPRESS", lulu, "KE", 1).source, "estimate");
});

test("order total is books plus postage, to the cent", () => {
  assert.equal(orderTotalWithShipping(19.98, 4.99), 24.97);
  assert.equal(orderTotalWithShipping(0.1, 0.2), 0.3);
});

test("superseded-notification filter targets one record and its status types", () => {
  assert.deepEqual(supersededWhere("b1", ["REVISION"]), { relatedRecordId: "b1", type: { in: ["REVISION"] } });
  const w = supersededWhere("b1", ["REVISION"], ["Suspend proposed", "Withdraw proposed"]) as { OR?: unknown[] };
  assert.equal(w.OR?.length, 2);
});
