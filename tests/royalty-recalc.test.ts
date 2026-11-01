import test from "node:test";
import assert from "node:assert/strict";
import { recalcPrintLine, inferQuantity, sharesChanged } from "../lib/royalty-recalc";

test("organic print line: split is taken after the recorded printing cost", () => {
  const r = recalcPrintLine({ grossAmount: 20, saleType: "ORGANIC", recordedPrintingCost: 5, referralPct: null });
  assert.equal(r.printingCost, 5);
  assert.equal(r.next.companyShare, 4.5);
  assert.equal(r.next.authorShare, 10.5);
  assert.equal(r.next.affiliateShare, 0);
  assert.equal(r.flagged, false);
  assert.equal(r.costSource, "recorded");
});

test("affiliate print line: 30 / 10 / 60 of what is left after the cost", () => {
  const r = recalcPrintLine({ grossAmount: 20, saleType: "AFFILIATE", recordedPrintingCost: 5, referralPct: null, promotionPct: 0.1 });
  assert.equal(r.next.companyShare, 4.5);
  assert.equal(r.next.affiliateShare, 1.5);
  assert.equal(r.next.authorShare, 9);
});

test("old line without a recorded cost uses the specs cost and is flagged", () => {
  const r = recalcPrintLine({ grossAmount: 30, saleType: "ORGANIC", recordedPrintingCost: null, referralPct: null, specsCost: { cost: 10, source: "lulu-specs" } });
  assert.equal(r.printingCost, 10);
  assert.equal(r.flagged, true);
  assert.equal(r.costSource, "lulu-specs");
  assert.equal(r.next.authorShare, 14);
});

test("no cost found at all: cost stays 0 and the line is flagged as none", () => {
  const r = recalcPrintLine({ grossAmount: 10, saleType: "ORGANIC", recordedPrintingCost: null, referralPct: null });
  assert.equal(r.costSource, "none");
  assert.equal(r.next.authorShare, 7);
});

test("referral carve-out comes out of the company share only", () => {
  const r = recalcPrintLine({ grossAmount: 20, saleType: "ORGANIC", recordedPrintingCost: 5, referralPct: 0.1 });
  assert.equal(r.next.authorShare, 10.5);
  assert.equal(r.next.authorReferralShare, 0.45);
  assert.equal(r.next.companyShare, 4.05);
});

test("cost larger than the price leaves nothing to split", () => {
  const r = recalcPrintLine({ grossAmount: 5, saleType: "ORGANIC", recordedPrintingCost: 8, referralPct: null });
  assert.equal(r.next.authorShare, 0);
  assert.equal(r.next.companyShare, 0);
});

test("copies are inferred from the amount paid", () => {
  assert.equal(inferQuantity(39.98, 19.99), 2);
  assert.equal(inferQuantity(19.99, 19.99), 1);
  assert.equal(inferQuantity(10, null), 1);
  assert.equal(inferQuantity(0, 10), 1);
});

test("sharesChanged compares to the cent", () => {
  const a = { companyShare: 1, authorShare: 2, affiliateShare: 0, authorReferralShare: 0 };
  assert.equal(sharesChanged(a, { ...a }), false);
  assert.equal(sharesChanged(a, { ...a, authorShare: 2.01 }), true);
});
