import test from "node:test";
import assert from "node:assert/strict";
import { detectTrimFromPageSize, trimCodeToInches, formatInches } from "../lib/trim-size";
import { LULU_CONFIG } from "../lib/lulu-config";
import { coverLayout, toPoints, pickBackColor } from "../lib/lulu-cover";

const T = LULU_CONFIG.trimSizes;

test("trim code to inches", () => {
  assert.deepEqual(trimCodeToInches("0550X0850"), { w: 5.5, h: 8.5 });
  assert.deepEqual(trimCodeToInches("0827X1169"), { w: 8.27, h: 11.69 });
  assert.equal(trimCodeToInches("bad"), null);
});

test("exact page sizes pick the matching trim automatically", () => {
  assert.equal(detectTrimFromPageSize(6, 9, T)?.code, "0600X0900");
  assert.equal(detectTrimFromPageSize(5.5, 8.5, T)?.code, "0550X0850");
  assert.equal(detectTrimFromPageSize(432.0 / 72, 648.2 / 72, T)?.code, "0600X0900");
  assert.equal(detectTrimFromPageSize(595.3 / 72, 841.9 / 72, T)?.code, "0827X1169");
});

test("pages with bleed (+0.125 wide, +0.25 tall) are recognised", () => {
  const r = detectTrimFromPageSize(6.125, 9.25, T);
  assert.equal(r?.code, "0600X0900");
  assert.equal(r?.withBleed, true);
});

test("an unsupported size is not guessed", () => {
  assert.equal(detectTrimFromPageSize(4, 4, T), null);
  assert.equal(detectTrimFromPageSize(NaN, 9, T), null);
  assert.equal(detectTrimFromPageSize(9, 6, T), null);
  assert.equal(formatInches(6.1400001, 9.21), "6.14 x 9.21 in");
});

test("cover layout puts the front panel on the right and spine in the middle", () => {
  // 6x9 paperback, 0.125in bleed, 0.5in spine
  const widthPt = (0.125 * 2 + 6 * 2 + 0.5) * 72;
  const heightPt = (9 + 0.25) * 72;
  const L = coverLayout(widthPt, heightPt, 6, 9)!;
  assert.ok(Math.abs(L.margin - 9) < 0.001);
  assert.ok(Math.abs(L.spine - 36) < 0.001);
  assert.ok(Math.abs(L.frontX - (9 + 432 + 36)) < 0.001);
  assert.equal(coverLayout(100, 100, 6, 9), null);
});

test("units and back colour", () => {
  assert.equal(toPoints(72, "pt"), 72);
  assert.equal(toPoints("1", "in"), 72);
  assert.ok(Math.abs(toPoints(25.4, "mm") - 72) < 0.001);
  const light = pickBackColor({ r: 250, g: 250, b: 250 });
  assert.ok(light.r < 250);
  assert.deepEqual(pickBackColor({ r: 10, g: 20, b: 30 }), { r: 10, g: 20, b: 30 });
});
