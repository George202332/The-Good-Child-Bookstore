import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyAuthorReferralCarveOut, calculateSplits } from "../lib/revenue";

/**
 * The revenue engine is format-agnostic: it only ever sees the gross amount
 * of a sale line (createPendingOrder passes `unitPrice * qty`, whatever the
 * format). These tests pin that an audiobook line of a given amount splits
 * exactly like an eBook line of the same amount, so audiobook sales never
 * need special-casing in royalties, affiliate commission or the wallet.
 */
describe("audiobook vs eBook revenue split", () => {
  const amounts = [4.99, 7.5, 9.99, 12.34, 19.95];

  test("organic split is identical for the same gross", () => {
    for (const gross of amounts) {
      const audiobook = calculateSplits(gross, false);
      const ebook = calculateSplits(gross, false);
      assert.deepEqual(audiobook, ebook);
      assert.equal(Math.round((audiobook.companyShare + audiobook.authorShare) * 100), Math.round(audiobook.gross * 100));
    }
  });

  test("affiliate split (author / affiliate / company) is identical for the same gross", () => {
    for (const gross of amounts) {
      const audiobook = calculateSplits(gross, true, 0.1);
      const ebook = calculateSplits(gross, true, 0.1);
      assert.deepEqual(audiobook, ebook);
      assert.equal(audiobook.saleType, "AFFILIATE");
      assert.ok(audiobook.affiliateShare > 0);
    }
  });

  test("author-referral carve-out is identical for the same gross", () => {
    for (const gross of amounts) {
      const a = applyAuthorReferralCarveOut(calculateSplits(gross, true, 0.1), 0.05);
      const e = applyAuthorReferralCarveOut(calculateSplits(gross, true, 0.1), 0.05);
      assert.deepEqual(a, e);
    }
  });

  test("the money code has no per-format branches at all", () => {
    for (const file of ["lib/revenue.ts", "lib/wallet.ts", "lib/compute-wallet-for-user.ts", "lib/earnings-lines-core.ts"]) {
      const src = readFileSync(join(__dirname, "..", file), "utf8");
      assert.doesNotMatch(src, /audiobook|ebook|paperback|hardcover/i, `${file} must stay format-agnostic`);
    }
  });

  test("known figures: a $10.00 audiobook sale is 70/30 organic, 60/10/30 via affiliate", () => {
    const organic = calculateSplits(10, false);
    assert.equal(organic.authorShare, 7);
    assert.equal(organic.companyShare, 3);
    const aff = calculateSplits(10, true, 0.1);
    assert.equal(aff.authorShare, 6);
    assert.equal(aff.affiliateShare, 1);
    assert.equal(aff.companyShare, 3);
  });
});
