import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPriceFloor, closestTrims, evaluateTrim, minimumRetailPrice, MIN_AUTHOR_ROYALTY, recommendTrim, unsupportedSizeMessage } from "../lib/print-specs";
import { calculateSplits } from "../lib/revenue";

const pages = (w: number, h: number, n = 40) => Array.from({ length: n }, () => ({ widthIn: w, heightIn: h }));

test("price floor leaves the affiliate-sale royalty at the minimum, and one cent less does not", () => {
  for (const cost of [1.97, 5.77, 9.4]) {
    const min = minimumRetailPrice(cost);
    assert.ok(calculateSplits(min, true, undefined, cost).authorShare >= MIN_AUTHOR_ROYALTY);
    assert.ok(calculateSplits(min - 0.01, true, undefined, cost).authorShare < MIN_AUTHOR_ROYALTY);
  }
});
test("a price under the floor is refused with the numbers in the message", () => {
  const r = checkPriceFloor(2, 1.97, "Paperback");
  assert.equal(r.ok, false);
  assert.match(r.message ?? "", /\$1\.97/);
  assert.equal(checkPriceFloor(15.99, 1.97, "Paperback").ok, true);
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
