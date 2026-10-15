import test from "node:test";
import assert from "node:assert/strict";
import { findOrphanedActivityIds } from "../lib/notification-cleanup";
import { headlineFormat, headlinePrice } from "../lib/book-visibility";

const alive = {
  saleLineIds: new Set(["s1"]),
  reviewIds: new Set(["r1"]),
  bookIds: new Set(["b1"]),
  bookTitles: new Set(["Kept Book"]),
};

test("activity whose sale, review or book was deleted is orphaned", () => {
  const ids = findOrphanedActivityIds(
    [
      { id: "n1", type: "SALE", title: "Kept Book", relatedRecordId: "s1" },
      { id: "n2", type: "SALE", title: "Kept Book", relatedRecordId: "s-gone" },
      { id: "n3", type: "REVIEW", title: "Kept Book", relatedRecordId: "r-gone" },
      { id: "n4", type: "BOOK_PUBLISHED", title: "Gone Book", relatedRecordId: "b-gone" },
      { id: "n5", type: "BOOK_PUBLISHED", title: "Kept Book", relatedRecordId: "b1" },
    ],
    alive,
  );
  assert.deepEqual(ids, ["n2", "n3", "n4"]);
});

test("older notices without a record id are matched by book title", () => {
  const ids = findOrphanedActivityIds(
    [
      { id: "a", type: "REVIEW", title: "Kept Book", relatedRecordId: null },
      { id: "b", type: "REVIEW", title: "Deleted Book", relatedRecordId: null },
    ],
    alive,
  );
  assert.deepEqual(ids, ["b"]);
});

test("other notification types are never touched", () => {
  assert.deepEqual(findOrphanedActivityIds([{ id: "x", type: "PAYOUT", title: "t", relatedRecordId: "gone" }], alive), []);
});

const base = { hasEbook: false, hasPrint: false, hasAudiobook: false, price: 9, ebookPrice: null, paperbackPrice: null, hardcoverPrice: null, audiobookPrice: null, submissionMetadata: null, files: [] as { kind: string }[] };

test("headline price: eBook, then audiobook, then paperback, then hardcover", () => {
  const all = { ...base, hasEbook: true, hasPrint: true, hasAudiobook: true, ebookPrice: 5, audiobookPrice: 7, paperbackPrice: 12, hardcoverPrice: 20, files: [{ kind: "AUDIOBOOK" }] };
  assert.equal(headlineFormat(all as never), "ebook");
  assert.equal(headlinePrice(all as never), 5);
  assert.equal(headlinePrice({ ...all, hasEbook: false } as never), 7);
  assert.equal(headlinePrice({ ...all, hasEbook: false, hasAudiobook: false } as never), 12);
  assert.equal(headlinePrice({ ...all, hasEbook: false, hasAudiobook: false, paperbackPrice: null } as never), 20);
});
