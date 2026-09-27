import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bookAuthorDisplayName } from "../lib/book-author-name";

/**
 * Regression coverage for the author-display-name priority order
 * (submission-time name → standing pen name → real account name).
 * This exact bug — skipping straight to the real name instead of
 * following this order — was found live on three separate screens
 * (the public author profile page, the admin book review page, and
 * the affiliate referral-earnings table) in one audit pass. Any
 * future screen that shows a book's author name should call this
 * function rather than reinventing the fallback, and this test is
 * what should catch it if the priority order itself ever regresses.
 */

describe("bookAuthorDisplayName", () => {
  test("prefers the name typed into the Author field at submission time", () => {
    const name = bookAuthorDisplayName({
      submissionMetadata: { authorFirstName: "Jamie", authorLastName: "Rivers" },
      author: { penName: "Standing Pen Name", user: { name: "Real Account Name" } },
    });
    assert.equal(name, "Jamie Rivers");
  });

  test("falls back to the standing pen name when no submission-time override exists", () => {
    const name = bookAuthorDisplayName({
      submissionMetadata: null,
      author: { penName: "Standing Pen Name", user: { name: "Real Account Name" } },
    });
    assert.equal(name, "Standing Pen Name");
  });

  test("falls back to the real account name only as a last resort", () => {
    const name = bookAuthorDisplayName({
      submissionMetadata: null,
      author: { penName: null, user: { name: "Real Account Name" } },
    });
    assert.equal(name, "Real Account Name");
  });

  test("a submissionMetadata object with no author name fields falls through, not blank", () => {
    const name = bookAuthorDisplayName({
      submissionMetadata: { edition: "2nd" },
      author: { penName: "Standing Pen Name", user: { name: "Real Account Name" } },
    });
    assert.equal(name, "Standing Pen Name");
  });

  test("a first name alone is used, trimmed of the missing last name", () => {
    const name = bookAuthorDisplayName({
      submissionMetadata: { authorFirstName: "Jamie" },
      author: { penName: "Standing Pen Name", user: { name: "Real Account Name" } },
    });
    assert.equal(name, "Jamie");
  });
});
