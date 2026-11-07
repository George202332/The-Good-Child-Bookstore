import { test } from "node:test";
import assert from "node:assert/strict";
import { isbn13Of, isbnProblem } from "../lib/identifiers";
import { editionAffiliateEligible, isAffiliateSaleFor } from "../lib/affiliate-eligibility";
import { audiobookIsLive } from "../lib/book-visibility";
import { visibleCount, hasMore } from "../lib/endless";

test("ISBN-10 converts to ISBN-13 and bad check digits are refused", () => {
  assert.equal(isbn13Of("0-306-40615-2"), "9780306406157");
  assert.equal(isbn13Of("978-0-306-40615-7"), "9780306406157");
  assert.equal(isbn13Of("9780306406158"), "");
  assert.ok(isbnProblem("9780306406158"));
  assert.equal(isbnProblem("9780306406157"), null);
});

test("every published book is available to affiliates, whatever old switches were stored", () => {
  const off = { authorId: "a", title: "T", submissionMetadata: { affiliateEnabled: false, affiliateEligiblePrint: false } };
  for (const f of ["ebook", "audiobook", "paperback", "hardcover"]) assert.equal(editionAffiliateEligible(off, f), true);
  assert.equal(editionAffiliateEligible({ authorId: "a", title: "T", submissionMetadata: null }, "paperback"), true);
});

test("an affiliate link counts for every edition of the same title, and only for that title", () => {
  const linked = { id: "l", authorId: "a", title: "My Book", submissionMetadata: { affiliateEnabled: false } };
  const print = { id: "p", authorId: "a", title: "My Book", submissionMetadata: { affiliateEligiblePrint: false } };
  const other = { id: "o", authorId: "a", title: "Another", submissionMetadata: { affiliateEligiblePrint: true } };
  assert.equal(isAffiliateSaleFor(linked, print, "paperback"), true);
  assert.equal(isAffiliateSaleFor(linked, other, "paperback"), false);
});

test("audiobook has its own live switch; only an explicit false hides it", () => {
  assert.equal(audiobookIsLive(null), true);
  assert.equal(audiobookIsLive({}), true);
  assert.equal(audiobookIsLive({ audiobookLive: true }), true);
  assert.equal(audiobookIsLive({ audiobookLive: false }), false);
});

test("endless tables show 10 rows then 10 more", () => {
  assert.equal(visibleCount(35, 0), 10);
  assert.equal(visibleCount(35, 1), 20);
  assert.equal(visibleCount(35, 3), 35);
  assert.equal(visibleCount(4, 0), 4);
  assert.equal(hasMore(35, 20), true);
  assert.equal(hasMore(35, 35), false);
});
