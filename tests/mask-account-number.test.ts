import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { maskAccountNumber } from "../lib/mask-account-number";

describe("maskAccountNumber", () => {
  test("empty and nullish", () => {
    assert.equal(maskAccountNumber(""), "");
    assert.equal(maskAccountNumber(null), "");
    assert.equal(maskAccountNumber(undefined), "");
  });
  test("1 to 4 characters are fully masked", () => {
    assert.equal(maskAccountNumber("1"), "*");
    assert.equal(maskAccountNumber("1234"), "****");
  });
  test("5 and 8 characters", () => {
    assert.equal(maskAccountNumber("12345"), "1**45");
    assert.equal(maskAccountNumber("12345678"), "12****78");
  });
  test("9, 10, 12 and 16 characters mask exactly four", () => {
    assert.equal(maskAccountNumber("123456789"), "123****89");
    assert.equal(maskAccountNumber("1234567890"), "123****890");
    assert.equal(maskAccountNumber("123456789012"), "1234****9012");
    assert.equal(maskAccountNumber("1234567890123456"), "123456****123456");
  });
  test("never reveals the full value, and masks at most four in the middle for 9+", () => {
    for (let n = 1; n <= 20; n++) {
      const v = "9".repeat(n - 1) + "1";
      const m = maskAccountNumber(v);
      assert.notEqual(m, v);
      assert.ok(m.includes("*"));
      if (n >= 9) assert.equal(m.replace(/[^*]/g, "").length, 4);
    }
  });
  test("spaces and dashes are ignored", () => {
    assert.equal(maskAccountNumber("1234 5678 9012"), "1234****9012");
    assert.equal(maskAccountNumber("1234-5678-9012"), "1234****9012");
    assert.equal(maskAccountNumber(" 12 345 "), "1**45");
  });
  test("non-digits and numbers", () => {
    assert.equal(maskAccountNumber("GB29NWBK60161331"), "GB29NW****161331");
    assert.equal(maskAccountNumber(30000001), "30****01");
    assert.equal(maskAccountNumber("ab-cdef"), "a***ef");
  });
});
