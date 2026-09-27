import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { linesForView, sumLines, type EarningsBreakdown } from "../lib/earnings-lines-core";

/**
 * Regression coverage for the pure helpers re-exported from
 * lib/earnings-lines.ts (and defined in lib/earnings-lines-core.ts) —
 * the shared fetch this session consolidated out of five previously
 * independent copies (actions/wallet.ts, lib/compute-wallet-for-user.ts,
 * lib/payout-monthly.ts, actions/payout-ledger.ts). fetchEarningsBreakdown
 * itself needs a live database, so it isn't unit-tested here, but the
 * categorization logic every caller relies on (which lines count
 * toward which "view") is fully covered. Importing from the -core
 * module directly (rather than lib/earnings-lines.ts) avoids pulling
 * in lib/prisma.ts, which constructs a real PrismaClient at import
 * time and would crash here in any environment without a generated
 * Prisma client.
 */

function line(amount: number) {
  return { createdAt: new Date(), amount };
}

describe("sumLines", () => {
  test("sums an empty array to zero", () => {
    assert.equal(sumLines([]), 0);
  });

  test("sums multiple lines", () => {
    assert.equal(sumLines([line(10), line(20), line(30)]), 60);
  });
});

describe("linesForView", () => {
  const breakdown: EarningsBreakdown = {
    organic: [line(100)],
    referral: [line(5)],
    commission: [line(7)],
  };

  test("the author view is ONLY organic book-sales earnings", () => {
    const lines = linesForView(breakdown, "author");
    assert.equal(sumLines(lines), 100);
  });

  test("the affiliate view combines commission AND referral earnings", () => {
    const lines = linesForView(breakdown, "affiliate");
    assert.equal(sumLines(lines), 12);
  });

  test("the affiliate view never includes organic (author royalty) earnings", () => {
    const lines = linesForView(breakdown, "affiliate");
    assert.equal(lines.length, 2, "should be exactly the commission + referral lines, nothing else");
  });
});
