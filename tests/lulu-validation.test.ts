import test from "node:test";
import assert from "node:assert/strict";
import { explainLuluError, parseLuluValidation } from "../lib/lulu-validation";

test("interior statuses map to running / passed / failed", () => {
  assert.equal(parseLuluValidation({ status: "VALIDATING" }, "interior").state, "running");
  assert.equal(parseLuluValidation({ status: "NORMALIZING" }, "interior").state, "running");
  assert.equal(parseLuluValidation({ status: "NORMALIZED" }, "interior").state, "passed");
  assert.equal(parseLuluValidation({ status: "VALIDATED" }, "interior").state, "passed");
  const bad = parseLuluValidation({ status: "ERROR", errors: ["Please review your PDF and make sure all fonts are embedded"] }, "interior");
  assert.equal(bad.state, "failed");
  assert.equal(bad.errors.length, 1);
});

test("a cover is only finished at NORMALIZED (VALIDATED is not enough)", () => {
  assert.equal(parseLuluValidation({ status: "VALIDATED" }, "cover").state, "running");
  assert.equal(parseLuluValidation({ status: "NORMALIZED" }, "cover").state, "passed");
});

test("errors in several shapes are flattened to strings", () => {
  const r = parseLuluValidation({ status: "ERROR", errors: [{ message: "a" }, "b", { detail: "c" }] }, "cover");
  assert.deepEqual(r.errors, ["a", "b", "c"]);
});

test("known Lulu messages become plain-language explanations; unknown ones are quoted", () => {
  assert.match(explainLuluError("Please review your PDF and make sure all fonts are embedded").fix, /fonts embedded/);
  assert.match(explainLuluError("printable_normalization → interior → Book Size mismatch").message, /page size/);
  assert.match(explainLuluError("something odd").message, /something odd/);
});
