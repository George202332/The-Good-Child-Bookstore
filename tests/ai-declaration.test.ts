import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_NONE, AI_USED, aiChoiceOf, aiTextFor, firstAiDeclaration, isAiDeclaration, isLegacyAiText } from "../lib/ai-declaration";

test("the two statements map to a single choice", () => {
  assert.equal(aiChoiceOf(AI_USED), "ai");
  assert.equal(aiChoiceOf(AI_NONE), "none");
  assert.equal(aiChoiceOf(""), "");
  assert.equal(aiTextFor("ai"), AI_USED);
  assert.equal(aiTextFor(""), "");
});
test("older written text is legacy, not a declaration", () => {
  assert.equal(isAiDeclaration("I used a little AI"), false);
  assert.equal(isLegacyAiText("I used a little AI"), true);
  assert.equal(isLegacyAiText(AI_NONE), false);
  assert.equal(isLegacyAiText(""), false);
});
test("firstAiDeclaration picks the first real statement", () => {
  assert.equal(firstAiDeclaration("old text", undefined, AI_NONE, AI_USED), AI_NONE);
  assert.equal(firstAiDeclaration("old text"), "");
});
