import test from "node:test";
import assert from "node:assert/strict";
import type { Book } from "../lib/data/catalog";
import { FORMAT_OPTIONS, bookMatchesAnyFormat, bookMatchesFormat, formatLabel } from "../lib/shop-formats";
import { filteredSortedBooks, parseShopFilters } from "../lib/shop-filters";

function book(id: string, formatAvailable?: Book["formatAvailable"]): Book {
  return {
    id, title: id, author: "A", motif: "owl", palette: ["#fff", "#000"], category: "picture", genre: "x",
    age: "3-5", price: 10, formats: { ebook: 6, print: 10, paperback: 8, audiobook: 9 }, isbn: "", pubDate: "2026-01-01",
    sizeMB: "1", rating: "4.0", reviews: 0, pages: 24, format: "eBook, Print", blurb: "", featured: false, affiliateEnabled: false,
    formatAvailable,
  } as unknown as Book;
}

const ebookOnly = book("ebook-only", { ebook: true, paperback: false, hardcover: false, audiobook: false });
const paperback = book("paperback", { ebook: false, paperback: true, hardcover: false, audiobook: false });
const hardcover = book("hardcover", { ebook: false, paperback: false, hardcover: true, audiobook: false });
const audio = book("audio", { ebook: false, paperback: false, hardcover: false, audiobook: true });
const all = [ebookOnly, paperback, hardcover, audio];

test("the Format filter always lists all four formats", () => {
  assert.deepEqual(FORMAT_OPTIONS.map((o) => o.label), ["eBook", "Paperback", "Hardcover", "Audiobook"]);
  assert.deepEqual(FORMAT_OPTIONS.map((o) => o.id), ["ebook", "paperback", "hardcover", "audiobook"]);
});

test("each format matches only the books that really offer it", () => {
  assert.equal(bookMatchesFormat(ebookOnly, "ebook"), true);
  assert.equal(bookMatchesFormat(ebookOnly, "paperback"), false);
  assert.equal(bookMatchesFormat(hardcover, "hardcover"), true);
  assert.equal(bookMatchesFormat(audio, "audiobook"), true);
  assert.equal(bookMatchesFormat(audio, "ebook"), false);
});

test("several ticked formats match any of them", () => {
  assert.equal(bookMatchesAnyFormat(paperback, ["ebook", "paperback"]), true);
  assert.equal(bookMatchesAnyFormat(audio, ["ebook", "paperback"]), false);
});

test("the older ?format=print link still means paperback or hardcover", () => {
  assert.equal(bookMatchesFormat(paperback, "print"), true);
  assert.equal(bookMatchesFormat(hardcover, "print"), true);
  assert.equal(bookMatchesFormat(ebookOnly, "print"), false);
});

test("unknown values match nothing; label helper", () => {
  assert.equal(bookMatchesFormat(ebookOnly, "vinyl"), false);
  assert.equal(formatLabel("hardcover"), "Hardcover");
  assert.equal(formatLabel("print"), "Print");
});

test("the shelf list is filtered by the ticked formats", () => {
  const ids = (q: string) => filteredSortedBooks(parseShopFilters(new URLSearchParams(q)), all).map((b) => b.id).sort();
  assert.deepEqual(ids(""), ["audio", "ebook-only", "hardcover", "paperback"]);
  assert.deepEqual(ids("format=ebook"), ["ebook-only"]);
  assert.deepEqual(ids("format=paperback&format=audiobook"), ["audio", "paperback"]);
  assert.deepEqual(ids("format=print"), ["hardcover", "paperback"]);
});
