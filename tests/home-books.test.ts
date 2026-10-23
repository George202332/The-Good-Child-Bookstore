import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Book } from "../lib/data/catalog";
import { pickBestSellers, pickNewArrivals, HOME_SECTION_SIZE } from "../lib/home-books";
import { subcategoriesWithBooks } from "../lib/subcategory-availability";

function mk(i: number, extra: Partial<Book> = {}): Book {
  return {
    id: `b${String(i).padStart(2, "0")}`,
    pubDate: `2026-01-${String(i).padStart(2, "0")}`,
    reviews: 0,
    rating: "0.0",
    ...extra,
  } as Book;
}
const many = (n: number) => Array.from({ length: n }, (_, i) => mk(i + 1));

describe("home page sections", () => {
  test("New Arrivals: 12 newest, newest first, no repeats, even with 14 or 26 books", () => {
    for (const n of [14, 26, 12, 13]) {
      const out = pickNewArrivals(many(n));
      assert.equal(out.length, HOME_SECTION_SIZE);
      assert.equal(new Set(out.map((b) => b.id)).size, 12);
      assert.equal(out[0].id, `b${String(n).padStart(2, "0")}`);
    }
  });
  test("fewer than 12 books shows what exists", () => {
    assert.equal(pickNewArrivals(many(5)).length, 5);
    assert.equal(pickBestSellers(many(5), new Map()).length, 5);
    assert.equal(pickBestSellers([], new Map()).length, 0);
  });
  test("Best Sellers with no sales still fills 12", () => {
    assert.equal(pickBestSellers(many(30), new Map()).length, 12);
  });
  test("Best Sellers ranks by paid sales, then fills with the rest, never twice", () => {
    const books = many(20);
    const out = pickBestSellers(books, new Map([["b03", 5], ["b07", 9], ["b99", 4]]));
    assert.deepEqual(out.slice(0, 2).map((b) => b.id), ["b07", "b03"]);
    assert.equal(out.length, 12);
    assert.equal(new Set(out.map((b) => b.id)).size, 12);
  });
  test("a duplicated book appears once", () => {
    const b = many(3);
    assert.equal(pickNewArrivals([...b, ...b]).length, 3);
  });
});

describe("Bookshelf subcategory pop-up", () => {
  test("lists only subcategories that have a book, in taxonomy order; accepts the old category spelling", () => {
    const out = subcategoriesWithBooks([
      { series: "Adventure Series", subcategory: "Fantasy" },
      { series: "Adventure Series", subcategory: "Adventure" },
      { series: "Fun and Humor Series", subcategory: "Fable" },
      { series: "Education Series", subcategory: "Not a real one" },
      { series: "Education Series" },
    ]);
    assert.deepEqual(out["Adventure Series"], ["Adventure", "Fantasy"]);
    assert.deepEqual(out["Fun and Humor"], ["Fable"]);
    assert.deepEqual(out["Education Series"], []);
    assert.deepEqual(out["Christmas"], undefined);
    assert.deepEqual(out["Holiday and Festivities"], []);
  });
});
