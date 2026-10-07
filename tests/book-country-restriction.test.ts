import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRestrictedCountries, isBookRestrictedInCountry, restrictionMessage } from "../lib/book-country-restriction";

describe("book country restriction", () => {
  test("parses legacy text", () => {
    assert.deepEqual(parseRestrictedCountries("US, CA, UK"), ["US", "CA", "GB"]);
    assert.deepEqual(parseRestrictedCountries("kenya; Kenya, ke"), ["KE"]);
    assert.deepEqual(parseRestrictedCountries("Atlantis, france"), ["FR"]);
  });
  test("parses arrays and empties", () => {
    assert.deepEqual(parseRestrictedCountries(["us", "GB", "us"]), ["US", "GB"]);
    assert.deepEqual(parseRestrictedCountries(null), []);
    assert.deepEqual(parseRestrictedCountries(""), []);
  });
  test("restricted check", () => {
    assert.equal(isBookRestrictedInCountry(["US"], "us"), true);
    assert.equal(isBookRestrictedInCountry(["US"], "KE"), false);
    assert.equal(isBookRestrictedInCountry(["US"], null), false);
    assert.equal(isBookRestrictedInCountry(null, "US"), false);
    assert.ok(restrictionMessage.length > 0);
  });
});
