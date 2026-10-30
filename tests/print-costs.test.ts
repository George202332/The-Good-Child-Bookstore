import test from "node:test";
import assert from "node:assert/strict";
import { parseLuluCostCalculation, netAfterPrintingCost, sumCosts } from "../lib/print-costs";
import { calculateSplits, applyAuthorReferralCarveOut } from "../lib/revenue";

const reply = {
  currency: "USD",
  line_item_costs: [{ quantity: 2, total_cost_excl_tax: "7.50", total_cost_incl_tax: "7.50" }, { quantity: 1, total_cost_excl_tax: "3.20" }],
  shipping_cost: { total_cost_excl_tax: "4.99", total_cost_incl_tax: "4.99" },
  fulfillment_cost: { total_cost_excl_tax: "0.75" },
};

test("Lulu's cost reply gives production cost per line, shipping and fulfilment separately", () => {
  const q = parseLuluCostCalculation(reply, 2);
  assert.deepEqual(q?.lineCosts, [7.5, 3.2]);
  assert.equal(q?.shippingCost, 4.99);
  assert.equal(q?.fulfillmentCost, 0.75);
});

test("a reply that cannot be read is never used", () => {
  assert.equal(parseLuluCostCalculation(reply, 3), null);
  assert.equal(parseLuluCostCalculation({ line_item_costs: [{ total_cost_excl_tax: "abc" }] }, 1), null);
  assert.equal(parseLuluCostCalculation(null, 1), null);
});

test("net is the price minus printing cost, never below zero", () => {
  assert.equal(netAfterPrintingCost(20, 6.5), 13.5);
  assert.equal(netAfterPrintingCost(5, 6.5), 0);
  assert.equal(sumCosts([1.1, 2.2]), 3.3);
});

test("an organic print sale splits 70/30 of the price AFTER printing cost", () => {
  const s = calculateSplits(20, false, undefined, 6);
  assert.equal(s.net, 14);
  assert.equal(s.authorShare, 9.8);
  assert.equal(s.companyShare, 4.2);
  assert.equal(s.printingCost, 6);
  assert.equal(s.authorShare + s.companyShare + s.affiliateShare + s.authorReferralShare, 14);
});

test("an affiliate print sale: author 60%, company 30%, affiliate 10% of the amount after printing cost", () => {
  const s = calculateSplits(20, true, 0.1, 6);
  assert.equal(s.affiliateShare, 1.4);
  assert.equal(s.companyShare, 4.2);
  assert.equal(s.authorShare, 8.4);
});

test("referral commission is a percentage of the company's (reduced) share", () => {
  const s = applyAuthorReferralCarveOut(calculateSplits(20, false, undefined, 6), 0.05);
  assert.equal(s.authorReferralShare, 0.21);
  assert.equal(s.companyShare, 3.99);
});

test("a price below printing cost gives nobody a negative share", () => {
  const s = calculateSplits(5, false, undefined, 6.5);
  assert.equal(s.net, 0);
  assert.equal(s.authorShare, 0);
  assert.equal(s.companyShare, 0);
});

test("eBooks and audiobooks are unchanged (no printing cost)", () => {
  const s = calculateSplits(10, false);
  assert.equal(s.authorShare, 7);
  assert.equal(s.companyShare, 3);
  assert.equal(s.printingCost, 0);
});

import { computePrintPricing } from "../lib/lulu-pricing";

test("Pricing preview matches the real split for the example in the brief ($15.99, $1.97 cost)", () => {
  const p = computePrintPricing(15.99, "PB", 32);
  assert.equal(p.printingCost, 1.97);
  assert.equal(p.balance, 14.02);
  assert.equal(p.companyRevenue, 4.21);
  assert.equal(p.estimatedRoyalty, 9.81);
  assert.equal(p.royaltyViaAffiliate, 8.41);
  assert.equal(p.affiliateCommission, 1.4);
});
