import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fullAccountName } from "../lib/full-name";

describe("fullAccountName", () => {
  it("keeps every part of the name", () => {
    assert.equal(fullAccountName("Jane Mary Doe"), "Jane Mary Doe");
  });
  it("tidies extra spaces", () => {
    assert.equal(fullAccountName("  Jane   Doe "), "Jane Doe");
  });
  it("falls back when empty or missing", () => {
    assert.equal(fullAccountName(""), "Account");
    assert.equal(fullAccountName(null), "Account");
    assert.equal(fullAccountName("   ", "Author"), "Author");
  });
  it("referral views use the full name and still mask the account ID", () => {
    const rev = readFileSync("app/account/revenue/page.tsx", "utf8");
    assert.ok(rev.includes("fullAccountName(l.book.author.user.name)"));
    assert.ok(rev.includes("maskAccountNumber("));
    const ref = readFileSync("actions/referred-authors.ts", "utf8");
    assert.ok(ref.includes("fullAccountName(a.user.name)") && ref.includes("maskAccountNumber("));
  });
});
