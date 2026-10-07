import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_OPTIONS, DEFAULT_DIMENSION, nearestDimensionOption, isKnownDimension } from "../lib/book-dimensions";

describe("book dimensions", () => {
  test("default is an option", () => {
    assert.ok(DIMENSION_OPTIONS.includes(DEFAULT_DIMENSION));
    assert.ok(isKnownDimension("6 x 9 in"));
    assert.ok(!isKnownDimension("6 x 9.5 in"));
  });
  test("nearest within 0.1in", () => {
    assert.equal(nearestDimensionOption("6.02 x 8.95 in"), "6 x 9 in");
    assert.equal(nearestDimensionOption("8.27 x 11.69 in"), "8.27 x 11.69 in");
    assert.equal(nearestDimensionOption("6.5 x 9 in"), undefined);
    assert.equal(nearestDimensionOption(undefined), undefined);
    assert.equal(nearestDimensionOption("garbage"), undefined);
  });
});
