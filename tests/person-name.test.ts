import { test } from "node:test";
import assert from "node:assert/strict";
import { capitalizeName, nameWouldChange } from "../lib/person-name";

test("every name part gets a capital, including after a hyphen or apostrophe", () => {
  assert.equal(capitalizeName("anne-marie o'brien"), "Anne-Marie O'Brien");
  assert.equal(capitalizeName("  mary   jane "), "Mary Jane");
  assert.equal(capitalizeName("d’angelo"), "D’Angelo");
  assert.equal(capitalizeName("élodie"), "Élodie");
});
test("letters already capitalised are left alone", () => {
  assert.equal(capitalizeName("McDonald"), "McDonald");
  assert.equal(capitalizeName("DeShawn"), "DeShawn");
});
test("empty and missing values are safe", () => {
  assert.equal(capitalizeName(""), "");
  assert.equal(capitalizeName(undefined), "");
  assert.equal(nameWouldChange("o'brien"), true);
  assert.equal(nameWouldChange("O'Brien"), false);
});
