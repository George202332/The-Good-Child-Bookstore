import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import type { Book } from "../lib/data/catalog";
import { pickFeaturedBooks, siteAverageRating, weightedScore } from "../lib/featured-books";
import { mockupHash } from "../lib/mockup/spec";
import { renderPrintMockup, onLightBackground } from "../lib/mockup/render";
import { generatedWrapCrops } from "../lib/mockup/wrap";

const book = (id: string, o: Partial<Book> = {}): Book => ({ id, category: "fiction", pubDate: "2026-01-01", rating: "0.0", reviews: 0, ...o } as Book);
const rated = (id: string, rating: number, n: number, o: Partial<Book> = {}) => book(id, { rating: rating.toFixed(1), reviews: n, ratingCount: n, ...o });

describe("Featured Books", () => {
  test("with no real ratings anywhere, every other published book counts and six always show (never the viewed one)", () => {
    const all = Array.from({ length: 7 }, (_, i) => book(`b${i}`, { pubDate: `2026-01-0${i + 1}` }));
    for (const t of [0, 1, 2, 3].map((i) => i * 20 * 60 * 1000)) {
      const r = pickFeaturedBooks(all[0], all, t);
      assert.equal(r.mode, "all");
      assert.equal(r.books.length, 6);
      assert.ok(!r.books.some((b) => b.id === "b0"));
      assert.equal(new Set(r.books.map((b) => b.id)).size, 6);
    }
  });
  test("a shop with fewer than seven books shows what it has", () => {
    const all = [book("a"), book("b"), book("c")];
    assert.equal(pickFeaturedBooks(all[0], all).books.length, 2);
  });
  test("demo books with made-up ratings do not switch it to ranked", () => {
    const all = [book("a"), book("b", { rating: "5.0", reviews: 300 })];
    assert.equal(pickFeaturedBooks(all[0], all).mode, "all");
  });
  test("100 ratings averaging 4.8 outrank a single 5.0", () => {
    const avg = 4.5;
    assert.ok(weightedScore(rated("x", 4.8, 100), avg) > weightedScore(rated("y", 5, 1), avg));
    // The site also has an ordinary 4.0 book, so the site average is realistic (about 4.5).
    const all = [book("v"), rated("one", 5, 1), rated("many", 4.8, 100), rated("mid", 4, 50, { category: "art" })];
    assert.deepEqual(pickFeaturedBooks(all[0], all).books.map((b) => b.id), ["many", "one", "mid"]);
  });
  test("a book's own rating counts for more as it collects ratings", () => {
    const avg = 4;
    assert.ok(weightedScore(rated("a", 5, 50), avg) > weightedScore(rated("a", 5, 5), avg));
    assert.ok(weightedScore(rated("a", 5, 5), avg) > avg);
    assert.equal(weightedScore(book("none"), avg), avg);
  });
  test("same category first, rated before unrated, then filled from other categories up to six", () => {
    const all = [
      book("v", { category: "fiction" }),
      rated("f1", 4.0, 3, { category: "fiction" }), rated("f2", 4.9, 40, { category: "fiction" }), book("f3", { category: "fiction", pubDate: "2026-05-01" }),
      rated("o1", 5, 200, { category: "science" }), book("o2", { category: "science" }), book("o3", { category: "art" }), book("o4", { category: "art", pubDate: "2026-09-01" }),
    ];
    const r = pickFeaturedBooks(all[0], all);
    assert.equal(r.mode, "ranked");
    assert.deepEqual(r.books.map((b) => b.id).slice(0, 3), ["f2", "f1", "f3"]);
    assert.equal(r.books[3].id, "o1");
    assert.equal(r.books.length, 6);
    assert.ok(!r.books.some((b) => b.id === "v"));
  });
  test("the site average only uses real ratings, each counted once", () => {
    assert.equal(siteAverageRating([rated("a", 5, 1), rated("b", 4, 3), book("c", { rating: "1.0", reviews: 50 })]), (5 + 12) / 4);
  });
});

describe("AI declaration on the product page", () => {
  const src = readFileSync(new URL("../app/book/[id]/BookDetailClient.tsx", import.meta.url), "utf8");
  test("one plain line above the Details card, only for the two agreed statements", () => {
    const i = src.indexOf("isAiDeclaration(b.aiDeclaration)");
    const card = src.indexOf('className="az-details-card"');
    assert.ok(i > 0 && i < card, "declaration comes before the Details card");
    assert.doesNotMatch(src, /AI use declaration:/);
  });
});

describe("Hardcover mockup", () => {
  test("the settings code changed, so every saved mockup is made again in the new scene", () => {
    const spec = { format: "hardcover" as const, title: "t", author: "a", description: "", isbn: null, trimCode: "0600X0900", pages: 100, paperCode: "060UW444", finish: "M", linenColor: "N", foilColor: "X", foilTitle: "", foilAuthor: "", wrapFileId: null };
    assert.equal(mockupHash(spec, "c"), mockupHash(spec, "c"));
    assert.match(readFileSync(new URL("../lib/mockup/spec.ts", import.meta.url), "utf8"), /v: 9/);
  });
  test("a Hardcover with a cloth colour no longer skips the artwork", () => {
    const store = readFileSync(new URL("../lib/mockup/store.ts", import.meta.url), "utf8");
    assert.doesNotMatch(store, /const cloth =/);
    assert.match(store, /front cover image for the/);
    const render = readFileSync(new URL("../lib/mockup/render.ts", import.meta.url), "utf8");
    assert.doesNotMatch(render, /!\(hardcover && linen\)/);
  });
  test("the picture is transparent around the books, and the light version is not", async () => {
    const front = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 200, g: 60, b: 60 } } }).jpeg().toBuffer();
    const spec = { format: "hardcover" as const, title: "T", author: "A", description: "", isbn: null, trimCode: "0600X0900", pages: 120, paperCode: "060UW444", finish: "M", linenColor: "N", foilColor: "X", foilTitle: "", foilAuthor: "", wrapFileId: null };
    const wrap = await generatedWrapCrops({ frontImage: front, title: "T", author: "A", trimCode: spec.trimCode, paperCode: spec.paperCode, pages: spec.pages });
    const png = await renderPrintMockup(spec, front, wrap);
    const meta = await sharp(png).metadata();
    assert.equal(meta.hasAlpha, true);
    const corner = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.equal(corner[3], 0, "top-left corner is see-through");
    const light = await sharp(await onLightBackground(png)).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.deepEqual([...light].slice(0, 3), [244, 244, 246]);
    // The front of the standing copy is the artwork (reddish), not the navy cloth.
    const raw = await sharp(png).resize(200, 300).raw().toBuffer();
    let red = 0, navy = 0;
    for (let i = 0; i < raw.length; i += 4) { if (raw[i + 3] > 200) { if (raw[i] > 120 && raw[i + 1] < 90) red++; if (raw[i + 2] > raw[i] + 30 && raw[i] < 80) navy++; } }
    assert.ok(red > navy * 3, `artwork dominates (${red} red vs ${navy} navy pixels)`);
  });
});
