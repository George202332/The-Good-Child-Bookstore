import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPriceFloor, closestTrims, evaluateTrim, minimumRetailPrice, MIN_COMPANY_SHARE, recommendTrim, unsupportedSizeMessage } from "../lib/print-specs";
import { calculateSplits } from "../lib/revenue";

const pages = (w: number, h: number, n = 40) => Array.from({ length: n }, () => ({ widthIn: w, heightIn: h }));

test("price floor: the company keeps at least $3.00 (Paperback) or $2.00 (Hardcover), and one cent less does not", () => {
  for (const format of ["paperback", "hardcover"] as const) {
    for (const cost of [1.97, 5.77, 9.4, 14.2]) {
      const min = minimumRetailPrice(cost, format);
      assert.ok(calculateSplits(min, false, undefined, cost).companyShare >= MIN_COMPANY_SHARE[format]);
      assert.ok(0.3 * (Math.round((min - 0.01) * 100) / 100 - cost) < MIN_COMPANY_SHARE[format]);
    }
  }
});
test("price floor: a balance of $10.00 (paperback) and about $6.67 (hardcover) is what is needed", () => {
  assert.equal(minimumRetailPrice(4, "paperback"), 14);
  assert.equal(minimumRetailPrice(4, "hardcover"), 10.67);
});
test("a price under the floor is refused with the minimum in the message; the old $1 affiliate rule is gone", () => {
  const r = checkPriceFloor(2, 1.97, "paperback");
  assert.equal(r.ok, false);
  assert.match(r.message ?? "", /cannot be published below \$11\.97/);
  assert.equal(checkPriceFloor(11.97, 1.97, "paperback").ok, true);
  assert.equal(checkPriceFloor(8.64, 1.97, "hardcover").ok, true);
  assert.equal(checkPriceFloor(8.63, 1.97, "hardcover").ok, false);
});
test("the best-option check recommends the size read from the file when the chosen one would fail", () => {
  const detected = evaluateTrim({ trimCode: "0550X0850", pages: pages(5.5, 8.5), pageCount: 40, bindingCodes: ["PB"], luluAccepts: true });
  const chosen = evaluateTrim({ trimCode: "0600X0900", pages: pages(5.5, 8.5), pageCount: 40, bindingCodes: ["PB"], luluAccepts: true });
  assert.equal(detected.passes, true);
  assert.equal(chosen.passes, false);
  const rec = recommendTrim(detected, chosen);
  assert.equal(rec.recommendedCode, "0550X0850");
  assert.match(rec.message, /would fail/);
});
test("Lulu refusing the combination fails an otherwise matching size", () => {
  const e = evaluateTrim({ trimCode: "0550X0850", pages: pages(5.5, 8.5), pageCount: 40, bindingCodes: ["PB"], luluAccepts: false });
  assert.equal(e.passes, false);
});
test("an unsupported page size names the nearest sizes", () => {
  assert.equal(closestTrims(5.4, 8.4, 2).length, 2);
  assert.match(unsupportedSizeMessage(7.3, 7.3), /not a size Lulu prints/);
});
