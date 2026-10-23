import test from "node:test";
import assert from "node:assert/strict";
import { parseAgeGroups, serializeAgeGroups, isConsecutiveAgeSelection, ageGroupProblem, mergedAgeRange } from "../lib/age-groups";

test("stored text is read back into groups, old single values included", () => {
  assert.deepEqual(parseAgeGroups("3-5 years"), ["3-5"]);
  assert.deepEqual(parseAgeGroups("6-8 years, 9-12 years"), ["6-8", "9-12"]);
  assert.deepEqual(parseAgeGroups("9-12 years"), ["9-12"]);
  assert.deepEqual(parseAgeGroups("12-15 years"), ["12-15"]);
  assert.deepEqual(parseAgeGroups(""), []);
});

test("serialising keeps age order", () => {
  assert.equal(serializeAgeGroups(["9-12", "6-8"]), "6-8 years, 9-12 years");
});

test("only neighbouring groups are accepted", () => {
  assert.equal(isConsecutiveAgeSelection(["6-8", "9-12"]), true);
  assert.equal(isConsecutiveAgeSelection(["3-5", "6-8", "9-12"]), true);
  assert.equal(isConsecutiveAgeSelection(["3-5", "9-12"]), false);
  assert.equal(isConsecutiveAgeSelection(["0-2", "6-8"]), false);
  assert.equal(isConsecutiveAgeSelection(["3-5"]), true);
});

test("problems are explained, valid values have none", () => {
  assert.equal(ageGroupProblem("6-8 years, 9-12 years"), null);
  assert.match(ageGroupProblem("3-5 years, 9-12 years") ?? "", /next to each other/);
  assert.match(ageGroupProblem("") ?? "", /at least one/);
});

test("the merged range runs from the first start to the last end", () => {
  assert.equal(mergedAgeRange(["6-8", "9-12"]), "6-12");
  assert.equal(mergedAgeRange(["9-12", "12-15"]), "9-15");
  assert.equal(mergedAgeRange(["3-5"]), "3-5");
  assert.equal(mergedAgeRange([]), "");
});
