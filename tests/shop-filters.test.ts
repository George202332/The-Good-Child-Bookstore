import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { filteredSortedBooks, parseShopFilters } from "../lib/shop-filters";
import type { Book } from "../lib/data/catalog";

function mk(id: string, over: Partial<Book>): Book {
  return {
    id, title: id, author: "A", motif: "sun", palette: ["#000", "#111"], category: "picture", genre: "Picture Books",
    age: "3-5", price: 10, formats: { ebook: 6, print: 10, paperback: 8, audiobook: 9 }, isbn: "", pubDate: "2026-01-01",
    sizeMB: "1", rating: "4.0", reviews: 0, pages: 24, format: "eBook", blurb: "", featured: false, affiliateEnabled: false,
    ...over,
  };
}

const books = [
  mk("a", { series: "Adventure Series", subcategory: "Fantasy" }),
  mk("b", { series: "Adventure Series", subcategory: "Pirates and Sailors", category: "bedtime", genre: "Bedtime Stories" }),
  mk("c", { series: "Education Series", subcategory: "Fantasy" }),
  mk("d", { category: "unknown", genre: "" }),
];
const ids = (qs: string) => filteredSortedBooks(parseShopFilters(new URLSearchParams(qs)), books).map((b) => b.id).sort();

describe("series / sub filters", () => {
  test("?series= filters on the Category series slug", () => {
    assert.deepEqual(ids("series=adventure-series"), ["a", "b"]);
    assert.deepEqual(ids("series=adventure-series&series=education-series"), ["a", "b", "c"]);
  });
  test("an unknown series slug matches nothing", () => {
    assert.deepEqual(ids("series=nope"), []);
  });
  test("?sub= filters on the Subcategory, combined with series", () => {
    assert.deepEqual(ids("sub=Fantasy"), ["a", "c"]);
    assert.deepEqual(ids("series=adventure-series&sub=Fantasy"), ["a"]);
  });
  test("the retired ?genre= tag is read as a subcategory", () => {
    assert.deepEqual(ids("genre=Fantasy"), ["a", "c"]);
  });
  test("?cat= keeps working and an unknown shelf matches no shelf", () => {
    assert.deepEqual(ids("cat=picture"), ["a", "c"]);
    assert.deepEqual(ids("cat=bedtime"), ["b"]);
    assert.deepEqual(ids(""), ["a", "b", "c", "d"]);
  });
});
