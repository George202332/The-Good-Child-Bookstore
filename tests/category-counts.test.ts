import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { attributeCategory, countBooksByCategory, bookCountLabel } from "../lib/category-counts";

describe("category counts", () => {
  test("real category wins", () => {
    assert.equal(attributeCategory({ category: "Education Series", legacySubcategory: "Adventure" }), "Education Series");
  });
  test("legacy genre name falls back to its category", () => {
    assert.equal(attributeCategory({ category: null, legacySubcategory: "Adventure" }), "Adventure Series");
    assert.equal(attributeCategory({ category: null, legacySubcategory: "Friendship" }), "Values and Virtues Series");
    assert.equal(attributeCategory({ category: null, legacySubcategory: "Humor" }), "Fun and Humor Series");
  });
  test("subcategory column is used before the legacy genre", () => {
    assert.equal(attributeCategory({ category: null, subcategory: "Nature", legacySubcategory: "Adventure" }), "Education Series");
  });
  test("invalid category falls through; unmappable books have no category", () => {
    assert.equal(attributeCategory({ category: "Bogus", legacySubcategory: "Poetry" }), "Interactive Activity Series");
    assert.equal(attributeCategory({ category: null, legacySubcategory: "Nonsense" }), undefined);
    assert.equal(attributeCategory({}), undefined);
  });
  test("counts per category, unmappable books ignored", () => {
    const c = countBooksByCategory([
      { category: "Adventure Series" },
      { category: null, legacySubcategory: "Fantasy" },
      { category: null, legacySubcategory: "Gentle Mystery" },
      { category: null, legacySubcategory: "Unknown" },
      { category: null },
    ]);
    assert.equal(c["Adventure Series"], 3);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 3);
    assert.equal(Object.keys(c).length, 8);
  });
  test("singular/plural label", () => {
    assert.equal(bookCountLabel(0), "0 books");
    assert.equal(bookCountLabel(1), "1 book");
    assert.equal(bookCountLabel(2), "2 books");
  });
});
