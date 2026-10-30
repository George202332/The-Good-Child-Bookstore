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

test("affiliate eligibility is per edition", () => {
  const meta = { affiliateEnabled: true, affiliateEligiblePrint: false };
  const book = { authorId: "a", title: "T", submissionMetadata: meta };
  assert.equal(editionAffiliateEligible(book, "ebook"), true);
  assert.equal(editionAffiliateEligible(book, "paperback"), false);
  assert.equal(editionAffiliateEligible({ ...book, submissionMetadata: { affiliateEnabled: true } }, "hardcover"), true);
});

test("an affiliate link counts only for eligible editions of the same title", () => {
  const linked = { id: "l", authorId: "a", title: "My Book", submissionMetadata: { affiliateEnabled: true } };
  const print = { id: "p", authorId: "a", title: "My Book", submissionMetadata: { affiliateEligiblePrint: true } };
  const printOff = { ...print, submissionMetadata: { affiliateEligiblePrint: false } };
  const other = { id: "o", authorId: "a", title: "Another", submissionMetadata: { affiliateEligiblePrint: true } };
  assert.equal(isAffiliateSaleFor(linked, print, "paperback"), true);
  assert.equal(isAffiliateSaleFor(linked, printOff, "paperback"), false);
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
