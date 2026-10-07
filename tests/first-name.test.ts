import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { firstNameOnly } from "../lib/first-name";

describe("firstNameOnly", () => {
  test("takes the first token", () => {
    assert.equal(firstNameOnly("Jane Mary Doe"), "Jane");
    assert.equal(firstNameOnly("Jane  Doe"), "Jane");
    assert.equal(firstNameOnly("Jane\tDoe"), "Jane");
  });
  test("single names", () => {
    assert.equal(firstNameOnly("Madonna"), "Madonna");
  });
  test("leading and trailing spaces", () => {
    assert.equal(firstNameOnly("   Jane Doe  "), "Jane");
    assert.equal(firstNameOnly(" Jane Doe"), "Jane");
  });
  test("empty falls back", () => {
    assert.equal(firstNameOnly(""), "Reader");
    assert.equal(firstNameOnly("   "), "Reader");
    assert.equal(firstNameOnly(null), "Reader");
    assert.equal(firstNameOnly(undefined), "Reader");
    assert.equal(firstNameOnly("", "Author"), "Author");
  });
  test("never contains the surname", () => {
    assert.ok(!firstNameOnly("Jane Doe").includes("Doe"));
  });
});
